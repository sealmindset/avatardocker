"""
LiteAvatar API Server

FastAPI wrapper for LiteAvatar that provides:
- POST /render - Generate avatar video from audio (with optional avatar_id)
- GET /health - Health check
- GET /avatars - List available avatars
- GET /cache/stats - Cache statistics
- POST /cache/preload - Preload avatars into cache
- POST /cache/clear - Clear avatar cache

Supports dynamic avatar swapping via LRU cache (AvatarPoolManager).
"""

import os
import io
import sys
import base64
import tempfile
import shutil
import logging
import argparse
import asyncio
import concurrent.futures
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from avatar_pool import AvatarPoolManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check for MPS/Metal GPU support (Apple Silicon)
def check_gpu_support():
    """Check if MPS (Metal) GPU acceleration is available."""
    try:
        import torch
        if torch.backends.mps.is_available() and torch.backends.mps.is_built():
            logger.info("✅ MPS/Metal GPU acceleration available")
            return True
        else:
            logger.info("⚠️ MPS not available, using CPU")
            return False
    except ImportError:
        logger.info("⚠️ PyTorch not installed, using CPU")
        return False

# Global GPU flag - set based on environment or detection
_use_gpu = os.environ.get("AVATAR_USE_GPU", "false").lower() == "true"
if _use_gpu:
    _use_gpu = check_gpu_support()

# Feature flag for avatar pool (dynamic avatar swapping)
_use_avatar_pool = os.environ.get("FEATURE_AVATAR_POOL", "true").lower() == "true"

app = FastAPI(
    title="LiteAvatar API",
    description="Generate talking avatar videos from audio",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global avatar instance (lazy loaded) - legacy single-avatar mode
_avatar_instance = None
_avatar_data_dir = os.environ.get("AVATAR_DATA_DIR", "/app/lite-avatar/data/sample_data/preload")
_init_error = None

# Avatar pool manager for dynamic avatar swapping
_avatar_pool: Optional[AvatarPoolManager] = None
_avatars_base_dir = os.environ.get("AVATARS_BASE_DIR", "/app/lite-avatar/data/avatars")
_default_avatar_id = os.environ.get("DEFAULT_AVATAR_ID", None)
_avatar_cache_size = int(os.environ.get("AVATAR_CACHE_SIZE", "3"))


def get_avatar_pool() -> AvatarPoolManager:
    """Get or initialize the avatar pool manager."""
    global _avatar_pool
    if _avatar_pool is None:
        logger.info(
            f"Initializing AvatarPoolManager: base_dir={_avatars_base_dir}, "
            f"cache_size={_avatar_cache_size}, gpu={_use_gpu}"
        )
        _avatar_pool = AvatarPoolManager(
            avatars_base_dir=_avatars_base_dir,
            max_size=_avatar_cache_size,
            use_gpu=_use_gpu,
            preload_avatar_id=_default_avatar_id
        )
    return _avatar_pool


def get_avatar():
    """Lazy load the avatar instance (legacy single-avatar mode)."""
    global _avatar_instance, _init_error, _use_gpu
    if _init_error:
        raise _init_error
    if _avatar_instance is None:
        try:
            logger.info(f"Initializing LiteAvatar (GPU: {_use_gpu})...")
            from lite_avatar import liteAvatar
            _avatar_instance = liteAvatar(
                data_dir=_avatar_data_dir,
                num_threads=4 if _use_gpu else 1,
                generate_offline=True,
                use_gpu=_use_gpu,
                fps=30
            )
            logger.info("LiteAvatar initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LiteAvatar: {e}")
            _init_error = e
            raise
    return _avatar_instance


def get_avatar_for_render(avatar_id: Optional[str] = None):
    """
    Get avatar instance for rendering.
    
    If avatar pool is enabled and avatar_id is provided, uses the pool.
    Otherwise falls back to legacy single-avatar mode.
    """
    if _use_avatar_pool and avatar_id and avatar_id != "default":
        pool = get_avatar_pool()
        if pool.is_avatar_available(avatar_id):
            logger.info(f"Using avatar from pool: {avatar_id}")
            return pool.get_avatar(avatar_id)
        else:
            logger.warning(f"Avatar {avatar_id} not available, falling back to default")
    
    # Fallback to legacy single-avatar mode
    return get_avatar()


@app.on_event("startup")
async def startup_event_init():
    """Pre-initialize LiteAvatar on startup to avoid lazy loading issues."""
    logger.info("Pre-initializing LiteAvatar on startup...")
    
    if _use_avatar_pool:
        logger.info("Avatar pool mode enabled")
        try:
            pool = get_avatar_pool()
            logger.info(f"Avatar pool initialized: {pool.get_stats()}")
        except Exception as e:
            logger.error(f"Avatar pool initialization failed: {e}")
    else:
        logger.info("Legacy single-avatar mode")
        try:
            get_avatar()
            logger.info("LiteAvatar pre-initialization complete")
        except Exception as e:
            logger.error(f"LiteAvatar pre-initialization failed: {e}")


class RenderRequest(BaseModel):
    """Request body for audio-based rendering."""
    audio_base64: str
    avatar_id: Optional[str] = "default"


class RenderResponse(BaseModel):
    """Response with rendered video."""
    video_base64: str
    duration_seconds: float
    frames: int


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    response = {
        "status": "healthy",
        "service": "lite-avatar",
        "avatar_data_dir": _avatar_data_dir,
        "initialized": _avatar_instance is not None,
        "avatar_pool_enabled": _use_avatar_pool
    }
    
    if _use_avatar_pool and _avatar_pool is not None:
        response["pool_stats"] = _avatar_pool.get_stats()
    
    return response


@app.get("/avatars")
async def list_avatars():
    """List available avatar characters."""
    # Check multiple possible locations for avatar data
    search_dirs = [
        "/app/lite-avatar/data/sample_data/preload",
        "/app/lite-avatar/data/sample_data",
        "/app/lite-avatar/data",
        _avatar_data_dir,
    ]
    available = []
    
    for avatars_dir in search_dirs:
        if os.path.exists(avatars_dir):
            # Check if this directory itself is an avatar
            has_bg = os.path.exists(os.path.join(avatars_dir, "bg_video.mp4"))
            has_encoder = os.path.exists(os.path.join(avatars_dir, "net_encode.pt"))
            if has_bg and has_encoder:
                dir_name = os.path.basename(avatars_dir)
                available.append({
                    "id": dir_name,
                    "name": dir_name.replace("_", " ").title(),
                    "path": avatars_dir
                })
            
            # Also check subdirectories
            for item in os.listdir(avatars_dir):
                item_path = os.path.join(avatars_dir, item)
                if os.path.isdir(item_path):
                    has_bg = os.path.exists(os.path.join(item_path, "bg_video.mp4"))
                    has_encoder = os.path.exists(os.path.join(item_path, "net_encode.pt"))
                    if has_bg and has_encoder:
                        available.append({
                            "id": item,
                            "name": item.replace("_", " ").title(),
                            "path": item_path
                        })
    
    # Remove duplicates based on path
    seen_paths = set()
    unique_avatars = []
    for avatar in available:
        if avatar["path"] not in seen_paths:
            seen_paths.add(avatar["path"])
            unique_avatars.append(avatar)
    
    return {"avatars": unique_avatars}


# Maximum audio duration in seconds to prevent OOM
# With 12GB+ Docker memory, 30 seconds should be safe
MAX_AUDIO_DURATION_SECONDS = 30.0

# Minimum audio duration in seconds to avoid ONNX model dimension errors
# The model expects at least 30 frames of input (~1 second at 30fps)
MIN_AUDIO_DURATION_SECONDS = 1.5

# Render timeout in seconds - prevents blocking on stuck renders
RENDER_TIMEOUT_SECONDS = 120

# Thread pool for running blocking render operations
_render_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)


def _render_sync(audio_bytes: bytes, avatar_id: str) -> dict:
    """
    Synchronous render function to run in thread pool.
    Returns dict with video_base64, duration_seconds, frames.
    
    Args:
        audio_bytes: WAV audio data
        avatar_id: Avatar identifier for pool lookup (or "default" for legacy mode)
    """
    from pydub import AudioSegment
    import cv2
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Save audio to temp file
        audio_path = os.path.join(temp_dir, "input.wav")
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
        
        # Check and limit audio duration to prevent OOM
        audio = AudioSegment.from_wav(audio_path)
        duration_seconds = len(audio) / 1000.0
        
        if duration_seconds > MAX_AUDIO_DURATION_SECONDS:
            logger.warning(f"Audio too long ({duration_seconds:.1f}s), truncating to {MAX_AUDIO_DURATION_SECONDS}s")
            truncated = audio[:int(MAX_AUDIO_DURATION_SECONDS * 1000)]
            truncated.export(audio_path, format="wav")
            duration_seconds = MAX_AUDIO_DURATION_SECONDS
        
        # Pad short audio to avoid ONNX model dimension errors
        if duration_seconds < MIN_AUDIO_DURATION_SECONDS:
            logger.warning(f"Audio too short ({duration_seconds:.2f}s), padding to {MIN_AUDIO_DURATION_SECONDS}s")
            silence_duration_ms = int((MIN_AUDIO_DURATION_SECONDS - duration_seconds) * 1000)
            silence = AudioSegment.silent(duration=silence_duration_ms, frame_rate=audio.frame_rate)
            padded = audio + silence
            padded.export(audio_path, format="wav")
            duration_seconds = MIN_AUDIO_DURATION_SECONDS
        
        # Get avatar instance (from pool if enabled, otherwise legacy)
        avatar = get_avatar_for_render(avatar_id)
        
        # Render video
        result_dir = os.path.join(temp_dir, "output")
        os.makedirs(result_dir, exist_ok=True)
        
        logger.info(f"Rendering avatar video from audio: {len(audio_bytes)} bytes (avatar_id={avatar_id})")
        avatar.handle(audio_path, result_dir)
        
        # Read output video
        video_path = os.path.join(result_dir, "test_demo.mp4")
        if not os.path.exists(video_path):
            raise Exception("Video generation failed - no output file")
        
        with open(video_path, "rb") as f:
            video_bytes = f.read()
        
        video_base64 = base64.b64encode(video_bytes).decode("utf-8")
        
        # Get video info
        cap = cv2.VideoCapture(video_path)
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = frames / fps if fps > 0 else 0
        cap.release()
        
        logger.info(f"Video rendered: {frames} frames, {duration:.2f}s")
        
        return {
            "video_base64": video_base64,
            "duration_seconds": duration,
            "frames": frames
        }


@app.post("/render", response_model=RenderResponse)
async def render_avatar(request: RenderRequest):
    """
    Render avatar video from audio.
    
    Accepts base64-encoded audio (WAV format, 16kHz, mono).
    Returns base64-encoded MP4 video.
    Audio is limited to 30 seconds to prevent memory issues.
    Includes timeout to prevent blocking on stuck renders.
    """
    try:
        # Decode audio
        audio_bytes = base64.b64decode(request.audio_base64)
        
        # Run render in thread pool with timeout
        loop = asyncio.get_event_loop()
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    _render_executor,
                    _render_sync,
                    audio_bytes,
                    request.avatar_id or "default"
                ),
                timeout=RENDER_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            logger.error(f"Render timed out after {RENDER_TIMEOUT_SECONDS}s")
            raise HTTPException(
                status_code=504,
                detail=f"Render timed out after {RENDER_TIMEOUT_SECONDS} seconds"
            )
        
        return RenderResponse(
            video_base64=result["video_base64"],
            duration_seconds=result["duration_seconds"],
            frames=result["frames"]
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Render error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/render/upload")
async def render_avatar_upload(
    audio: UploadFile = File(...),
    avatar_id: str = Form(default="default")
):
    """
    Render avatar video from uploaded audio file.
    
    Returns the video file directly.
    """
    try:
        audio_bytes = await audio.read()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = os.path.join(temp_dir, "input.wav")
            with open(audio_path, "wb") as f:
                f.write(audio_bytes)
            
            avatar = get_avatar()
            
            result_dir = os.path.join(temp_dir, "output")
            os.makedirs(result_dir, exist_ok=True)
            
            avatar.handle(audio_path, result_dir)
            
            video_path = os.path.join(result_dir, "test_demo.mp4")
            if not os.path.exists(video_path):
                raise HTTPException(status_code=500, detail="Video generation failed")
            
            # Copy to a persistent location for response
            output_path = f"/tmp/avatar_output_{os.getpid()}.mp4"
            shutil.copy(video_path, output_path)
            
            return FileResponse(
                output_path,
                media_type="video/mp4",
                filename="avatar.mp4"
            )
            
    except Exception as e:
        logger.error(f"Render upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Pre-rendered loop video storage
# Use environment variable or derive from AVATAR_DATA_DIR
_base_data_dir = os.path.dirname(_avatar_data_dir) if _avatar_data_dir else "/app/lite-avatar/data"
LOOPS_DIR = os.environ.get("LOOPS_DIR", os.path.join(_base_data_dir, "loops"))
os.makedirs(LOOPS_DIR, exist_ok=True)


@app.get("/loops/status")
async def get_loops_status():
    """Check if loop videos have been generated."""
    idle_exists = os.path.exists(os.path.join(LOOPS_DIR, "idle.mp4"))
    talking_exists = os.path.exists(os.path.join(LOOPS_DIR, "talking.mp4"))
    
    return {
        "idle": idle_exists,
        "talking": talking_exists,
        "ready": idle_exists and talking_exists
    }


@app.get("/loops/{loop_type}")
async def get_loop_video(loop_type: str):
    """
    Get a pre-rendered loop video.
    
    loop_type: "idle" or "talking"
    Returns the video file directly.
    """
    if loop_type not in ["idle", "talking"]:
        raise HTTPException(status_code=400, detail="Invalid loop type. Use 'idle' or 'talking'")
    
    video_path = os.path.join(LOOPS_DIR, f"{loop_type}.mp4")
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Loop video '{loop_type}' not generated yet. Call POST /loops/generate first.")
    
    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename=f"{loop_type}.mp4"
    )


class LoopGenerateRequest(BaseModel):
    avatar_id: Optional[str] = None


@app.post("/loops/generate")
async def generate_loop_videos(request: LoopGenerateRequest = None):
    """
    Generate pre-rendered loop videos for idle and talking states.
    
    This creates short looping videos that can be played instantly.
    Supports avatar_id parameter for dynamic avatar swapping.
    """
    try:
        # Get avatar_id from request body if provided
        avatar_id = request.avatar_id if request else None
        
        # Use avatar pool if enabled and avatar_id provided
        if _use_avatar_pool and avatar_id:
            avatar = get_avatar_for_render(avatar_id)
            # Get the avatar's data directory for bg_video
            avatar_data_dir = os.path.join(_avatars_base_dir, avatar_id)
        else:
            avatar = get_avatar()
            avatar_data_dir = _avatar_data_dir
        
        # Generate idle loop (silent - just the background video looped)
        idle_path = os.path.join(LOOPS_DIR, "idle.mp4")
        bg_video_path = os.path.join(avatar_data_dir, "bg_video.mp4")
        
        if os.path.exists(bg_video_path):
            # Use ffmpeg to create a seamless loop from bg_video
            import subprocess
            # Create a 3-second idle loop from the background video
            subprocess.run([
                "ffmpeg", "-y", "-i", bg_video_path,
                "-t", "3", "-c:v", "libx264", "-preset", "fast",
                "-an", idle_path
            ], check=True, capture_output=True)
            logger.info(f"Generated idle loop: {idle_path}")
        
        # Generate talking loop using real TTS speech audio
        talking_path = os.path.join(LOOPS_DIR, "talking.mp4")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Use Piper TTS to generate real speech audio for proper lip-sync
            import requests
            from pydub import AudioSegment
            
            # Sample text that creates varied mouth movements (tongue twister for good lip-sync)
            sample_text = "Peter Piper Picked a Peck of Pickle Peppers, how many Pickle Peppers did Peter Pick? A Peck of Pickle Peppers!"
            
            audio_path = os.path.join(temp_dir, "talking_audio.wav")
            
            # Try to get audio from Piper TTS (container name is piper-tts on port 8000)
            piper_url = os.environ.get("PIPER_TTS_URL", "http://piper-tts:8000")
            try:
                logger.info(f"Generating TTS audio from Piper at {piper_url}")
                response = requests.post(
                    f"{piper_url}/tts",
                    json={"input": sample_text},
                    timeout=30
                )
                if response.status_code == 200:
                    # Piper TTS returns JSON with base64-encoded audio
                    tts_data = response.json()
                    audio_b64 = tts_data.get("audio_base64", "")
                    audio_bytes = base64.b64decode(audio_b64)
                    with open(audio_path, "wb") as f:
                        f.write(audio_bytes)
                    logger.info(f"TTS audio generated: {len(audio_bytes)} bytes")
                else:
                    raise Exception(f"Piper TTS returned {response.status_code}")
            except Exception as e:
                logger.warning(f"Piper TTS failed: {e}, using fallback audio")
                # Fallback: create a simple audio file with espeak or silence
                # Use pydub to create varied tones as fallback
                from pydub.generators import Sine
                import random
                
                audio = AudioSegment.silent(duration=0)
                # Create speech-like patterns with more variation
                for i in range(30):
                    freq = 150 + random.randint(0, 200)
                    duration = 50 + random.randint(0, 150)
                    pause = 20 + random.randint(0, 80)
                    tone = Sine(freq).to_audio_segment(duration=duration)
                    tone = tone.fade_in(10).fade_out(10)
                    audio += tone + AudioSegment.silent(duration=pause)
                audio.export(audio_path, format="wav")
            
            result_dir = os.path.join(temp_dir, "output")
            os.makedirs(result_dir, exist_ok=True)
            
            avatar.handle(audio_path, result_dir)
            
            video_path = os.path.join(result_dir, "test_demo.mp4")
            if os.path.exists(video_path):
                # Remove audio from the talking loop (we'll play TTS separately)
                subprocess.run([
                    "ffmpeg", "-y", "-i", video_path,
                    "-c:v", "libx264", "-preset", "fast",
                    "-an", talking_path
                ], check=True, capture_output=True)
                logger.info(f"Generated talking loop: {talking_path}")
        
        return {
            "status": "success",
            "loops": {
                "idle": os.path.exists(idle_path),
                "talking": os.path.exists(talking_path)
            }
        }
        
    except Exception as e:
        logger.error(f"Loop generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CACHE MANAGEMENT ENDPOINTS
# ============================================================================

class PreloadRequest(BaseModel):
    """Request body for preloading avatars."""
    avatar_ids: List[str]


@app.get("/cache/stats")
async def get_cache_stats():
    """
    Get avatar cache statistics.
    
    Returns cache metrics including hit rate, evictions, and cached avatars.
    Only available when avatar pool mode is enabled.
    """
    if not _use_avatar_pool:
        return {
            "status": "disabled",
            "message": "Avatar pool mode is not enabled. Set FEATURE_AVATAR_POOL=true to enable."
        }
    
    pool = get_avatar_pool()
    return pool.get_stats()


@app.post("/cache/preload")
async def preload_avatars(request: PreloadRequest):
    """
    Preload specific avatars into the cache.
    
    Useful for warming the cache before a training session starts.
    Only loads up to max_size avatars.
    """
    if not _use_avatar_pool:
        raise HTTPException(
            status_code=400,
            detail="Avatar pool mode is not enabled. Set FEATURE_AVATAR_POOL=true to enable."
        )
    
    pool = get_avatar_pool()
    result = pool.preload_avatars(request.avatar_ids)
    
    return {
        "status": "success",
        "result": result,
        "cached_avatars": pool.get_cached_avatars()
    }


@app.post("/cache/clear")
async def clear_cache():
    """
    Clear the avatar cache.
    
    Frees memory by removing all cached avatar instances.
    """
    if not _use_avatar_pool:
        raise HTTPException(
            status_code=400,
            detail="Avatar pool mode is not enabled. Set FEATURE_AVATAR_POOL=true to enable."
        )
    
    pool = get_avatar_pool()
    result = pool.clear_cache()
    
    return {
        "status": "success",
        "result": result
    }


@app.delete("/cache/{avatar_id:path}")
async def remove_from_cache(avatar_id: str):
    """
    Remove a specific avatar from the cache.
    
    Useful for freeing memory for a specific avatar without clearing entire cache.
    """
    if not _use_avatar_pool:
        raise HTTPException(
            status_code=400,
            detail="Avatar pool mode is not enabled. Set FEATURE_AVATAR_POOL=true to enable."
        )
    
    pool = get_avatar_pool()
    removed = pool.remove_from_cache(avatar_id)
    
    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"Avatar {avatar_id} is not in the cache"
        )
    
    return {
        "status": "success",
        "removed": avatar_id,
        "cached_avatars": pool.get_cached_avatars()
    }


@app.get("/cache/available")
async def list_available_avatars():
    """
    List all available avatars on disk.
    
    Shows which avatars can be loaded and their cache status.
    """
    if not _use_avatar_pool:
        raise HTTPException(
            status_code=400,
            detail="Avatar pool mode is not enabled. Set FEATURE_AVATAR_POOL=true to enable."
        )
    
    pool = get_avatar_pool()
    return {
        "avatars": pool.get_available_avatars(),
        "cache_stats": pool.get_stats()
    }


if __name__ == "__main__":
    import uvicorn
    
    parser = argparse.ArgumentParser(description="LiteAvatar API Server")
    parser.add_argument("--port", type=int, default=8080, help="Port to run on (default: 8080)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")
    parser.add_argument("--gpu", action="store_true", help="Enable GPU acceleration (MPS/Metal)")
    args = parser.parse_args()
    
    # Override GPU setting from command line
    if args.gpu:
        _use_gpu = check_gpu_support()
        logger.info(f"GPU mode requested, available: {_use_gpu}")
    
    logger.info(f"Starting LiteAvatar API on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)
