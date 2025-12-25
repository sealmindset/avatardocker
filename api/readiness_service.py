"""
Readiness Service - Computes user readiness scores from session events.

Replaces Azure-specific readiness_service.py with PostgreSQL-based implementation.
"""

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Window configuration: last 30 days of events
AGG_WINDOW_NAME = "30d"
AGG_WINDOW_LABEL = "last_30_days"

# Readiness weights
READINESS_WEIGHTS = {
    "readiness_technical": 0.3,
    "readiness_communication": 0.3,
    "readiness_structure": 0.2,
    "readiness_behavioral": 0.2,
}

# Mapping from skill_tag -> readiness component
COMPONENT_SKILL_TAGS = {
    "technical_depth": "readiness_technical",
    "communication": "readiness_communication",
    "structure": "readiness_structure",
    "behavioral_examples": "readiness_behavioral",
}


def readiness_enabled() -> bool:
    """Check if readiness feature is enabled."""
    value = os.getenv("PULSE_READINESS_ENABLED", "true").strip().lower()
    return value in ("true", "1", "yes")


def validate_user_id(user_id: str) -> bool:
    """Validate that user_id is a valid UUID."""
    if not user_id or not isinstance(user_id, str):
        return False
    try:
        uuid.UUID(user_id)
        return True
    except ValueError:
        return False


async def compute_skill_aggregates(pool, user_id: str) -> List[Dict[str, Any]]:
    """Compute per-skill aggregates from session_events."""
    query = """
        SELECT
            skill_tag,
            AVG(score) AS avg_score,
            COUNT(*) AS sample_size
        FROM session_events
        WHERE user_id = $1
          AND occurred_at >= now() - INTERVAL '30 days'
        GROUP BY skill_tag
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, user_id)
        
        aggregates = []
        for row in rows:
            aggregates.append({
                "skill_tag": row["skill_tag"],
                "avg_score": float(row["avg_score"]),
                "sample_size": int(row["sample_size"]),
            })
        return aggregates


async def upsert_user_skill_agg(pool, user_id: str, aggregates: List[Dict[str, Any]]) -> None:
    """Upsert skill aggregates for a user."""
    query = """
        INSERT INTO user_skill_agg (user_id, skill_tag, time_window, avg_score, sample_size, last_updated)
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (user_id, skill_tag, time_window)
        DO UPDATE SET
            avg_score = EXCLUDED.avg_score,
            sample_size = EXCLUDED.sample_size,
            last_updated = now()
    """
    
    async with pool.acquire() as conn:
        for agg in aggregates:
            await conn.execute(
                query,
                user_id,
                agg["skill_tag"],
                AGG_WINDOW_NAME,
                agg["avg_score"],
                agg["sample_size"],
            )


def compute_components_from_aggregates(aggregates: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    """Compute readiness components from skill aggregates."""
    sums = {
        "readiness_technical": 0.0,
        "readiness_communication": 0.0,
        "readiness_structure": 0.0,
        "readiness_behavioral": 0.0,
    }
    weights = {k: 0 for k in sums.keys()}
    overall_from_events = None
    
    for agg in aggregates:
        tag = agg["skill_tag"]
        avg_score = agg["avg_score"]
        sample_size = agg["sample_size"]
        
        if tag == "overall":
            overall_from_events = avg_score
        
        component = COMPONENT_SKILL_TAGS.get(tag)
        if component:
            sums[component] += avg_score * sample_size
            weights[component] += sample_size
    
    components = {}
    for key in sums.keys():
        if weights[key] > 0:
            components[key] = round(sums[key] / weights[key], 2)
        else:
            components[key] = None
    
    components["overall_from_events"] = overall_from_events
    return components


def compute_overall_from_components(components: Dict[str, Optional[float]]) -> Optional[float]:
    """Compute overall readiness score from components."""
    present_keys = [k for k in READINESS_WEIGHTS.keys() if components.get(k) is not None]
    
    if present_keys:
        total_w = sum(READINESS_WEIGHTS[k] for k in present_keys)
        if total_w <= 0:
            return None
        overall = 0.0
        for k in present_keys:
            w = READINESS_WEIGHTS[k] / total_w
            overall += components[k] * w
        return round(overall, 2)
    
    # Fallback to overall from events
    overall_from_events = components.get("overall_from_events")
    if isinstance(overall_from_events, (int, float)):
        return round(float(overall_from_events), 2)
    
    return None


async def store_readiness_snapshot(
    pool,
    user_id: str,
    snapshot: Dict[str, Any],
    meta: Dict[str, Any]
) -> None:
    """Store a readiness snapshot in the database."""
    query = """
        INSERT INTO user_readiness (
            user_id, snapshot_at, readiness_overall,
            readiness_technical, readiness_communication,
            readiness_structure, readiness_behavioral, meta
        )
        VALUES ($1, now(), $2, $3, $4, $5, $6, $7)
    """
    
    async with pool.acquire() as conn:
        await conn.execute(
            query,
            user_id,
            snapshot["readiness_overall"],
            snapshot.get("readiness_technical"),
            snapshot.get("readiness_communication"),
            snapshot.get("readiness_structure"),
            snapshot.get("readiness_behavioral"),
            meta,
        )


async def compute_and_store_user_readiness(pool, user_id: str) -> Optional[Dict[str, Any]]:
    """Compute and store readiness for a user."""
    if not readiness_enabled():
        logger.info("Readiness disabled via PULSE_READINESS_ENABLED")
        return None
    
    if not validate_user_id(user_id):
        logger.warning(f"Invalid user_id for readiness: {user_id}")
        return None
    
    try:
        aggregates = await compute_skill_aggregates(pool, user_id)
        
        if not aggregates:
            logger.info(f"No session_events for user {user_id}")
            return None
        
        await upsert_user_skill_agg(pool, user_id, aggregates)
        
        components = compute_components_from_aggregates(aggregates)
        overall = compute_overall_from_components(components)
        
        if overall is None:
            logger.info(f"Unable to compute readiness_overall for user {user_id}")
            return None
        
        snapshot = {
            "user_id": user_id,
            "readiness_overall": overall,
            "readiness_technical": components.get("readiness_technical"),
            "readiness_communication": components.get("readiness_communication"),
            "readiness_structure": components.get("readiness_structure"),
            "readiness_behavioral": components.get("readiness_behavioral"),
            "window": AGG_WINDOW_NAME,
            "window_label": AGG_WINDOW_LABEL,
        }
        
        meta = {
            "formula_version": "v1",
            "window_name": AGG_WINDOW_NAME,
            "window_label": AGG_WINDOW_LABEL,
            "weights": READINESS_WEIGHTS,
            "source": "session_events",
        }
        
        await store_readiness_snapshot(pool, user_id, snapshot, meta)
        
        logger.info(f"Stored readiness snapshot for user {user_id} (overall={overall})")
        return snapshot
        
    except Exception as e:
        logger.exception(f"Failed to compute readiness for user {user_id}: {e}")
        return None


async def get_user_readiness(pool, user_id: str) -> Optional[Dict[str, Any]]:
    """Get the latest readiness snapshot for a user."""
    query = """
        SELECT * FROM user_readiness
        WHERE user_id = $1
        ORDER BY snapshot_at DESC
        LIMIT 1
    """
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, user_id)
        if row:
            return dict(row)
    return None


async def get_user_skill_aggregates(pool, user_id: str) -> List[Dict[str, Any]]:
    """Get skill aggregates for a user."""
    query = """
        SELECT skill_tag, avg_score, sample_size, last_updated
        FROM user_skill_agg
        WHERE user_id = $1 AND time_window = $2
        ORDER BY skill_tag
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, user_id, AGG_WINDOW_NAME)
        return [dict(row) for row in rows]
