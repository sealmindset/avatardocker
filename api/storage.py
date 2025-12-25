"""
Local Storage Service - Replaces Azure Blob Storage

Provides file-based storage for sessions, scorecards, transcripts, etc.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Base data directory
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))


def _ensure_dir(path: Path) -> None:
    """Ensure directory exists."""
    path.parent.mkdir(parents=True, exist_ok=True)


def read_json(path: str) -> Optional[Dict[str, Any]]:
    """Read JSON file from storage."""
    full_path = DATA_DIR / path
    try:
        if full_path.exists():
            with open(full_path, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to read {path}: {e}")
    return None


def write_json(path: str, data: Dict[str, Any]) -> bool:
    """Write JSON file to storage."""
    full_path = DATA_DIR / path
    try:
        _ensure_dir(full_path)
        with open(full_path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        return True
    except Exception as e:
        logger.error(f"Failed to write {path}: {e}")
        return False


def delete_file(path: str) -> bool:
    """Delete a file from storage."""
    full_path = DATA_DIR / path
    try:
        if full_path.exists():
            full_path.unlink()
            return True
    except Exception as e:
        logger.error(f"Failed to delete {path}: {e}")
    return False


def list_files(prefix: str) -> List[str]:
    """List files with given prefix."""
    base_path = DATA_DIR / prefix
    files = []
    try:
        if base_path.exists():
            for item in base_path.rglob("*"):
                if item.is_file():
                    files.append(str(item.relative_to(DATA_DIR)))
    except Exception as e:
        logger.error(f"Failed to list files with prefix {prefix}: {e}")
    return files


# Session-specific helpers

def get_session_path(session_id: str, filename: str) -> str:
    """Get path for a session file."""
    return f"sessions/{session_id}/{filename}"


def get_conversation_history(session_id: str) -> List[Dict[str, str]]:
    """Load conversation history for a session."""
    data = read_json(get_session_path(session_id, "conversation.json"))
    return data.get("messages", []) if data else []


def save_conversation_history(session_id: str, history: List[Dict[str, str]]) -> bool:
    """Save conversation history for a session."""
    return write_json(
        get_session_path(session_id, "conversation.json"),
        {"messages": history}
    )


def get_pulse_state(session_id: str) -> Dict[str, Any]:
    """Load PULSE state for a session."""
    data = read_json(get_session_path(session_id, "pulse_state.json"))
    return data or {"current_stage": 1, "stage_name": "Probe", "detected_behaviors": []}


def save_pulse_state(session_id: str, stage: int, stage_name: str, behaviors: List[str]) -> bool:
    """Save PULSE state for a session."""
    return write_json(
        get_session_path(session_id, "pulse_state.json"),
        {"current_stage": stage, "stage_name": stage_name, "detected_behaviors": behaviors}
    )


def get_sale_state(session_id: str) -> Dict[str, Any]:
    """Load sale state for a session."""
    data = read_json(get_session_path(session_id, "sale_state.json"))
    return data or {
        "trust_score": 5,
        "outcome": "in_progress",
        "missteps": [],
        "total_missteps": 0,
    }


def save_sale_state(session_id: str, state: Dict[str, Any]) -> bool:
    """Save sale state for a session."""
    return write_json(get_session_path(session_id, "sale_state.json"), state)


def get_scorecard(session_id: str) -> Optional[Dict[str, Any]]:
    """Load scorecard for a session."""
    return read_json(get_session_path(session_id, "scorecard.json"))


def save_scorecard(session_id: str, scorecard: Dict[str, Any]) -> bool:
    """Save scorecard for a session."""
    return write_json(get_session_path(session_id, "scorecard.json"), scorecard)


def save_transcript(session_id: str, conversation_history: List[Dict[str, str]]) -> bool:
    """Save transcript for a session."""
    transcript_lines = []
    for msg in conversation_history:
        role = "Trainee" if msg["role"] == "user" else "Customer"
        transcript_lines.append(f"{role}: {msg['content']}")
    
    return write_json(
        get_session_path(session_id, "transcript.json"),
        {"transcript": transcript_lines}
    )


def get_session_data(session_id: str) -> Optional[Dict[str, Any]]:
    """Load full session data."""
    return read_json(get_session_path(session_id, "session.json"))


def save_session_data(session_id: str, data: Dict[str, Any]) -> bool:
    """Save full session data."""
    return write_json(get_session_path(session_id, "session.json"), data)


# Prompts storage

def get_all_prompts() -> List[Dict[str, Any]]:
    """Get all prompts from storage."""
    data = read_json("prompts/prompts.json")
    return data.get("prompts", []) if data else []


def save_all_prompts(prompts: List[Dict[str, Any]]) -> bool:
    """Save all prompts to storage."""
    return write_json("prompts/prompts.json", {"prompts": prompts})


def get_prompt_versions(prompt_id: str) -> List[Dict[str, Any]]:
    """Get all versions of a prompt."""
    data = read_json(f"prompts/versions/{prompt_id}.json")
    return data.get("versions", []) if data else []


def save_prompt_version(prompt_id: str, version_data: Dict[str, Any]) -> bool:
    """Save a prompt version."""
    versions = get_prompt_versions(prompt_id)
    versions.append(version_data)
    return write_json(f"prompts/versions/{prompt_id}.json", {"versions": versions})
