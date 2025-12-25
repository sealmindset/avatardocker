"""
Avatar Manager - Download and manage LiteAvatar models from ModelScope

This module provides functionality to:
- Browse available avatars from ModelScope LiteAvatarGallery
- Download avatars without requiring ModelScope SDK (uses git or direct HTTP)
- Manage local avatar storage and metadata
- List and delete local avatars

No Azure/Microsoft dependencies - uses local Piper TTS for voices.
"""

import os
import json
import asyncio
import subprocess
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path
import httpx

logger = logging.getLogger(__name__)

# ModelScope repository info
MODELSCOPE_REPO = "HumanAIGC-Engineering/LiteAvatarGallery"
MODELSCOPE_BASE_URL = "https://www.modelscope.cn"
MODELSCOPE_RAW_URL = f"{MODELSCOPE_BASE_URL}/models/{MODELSCOPE_REPO}/resolve/master"

# Required files for a valid LiteAvatar
AVATAR_REQUIRED_FILES = [
    "bg_video.mp4",
    "net_encode.pt",
    "net_decode.pt",
    "neutral_pose.npy",
    "face_box.txt",
]

# Optional files
AVATAR_OPTIONAL_FILES = [
    "net.pth",
]

# Local storage paths
AVATARS_BASE_DIR = os.environ.get(
    "AVATARS_DATA_DIR", 
    "/app/lite-avatar/data/avatars"
)
METADATA_FILE = os.path.join(AVATARS_BASE_DIR, "metadata.json")

# Download job tracking
_download_jobs: Dict[str, Dict[str, Any]] = {}


def ensure_avatars_dir():
    """Ensure the avatars directory exists."""
    os.makedirs(AVATARS_BASE_DIR, exist_ok=True)


def load_metadata() -> Dict[str, Any]:
    """Load avatar metadata from disk."""
    ensure_avatars_dir()
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
    return {"avatars": {}, "voices": {}, "catalog_updated": None}


def save_metadata(metadata: Dict[str, Any]):
    """Save avatar metadata to disk."""
    ensure_avatars_dir()
    try:
        with open(METADATA_FILE, "w") as f:
            json.dump(metadata, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save metadata: {e}")


# ============================================================================
# AVATAR CATALOG - Hardcoded from ModelScope LiteAvatarGallery
# This avoids needing to parse the remote repository dynamically
# ============================================================================

AVATAR_CATALOG = {
    "batches": [
        {
            "id": "20250408",
            "name": "April 2025 Collection",
            "count": 22,
            "description": "First batch of diverse avatars with various styles",
            "release_date": "2025-04-08"
        }
    ],
    "avatars": [
        # Female avatars (12) - IDs exactly as in avatarslist.md
        {"id": "20250408/P1lXrpJL507-PZ4hMPutyF7A", "batch": "20250408", "gender": "female", "style": "casual", "name": "Aria", "size_mb": 45},
        {"id": "20250408/P1VXATUY6mm7CJLZ6CARKU0Q", "batch": "20250408", "gender": "female", "style": "casual", "name": "Bella", "size_mb": 45},
        {"id": "20250408/P1bywtN2wUs4zbOIctjYZpjw", "batch": "20250408", "gender": "female", "style": "professional", "name": "Clara", "size_mb": 45},
        {"id": "20250408/P11EW-z1MQ7qDBxbdFkzPPng", "batch": "20250408", "gender": "female", "style": "casual", "name": "Diana", "size_mb": 45},
        {"id": "20250408/P1tkdZGlULMxNRWB3nsrucSA", "batch": "20250408", "gender": "female", "style": "professional", "name": "Elena", "size_mb": 45},
        {"id": "20250408/P1lQSCriJLhJCbJfoOufApGw", "batch": "20250408", "gender": "female", "style": "casual", "name": "Fiona", "size_mb": 45},
        {"id": "20250408/P1DB_Y1K6USuq-Nlun6Bh94A", "batch": "20250408", "gender": "female", "style": "professional", "name": "Grace", "size_mb": 45},
        {"id": "20250408/P1yerb8kIA7eBpaIydU2lwzA", "batch": "20250408", "gender": "female", "style": "casual", "name": "Hannah", "size_mb": 45},
        {"id": "20250408/P1tDSmoZ2olUyEqDslDH_cnQ", "batch": "20250408", "gender": "female", "style": "professional", "name": "Iris", "size_mb": 45},
        {"id": "20250408/P1mmEbsQ19oc-16L27yA0_ew", "batch": "20250408", "gender": "female", "style": "casual", "name": "Julia", "size_mb": 45},
        {"id": "20250408/P1CgOolwJwkGaZLu3BDN6S_w", "batch": "20250408", "gender": "female", "style": "professional", "name": "Kate", "size_mb": 45},
        {"id": "20250408/P1sd8kz0dw2_2wl7m97UVjSQ", "batch": "20250408", "gender": "female", "style": "casual", "name": "Luna", "size_mb": 45},
        # Male avatars (10)
        {"id": "20250408/P1S9eH2OIYF1HgVyM2-2OK4g", "batch": "20250408", "gender": "male", "style": "casual", "name": "Alex", "size_mb": 45},
        {"id": "20250408/P1u82oEWvPea73MT96wWTK-g", "batch": "20250408", "gender": "male", "style": "professional", "name": "Brian", "size_mb": 45},
        {"id": "20250408/P1JBluxvgTS5ynI_lKtw64LQ", "batch": "20250408", "gender": "male", "style": "casual", "name": "Chris", "size_mb": 45},
        {"id": "20250408/P1j2fUp4WJH7v5NlZrEDK_nw", "batch": "20250408", "gender": "male", "style": "professional", "name": "David", "size_mb": 45},
        {"id": "20250408/P11eXAt1qfgYGyiJnbKy5Zow", "batch": "20250408", "gender": "male", "style": "casual", "name": "Eric", "size_mb": 45},
        {"id": "20250408/P16F_-yXUzcnhqYhWTsW310w", "batch": "20250408", "gender": "male", "style": "professional", "name": "Frank", "size_mb": 45},
        {"id": "20250408/P1HypyfUJfi6ZJawOSSN7GqA", "batch": "20250408", "gender": "male", "style": "casual", "name": "George", "size_mb": 45},
        {"id": "20250408/P12rUIdDyWToybp-B0DCefSQ", "batch": "20250408", "gender": "male", "style": "professional", "name": "Henry", "size_mb": 45},
        {"id": "20250408/P1PQc-xB-UC_y-Cm1D9POa8w", "batch": "20250408", "gender": "male", "style": "casual", "name": "Ivan", "size_mb": 45},
        {"id": "20250408/P1dZg4pbDQ0OvEBvexPszwtw", "batch": "20250408", "gender": "male", "style": "professional", "name": "Jake", "size_mb": 45},
    ]
}


def get_avatar_catalog() -> Dict[str, Any]:
    """Get the avatar catalog with download status and generated URLs."""
    metadata = load_metadata()
    catalog = {"batches": AVATAR_CATALOG["batches"].copy(), "avatars": []}
    
    base_url = "https://modelscope.cn/models/HumanAIGC-Engineering/LiteAvatarGallery/resolve/master"
    
    # Process each avatar and add URLs
    for avatar in AVATAR_CATALOG.get("avatars", []):
        avatar_copy = avatar.copy()
        avatar_id = avatar["id"]
        
        # Add thumbnail and download URLs using raw avatar_id directly
        avatar_copy["thumbnail_url"] = f"{base_url}/{avatar_id}.png"
        avatar_copy["download_url"] = f"{base_url}/{avatar_id}.zip"
        
        # Check download status - first check metadata, then check disk
        is_downloaded = avatar_id in metadata.get("avatars", {})
        
        if not is_downloaded:
            # Also check if files exist on disk (may have been downloaded manually)
            # Check for extracted folder or zip file
            avatar_folder = os.path.join(AVATARS_BASE_DIR, avatar_id)
            avatar_zip = os.path.join(AVATARS_BASE_DIR, f"{avatar_id.split('/')[-1]}.zip")
            batch_folder = os.path.join(AVATARS_BASE_DIR, avatar_id.split('/')[0])
            avatar_zip_in_batch = os.path.join(batch_folder, f"{avatar_id.split('/')[-1]}.zip")
            
            if os.path.isdir(avatar_folder):
                is_downloaded = True
                logger.debug(f"Avatar {avatar_id} found as extracted folder")
            elif os.path.isfile(avatar_zip):
                is_downloaded = True
                logger.debug(f"Avatar {avatar_id} found as zip file")
            elif os.path.isfile(avatar_zip_in_batch):
                is_downloaded = True
                logger.debug(f"Avatar {avatar_id} found as zip in batch folder")
        
        avatar_copy["downloaded"] = is_downloaded
        if is_downloaded and avatar_id in metadata.get("avatars", {}):
            avatar_copy["downloaded_at"] = metadata["avatars"][avatar_id].get("downloaded_at")
        
        catalog["avatars"].append(avatar_copy)
    
    return catalog


async def fetch_avatar_catalog_from_modelscope() -> Dict[str, Any]:
    """
    Fetch the avatar catalog from ModelScope.
    
    This parses the avatar.md files to get the list of available avatars.
    Falls back to hardcoded catalog if fetch fails.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try to fetch the README to get avatar list
            url = f"{MODELSCOPE_RAW_URL}/README.md"
            response = await client.get(url, follow_redirects=True)
            
            if response.status_code == 200:
                # Parse the README to extract avatar info
                # This is a simplified parser - would need enhancement for production
                content = response.text
                logger.info(f"Fetched catalog from ModelScope ({len(content)} bytes)")
                
                # For now, return the hardcoded catalog
                # TODO: Parse the actual avatar.md files
                return AVATAR_CATALOG
    except Exception as e:
        logger.warning(f"Failed to fetch catalog from ModelScope: {e}")
    
    return AVATAR_CATALOG


def list_local_avatars() -> List[Dict[str, Any]]:
    """List all locally downloaded avatars."""
    metadata = load_metadata()
    avatars = []
    
    for avatar_id, avatar_info in metadata.get("avatars", {}).items():
        avatar_path = os.path.join(AVATARS_BASE_DIR, avatar_id)
        
        # Verify the avatar still exists on disk
        if os.path.exists(avatar_path):
            # Calculate actual size
            size_bytes = sum(
                os.path.getsize(os.path.join(avatar_path, f))
                for f in os.listdir(avatar_path)
                if os.path.isfile(os.path.join(avatar_path, f))
            )
            
            avatars.append({
                "id": avatar_id,
                "name": avatar_info.get("name", avatar_id.split("/")[-1]),
                "gender": avatar_info.get("gender", "unknown"),
                "style": avatar_info.get("style", "default"),
                "path": avatar_path,
                "size_mb": round(size_bytes / (1024 * 1024), 2),
                "downloaded_at": avatar_info.get("downloaded_at"),
                "source": avatar_info.get("source", "modelscope")
            })
        else:
            # Avatar was deleted from disk, remove from metadata
            logger.warning(f"Avatar {avatar_id} missing from disk, removing from metadata")
    
    return avatars


def get_local_avatar(avatar_id: str) -> Optional[Dict[str, Any]]:
    """Get info about a specific local avatar."""
    metadata = load_metadata()
    
    if avatar_id not in metadata.get("avatars", {}):
        return None
    
    avatar_info = metadata["avatars"][avatar_id]
    avatar_path = os.path.join(AVATARS_BASE_DIR, avatar_id)
    
    if not os.path.exists(avatar_path):
        return None
    
    return {
        "id": avatar_id,
        "name": avatar_info.get("name", avatar_id.split("/")[-1]),
        "gender": avatar_info.get("gender", "unknown"),
        "style": avatar_info.get("style", "default"),
        "path": avatar_path,
        "downloaded_at": avatar_info.get("downloaded_at"),
    }


def validate_avatar_directory(avatar_path: str) -> bool:
    """Check if a directory contains a valid LiteAvatar."""
    for required_file in AVATAR_REQUIRED_FILES:
        if not os.path.exists(os.path.join(avatar_path, required_file)):
            return False
    return True


async def download_avatar_zip(
    client: httpx.AsyncClient,
    avatar_id: str,
    target_dir: str,
    job_id: str
) -> bool:
    """
    Download avatar as a ZIP file from ModelScope and extract it.
    
    ModelScope stores avatars as ZIP archives, not individual files.
    The ZIP contains a folder with all required files (bg_video.mp4, net_encode.pt, etc.)
    
    ZIP structure example:
        P1lXrpJL507-PZ4hMPutyF7A/
        P1lXrpJL507-PZ4hMPutyF7A/bg_video.mp4
        P1lXrpJL507-PZ4hMPutyF7A/net_encode.pt
        ...
    
    We extract to the batch folder and the ZIP creates the avatar subfolder.
    """
    import zipfile
    import io
    
    # Avatar ID format: "20250408/P1lXrpJL507-PZ4hMPutyF7A"
    # ZIP URL format: https://modelscope.cn/models/.../resolve/master/20250408/P1lXrpJL507-PZ4hMPutyF7A.zip
    batch_id = avatar_id.split("/")[0]
    avatar_name = avatar_id.split("/")[1]
    
    zip_url = f"{MODELSCOPE_RAW_URL}/{batch_id}/{avatar_name}.zip"
    
    # Extract to batch folder (ZIP already contains avatar subfolder)
    batch_dir = os.path.join(AVATARS_BASE_DIR, batch_id)
    
    try:
        logger.info(f"Downloading avatar ZIP from {zip_url}")
        
        if job_id in _download_jobs:
            _download_jobs[job_id]["message"] = "Downloading avatar ZIP file..."
        
        # Download with streaming for large files
        async with client.stream("GET", zip_url, follow_redirects=True) as response:
            if response.status_code != 200:
                logger.error(f"Failed to download ZIP: HTTP {response.status_code}")
                return False
            
            # Read content in chunks
            content = b""
            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0
            
            async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):  # 1MB chunks
                content += chunk
                downloaded += len(chunk)
                
                if total_size > 0 and job_id in _download_jobs:
                    progress = int((downloaded / total_size) * 80)  # 80% for download
                    _download_jobs[job_id]["progress"] = progress
                    _download_jobs[job_id]["message"] = f"Downloading... {downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB"
        
        logger.info(f"Downloaded ZIP ({len(content)} bytes), extracting...")
        
        if job_id in _download_jobs:
            _download_jobs[job_id]["message"] = "Extracting avatar files..."
            _download_jobs[job_id]["progress"] = 85
        
        # Extract ZIP to batch directory (ZIP contains avatar subfolder)
        os.makedirs(batch_dir, exist_ok=True)
        
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            # List contents for logging
            file_list = zf.namelist()
            logger.info(f"ZIP contains {len(file_list)} files: {file_list[:5]}...")
            
            # Extract all files to batch directory
            # The ZIP already contains the avatar folder (e.g., P1lXrpJL507-PZ4hMPutyF7A/)
            zf.extractall(batch_dir)
        
        # Verify the avatar folder was created
        expected_path = os.path.join(batch_dir, avatar_name)
        if os.path.isdir(expected_path):
            logger.info(f"Extracted avatar to {expected_path}")
            return True
        else:
            logger.error(f"Expected avatar folder not found: {expected_path}")
            logger.error(f"Batch dir contents: {os.listdir(batch_dir)}")
            return False
        
    except zipfile.BadZipFile as e:
        logger.error(f"Invalid ZIP file: {e}")
        return False
    except Exception as e:
        logger.error(f"Error downloading/extracting avatar: {e}")
        return False


async def download_avatar_file(
    client: httpx.AsyncClient,
    avatar_id: str,
    filename: str,
    target_dir: str,
    job_id: str
) -> bool:
    """Download a single avatar file (legacy method, kept for fallback)."""
    url = f"{MODELSCOPE_RAW_URL}/{avatar_id}/{filename}"
    filepath = os.path.join(target_dir, filename)
    
    try:
        logger.info(f"Downloading {filename} from {url}")
        
        # Update job status
        if job_id in _download_jobs:
            _download_jobs[job_id]["message"] = f"Downloading {filename}..."
        
        response = await client.get(url, follow_redirects=True)
        
        if response.status_code == 200:
            with open(filepath, "wb") as f:
                f.write(response.content)
            logger.info(f"Downloaded {filename} ({len(response.content)} bytes)")
            return True
        else:
            logger.warning(f"Failed to download {filename}: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error downloading {filename}: {e}")
        return False


async def download_avatar(
    avatar_id: str,
    name: str = None,
    gender: str = "unknown",
    style: str = "default"
) -> str:
    """
    Download an avatar from ModelScope.
    
    Returns a job_id that can be used to track progress.
    """
    import uuid
    job_id = str(uuid.uuid4())[:8]
    
    # Initialize job tracking
    _download_jobs[job_id] = {
        "status": "starting",
        "progress": 0,
        "message": "Initializing download...",
        "avatar_id": avatar_id,
        "name": name or avatar_id.split("/")[-1],
        "started_at": datetime.utcnow().isoformat()
    }
    
    # Start download in background
    asyncio.create_task(_download_avatar_task(job_id, avatar_id, name, gender, style))
    
    return job_id


async def _download_avatar_task(
    job_id: str,
    avatar_id: str,
    name: str,
    gender: str,
    style: str
):
    """
    Background task to download avatar from ModelScope.
    
    ModelScope stores avatars as ZIP archives containing all required files.
    This method downloads the ZIP and extracts it to the target directory.
    """
    target_dir = os.path.join(AVATARS_BASE_DIR, avatar_id)
    
    try:
        _download_jobs[job_id]["status"] = "downloading"
        
        # Use longer timeout for large ZIP files (can be 15-20MB)
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Download and extract the ZIP file
            success = await download_avatar_zip(
                client, avatar_id, target_dir, job_id
            )
            
            if not success:
                raise Exception("Failed to download avatar ZIP file")
        
        # Update progress
        _download_jobs[job_id]["progress"] = 90
        _download_jobs[job_id]["message"] = "Validating avatar files..."
        
        # Validate the download
        if not validate_avatar_directory(target_dir):
            # List what files we got for debugging
            if os.path.exists(target_dir):
                files = os.listdir(target_dir)
                logger.error(f"Avatar directory contents: {files}")
            raise Exception("Downloaded avatar is incomplete or invalid - missing required files")
        
        # Update metadata
        metadata = load_metadata()
        metadata["avatars"][avatar_id] = {
            "name": name or avatar_id.split("/")[-1],
            "gender": gender,
            "style": style,
            "downloaded_at": datetime.utcnow().isoformat(),
            "source": "modelscope"
        }
        save_metadata(metadata)
        
        # Mark as complete
        _download_jobs[job_id]["status"] = "completed"
        _download_jobs[job_id]["progress"] = 100
        _download_jobs[job_id]["message"] = "Download complete!"
        
        logger.info(f"Successfully downloaded avatar {avatar_id}")
        
    except Exception as e:
        logger.error(f"Failed to download avatar {avatar_id}: {e}")
        
        # Clean up partial download
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir, ignore_errors=True)
        
        _download_jobs[job_id]["status"] = "failed"
        _download_jobs[job_id]["message"] = str(e)


def get_download_status(job_id: str) -> Optional[Dict[str, Any]]:
    """Get the status of a download job."""
    return _download_jobs.get(job_id)


def delete_avatar(avatar_id: str) -> bool:
    """Delete a locally downloaded avatar."""
    avatar_path = os.path.join(AVATARS_BASE_DIR, avatar_id)
    
    try:
        if os.path.exists(avatar_path):
            shutil.rmtree(avatar_path)
        
        # Update metadata
        metadata = load_metadata()
        if avatar_id in metadata.get("avatars", {}):
            del metadata["avatars"][avatar_id]
            save_metadata(metadata)
        
        logger.info(f"Deleted avatar {avatar_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete avatar {avatar_id}: {e}")
        return False


# ============================================================================
# PIPER TTS VOICES - Local voice options (no Azure/Microsoft)
# ============================================================================

PIPER_VOICES = {
    # Female voices
    "amy": {
        "id": "amy",
        "name": "Amy",
        "gender": "female",
        "provider": "piper",
        "model": "en_US-amy-medium",
        "description": "American English female voice",
        "download_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx"
    },
    "lessac": {
        "id": "lessac",
        "name": "Lessac",
        "gender": "female",
        "provider": "piper",
        "model": "en_US-lessac-medium",
        "description": "American English female voice (Lessac)",
        "download_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
    },
    "libritts": {
        "id": "libritts",
        "name": "LibriTTS",
        "gender": "female",
        "provider": "piper",
        "model": "en_US-libritts-high",
        "description": "High quality American English female voice",
        "download_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts/high/en_US-libritts-high.onnx"
    },
    # Male voices
    "ryan": {
        "id": "ryan",
        "name": "Ryan",
        "gender": "male",
        "provider": "piper",
        "model": "en_US-ryan-medium",
        "description": "American English male voice",
        "download_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx"
    },
    "arctic": {
        "id": "arctic",
        "name": "Arctic",
        "gender": "male",
        "provider": "piper",
        "model": "en_US-arctic-medium",
        "description": "American English male voice (Arctic)",
        "download_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/arctic/medium/en_US-arctic-medium.onnx"
    },
    # Default fallback names
    "akiko": {
        "id": "akiko",
        "name": "Akiko",
        "gender": "female",
        "provider": "piper",
        "model": "en_US-amy-medium",  # Uses Amy voice
        "description": "Default female persona name"
    },
    "noah": {
        "id": "noah",
        "name": "Noah",
        "gender": "male",
        "provider": "piper",
        "model": "en_US-ryan-medium",  # Uses Ryan voice
        "description": "Default male persona name"
    },
}


def get_available_voices() -> List[Dict[str, Any]]:
    """Get list of available Piper TTS voices."""
    return list(PIPER_VOICES.values())


def get_voices_by_gender(gender: str) -> List[Dict[str, Any]]:
    """Get voices filtered by gender."""
    return [v for v in PIPER_VOICES.values() if v["gender"] == gender]


def get_random_voice(gender: str = None) -> Dict[str, Any]:
    """Get a random voice, optionally filtered by gender."""
    import random
    
    if gender:
        voices = get_voices_by_gender(gender)
    else:
        voices = list(PIPER_VOICES.values())
    
    if not voices:
        # Fallback to default
        return PIPER_VOICES["akiko"] if gender == "female" else PIPER_VOICES["noah"]
    
    return random.choice(voices)


# ============================================================================
# VOICE DOWNLOAD - Download Piper voices from HuggingFace
# ============================================================================

VOICES_DIR = os.environ.get("VOICES_DATA_DIR", "/app/piper-voices")


def ensure_voices_dir():
    """Ensure the voices directory exists."""
    os.makedirs(VOICES_DIR, exist_ok=True)


async def download_voice(
    voice_id: str,
    name: str,
    gender: str,
    onnx_url: str,
    json_url: str
) -> Dict[str, Any]:
    """
    Download a Piper voice from HuggingFace.
    
    Downloads both the .onnx model file and the .onnx.json config file.
    """
    ensure_voices_dir()
    
    voice_dir = os.path.join(VOICES_DIR, voice_id)
    os.makedirs(voice_dir, exist_ok=True)
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Download ONNX model
            logger.info(f"Downloading voice model: {onnx_url}")
            onnx_response = await client.get(onnx_url, follow_redirects=True)
            
            if onnx_response.status_code != 200:
                raise Exception(f"Failed to download ONNX model: HTTP {onnx_response.status_code}")
            
            onnx_filename = os.path.basename(onnx_url)
            onnx_path = os.path.join(voice_dir, onnx_filename)
            with open(onnx_path, "wb") as f:
                f.write(onnx_response.content)
            
            logger.info(f"Downloaded ONNX model: {len(onnx_response.content)} bytes")
            
            # Download JSON config
            logger.info(f"Downloading voice config: {json_url}")
            json_response = await client.get(json_url, follow_redirects=True)
            
            if json_response.status_code != 200:
                raise Exception(f"Failed to download JSON config: HTTP {json_response.status_code}")
            
            json_filename = os.path.basename(json_url)
            json_path = os.path.join(voice_dir, json_filename)
            with open(json_path, "wb") as f:
                f.write(json_response.content)
            
            logger.info(f"Downloaded JSON config: {len(json_response.content)} bytes")
        
        # Update metadata
        metadata = load_metadata()
        if "voices" not in metadata:
            metadata["voices"] = {}
        
        metadata["voices"][voice_id] = {
            "id": voice_id,
            "name": name,
            "gender": gender,
            "provider": "piper",
            "model": onnx_filename.replace(".onnx", ""),
            "onnx_path": onnx_path,
            "json_path": json_path,
            "downloaded_at": datetime.utcnow().isoformat()
        }
        save_metadata(metadata)
        
        logger.info(f"Successfully downloaded voice: {voice_id}")
        
        return {
            "success": True,
            "voice_id": voice_id,
            "name": name,
            "message": "Voice downloaded successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to download voice {voice_id}: {e}")
        
        # Clean up partial download
        if os.path.exists(voice_dir):
            shutil.rmtree(voice_dir, ignore_errors=True)
        
        return {
            "success": False,
            "voice_id": voice_id,
            "error": str(e)
        }


def get_downloaded_voices() -> List[Dict[str, Any]]:
    """Get list of downloaded Piper voices."""
    metadata = load_metadata()
    downloaded = list(metadata.get("voices", {}).values())
    
    # Also include built-in voices that are always available
    builtin_voices = list(PIPER_VOICES.values())
    
    # Mark downloaded voices
    downloaded_ids = {v["id"] for v in downloaded}
    for voice in builtin_voices:
        voice["downloaded"] = voice["id"] in downloaded_ids
    
    return builtin_voices + [v for v in downloaded if v["id"] not in {bv["id"] for bv in builtin_voices}]


def delete_voice(voice_id: str) -> bool:
    """Delete a downloaded voice."""
    voice_dir = os.path.join(VOICES_DIR, voice_id)
    
    try:
        if os.path.exists(voice_dir):
            shutil.rmtree(voice_dir)
        
        # Update metadata
        metadata = load_metadata()
        if voice_id in metadata.get("voices", {}):
            del metadata["voices"][voice_id]
            save_metadata(metadata)
        
        logger.info(f"Deleted voice {voice_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete voice {voice_id}: {e}")
        return False
