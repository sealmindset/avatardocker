"""
Avatar Pool Manager - LRU Cache for LiteAvatar Instances

This module provides an LRU (Least Recently Used) cache for managing multiple
LiteAvatar instances. It enables dynamic avatar swapping per persona while
keeping memory usage bounded.

Key Features:
- Caches up to max_size avatar instances (default: 3)
- Evicts least-recently-used avatars when cache is full
- Lazy-loads avatars on first request
- Thread-safe with lock-based concurrency
- Tracks access times for LRU ordering
- Provides cache statistics for monitoring

Usage:
    pool = AvatarPoolManager(
        avatars_base_dir="/app/lite-avatar/data/avatars",
        max_size=3,
        use_gpu=False
    )
    
    # Get avatar instance (loads if not cached)
    avatar = pool.get_avatar("20250408/P1lXrpJL507-PZ4hMPutyF7A")
    
    # Use avatar for rendering
    avatar.handle(audio_path, result_dir)
"""

import os
import time
import threading
import logging
from typing import Dict, Optional, Any, List
from collections import OrderedDict

logger = logging.getLogger(__name__)

# Required files for a valid LiteAvatar
AVATAR_REQUIRED_FILES = [
    "bg_video.mp4",
    "net_encode.pt",
    "net_decode.pt",
    "neutral_pose.npy",
    "face_box.txt",
]


class AvatarPoolManager:
    """
    Manages a pool of LiteAvatar instances with LRU eviction.
    
    Thread-safe implementation that:
    - Caches up to max_size avatar instances
    - Evicts least-recently-used avatars when cache is full
    - Lazy-loads avatars on first request
    - Tracks access times for LRU ordering
    
    Attributes:
        avatars_base_dir: Base directory containing avatar subdirectories
        max_size: Maximum number of avatars to keep in memory
        use_gpu: Whether to enable GPU acceleration (MPS/Metal)
    """
    
    def __init__(
        self,
        avatars_base_dir: str,
        max_size: int = 3,
        use_gpu: bool = False,
        preload_avatar_id: Optional[str] = None
    ):
        """
        Initialize the avatar pool manager.
        
        Args:
            avatars_base_dir: Base directory containing avatar subdirectories
            max_size: Maximum number of avatars to keep in memory (default: 3)
            use_gpu: Whether to enable GPU acceleration (MPS/Metal)
            preload_avatar_id: Optional avatar ID to preload on startup
        """
        self.avatars_base_dir = avatars_base_dir
        self.max_size = max_size
        self.use_gpu = use_gpu
        
        # OrderedDict maintains insertion order, we'll use it for LRU
        # Key: avatar_id, Value: {"instance": liteAvatar, "last_access": timestamp}
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = threading.RLock()
        
        # Statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "load_times": [],
            "errors": 0
        }
        
        logger.info(
            f"AvatarPoolManager initialized: base_dir={avatars_base_dir}, "
            f"max_size={max_size}, use_gpu={use_gpu}"
        )
        
        # Preload default avatar if specified
        if preload_avatar_id:
            logger.info(f"Preloading avatar: {preload_avatar_id}")
            try:
                self.get_avatar(preload_avatar_id)
                logger.info(f"Successfully preloaded avatar: {preload_avatar_id}")
            except Exception as e:
                logger.warning(f"Failed to preload avatar {preload_avatar_id}: {e}")
    
    def get_avatar(self, avatar_id: str, fallback_to_default: bool = True) -> Any:
        """
        Get a LiteAvatar instance for the given avatar_id.
        
        If the avatar is cached, returns immediately and updates access time.
        If not cached, loads from disk (evicting LRU if necessary).
        
        Args:
            avatar_id: The avatar identifier (e.g., "20250408/P1lXrpJL507-PZ4hMPutyF7A")
            fallback_to_default: If True, try to return any cached avatar on error
            
        Returns:
            liteAvatar instance ready for rendering
            
        Raises:
            FileNotFoundError: If avatar directory doesn't exist (and no fallback)
            ValueError: If avatar directory is invalid/incomplete (and no fallback)
        """
        with self._lock:
            # Check if avatar is in cache
            if avatar_id in self._cache:
                # Cache hit - update access time and move to end (most recent)
                self._stats["hits"] += 1
                entry = self._cache.pop(avatar_id)
                entry["last_access"] = time.time()
                self._cache[avatar_id] = entry
                logger.debug(f"Cache hit for avatar {avatar_id}")
                return entry["instance"]
            
            # Cache miss - need to load
            self._stats["misses"] += 1
            logger.info(f"Cache miss for avatar {avatar_id}, loading...")
            
            # Evict LRU if cache is full
            if len(self._cache) >= self.max_size:
                self._evict_lru()
            
            # Load the avatar
            try:
                instance = self._load_avatar(avatar_id)
            except (FileNotFoundError, ValueError) as e:
                # If fallback enabled and we have cached avatars, use one
                if fallback_to_default and self._cache:
                    fallback_id = next(iter(self._cache.keys()))
                    logger.warning(
                        f"Avatar {avatar_id} failed to load: {e}. "
                        f"Falling back to cached avatar: {fallback_id}"
                    )
                    self._stats["fallbacks"] = self._stats.get("fallbacks", 0) + 1
                    return self._cache[fallback_id]["instance"]
                raise
            
            # Add to cache
            self._cache[avatar_id] = {
                "instance": instance,
                "last_access": time.time(),
                "loaded_at": time.time()
            }
            
            return instance
    
    def _load_avatar(self, avatar_id: str) -> Any:
        """
        Load a LiteAvatar instance from disk.
        
        Args:
            avatar_id: The avatar identifier
            
        Returns:
            Initialized liteAvatar instance
            
        Raises:
            FileNotFoundError: If avatar directory doesn't exist
            ValueError: If required files are missing
        """
        from lite_avatar import liteAvatar
        
        # Construct avatar directory path
        avatar_dir = os.path.join(self.avatars_base_dir, avatar_id)
        
        # Validate directory exists
        if not os.path.isdir(avatar_dir):
            self._stats["errors"] += 1
            raise FileNotFoundError(f"Avatar directory not found: {avatar_dir}")
        
        # Validate required files exist
        missing_files = []
        for filename in AVATAR_REQUIRED_FILES:
            filepath = os.path.join(avatar_dir, filename)
            if not os.path.exists(filepath):
                missing_files.append(filename)
        
        if missing_files:
            self._stats["errors"] += 1
            raise ValueError(
                f"Avatar {avatar_id} missing required files: {', '.join(missing_files)}"
            )
        
        # Load the avatar
        start_time = time.time()
        
        try:
            instance = liteAvatar(
                data_dir=avatar_dir,
                num_threads=4 if self.use_gpu else 1,
                generate_offline=True,
                use_gpu=self.use_gpu,
                fps=30
            )
        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"Failed to load avatar {avatar_id}: {e}")
            raise
        
        load_time = time.time() - start_time
        self._stats["load_times"].append(load_time)
        logger.info(f"Loaded avatar {avatar_id} in {load_time:.2f}s")
        
        return instance
    
    def _evict_lru(self):
        """Evict the least recently used avatar from the cache."""
        if not self._cache:
            return
        
        # First item in OrderedDict is the LRU (oldest)
        lru_avatar_id, lru_entry = next(iter(self._cache.items()))
        
        last_access = lru_entry.get("last_access", 0)
        age_seconds = time.time() - last_access
        
        logger.info(
            f"Evicting LRU avatar: {lru_avatar_id} "
            f"(last access: {age_seconds:.0f}s ago)"
        )
        
        # Remove from cache
        del self._cache[lru_avatar_id]
        self._stats["evictions"] += 1
        
        # Explicitly delete instance to free memory
        try:
            del lru_entry["instance"]
        except Exception as e:
            logger.warning(f"Error cleaning up evicted avatar: {e}")
    
    def get_cached_avatars(self) -> List[str]:
        """Get list of currently cached avatar IDs."""
        with self._lock:
            return list(self._cache.keys())
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache metrics including:
            - cache_size: Current number of cached avatars
            - max_size: Maximum cache capacity
            - hits: Number of cache hits
            - misses: Number of cache misses
            - evictions: Number of evictions
            - hit_rate: Cache hit rate as percentage
            - avg_load_time_seconds: Average time to load an avatar
            - cached_avatars: List of currently cached avatar IDs
        """
        with self._lock:
            total_requests = self._stats["hits"] + self._stats["misses"]
            hit_rate = (
                self._stats["hits"] / total_requests
                if total_requests > 0 else 0
            )
            
            avg_load_time = (
                sum(self._stats["load_times"]) / len(self._stats["load_times"])
                if self._stats["load_times"] else 0
            )
            
            # Get cache details
            cache_details = []
            for avatar_id, entry in self._cache.items():
                age = time.time() - entry.get("loaded_at", 0)
                last_access_age = time.time() - entry.get("last_access", 0)
                cache_details.append({
                    "avatar_id": avatar_id,
                    "loaded_seconds_ago": round(age, 1),
                    "last_access_seconds_ago": round(last_access_age, 1)
                })
            
            return {
                "cache_size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "evictions": self._stats["evictions"],
                "errors": self._stats["errors"],
                "fallbacks": self._stats.get("fallbacks", 0),
                "hit_rate": f"{hit_rate:.1%}",
                "avg_load_time_seconds": round(avg_load_time, 2),
                "cached_avatars": list(self._cache.keys()),
                "cache_details": cache_details,
                "use_gpu": self.use_gpu,
                "avatars_base_dir": self.avatars_base_dir
            }
    
    def preload_avatars(self, avatar_ids: List[str]) -> Dict[str, Any]:
        """
        Preload multiple avatars into the cache.
        
        Useful for warming the cache with expected avatars.
        Only loads up to max_size avatars.
        
        Args:
            avatar_ids: List of avatar IDs to preload
            
        Returns:
            Dictionary with preload results
        """
        results = {
            "requested": len(avatar_ids),
            "loaded": [],
            "failed": [],
            "skipped": []
        }
        
        for avatar_id in avatar_ids[:self.max_size]:
            # Skip if already cached
            if avatar_id in self._cache:
                results["skipped"].append(avatar_id)
                continue
            
            try:
                self.get_avatar(avatar_id)
                results["loaded"].append(avatar_id)
            except Exception as e:
                logger.warning(f"Failed to preload avatar {avatar_id}: {e}")
                results["failed"].append({
                    "avatar_id": avatar_id,
                    "error": str(e)
                })
        
        logger.info(
            f"Preload complete: {len(results['loaded'])} loaded, "
            f"{len(results['skipped'])} skipped, {len(results['failed'])} failed"
        )
        
        return results
    
    def clear_cache(self) -> Dict[str, Any]:
        """
        Clear all cached avatars.
        
        Returns:
            Dictionary with clear results
        """
        with self._lock:
            cleared_count = len(self._cache)
            cleared_avatars = list(self._cache.keys())
            
            # Clean up instances
            for avatar_id, entry in self._cache.items():
                try:
                    del entry["instance"]
                except Exception as e:
                    logger.warning(f"Error cleaning up avatar {avatar_id}: {e}")
            
            self._cache.clear()
            
            logger.info(f"Avatar cache cleared: {cleared_count} avatars removed")
            
            return {
                "cleared_count": cleared_count,
                "cleared_avatars": cleared_avatars
            }
    
    def is_avatar_available(self, avatar_id: str) -> bool:
        """
        Check if an avatar exists on disk (not necessarily cached).
        
        Args:
            avatar_id: The avatar identifier
            
        Returns:
            True if avatar directory exists with required files
        """
        avatar_dir = os.path.join(self.avatars_base_dir, avatar_id)
        
        if not os.path.isdir(avatar_dir):
            return False
        
        # Check required files
        for filename in AVATAR_REQUIRED_FILES:
            if not os.path.exists(os.path.join(avatar_dir, filename)):
                return False
        
        return True
    
    def is_avatar_cached(self, avatar_id: str) -> bool:
        """
        Check if an avatar is currently in the cache.
        
        Args:
            avatar_id: The avatar identifier
            
        Returns:
            True if avatar is cached
        """
        with self._lock:
            return avatar_id in self._cache
    
    def get_available_avatars(self) -> List[Dict[str, Any]]:
        """
        List all available avatars on disk.
        
        Returns:
            List of dictionaries with avatar info
        """
        available = []
        
        if not os.path.isdir(self.avatars_base_dir):
            return available
        
        # Walk through batch directories
        for batch_id in os.listdir(self.avatars_base_dir):
            batch_dir = os.path.join(self.avatars_base_dir, batch_id)
            
            if not os.path.isdir(batch_dir):
                continue
            
            # Check each avatar in the batch
            for avatar_name in os.listdir(batch_dir):
                avatar_dir = os.path.join(batch_dir, avatar_name)
                
                if not os.path.isdir(avatar_dir):
                    continue
                
                avatar_id = f"{batch_id}/{avatar_name}"
                
                # Check if valid avatar
                if self.is_avatar_available(avatar_id):
                    # Calculate size
                    size_bytes = sum(
                        os.path.getsize(os.path.join(avatar_dir, f))
                        for f in os.listdir(avatar_dir)
                        if os.path.isfile(os.path.join(avatar_dir, f))
                    )
                    
                    available.append({
                        "id": avatar_id,
                        "batch": batch_id,
                        "name": avatar_name,
                        "path": avatar_dir,
                        "size_mb": round(size_bytes / (1024 * 1024), 2),
                        "cached": self.is_avatar_cached(avatar_id)
                    })
        
        return available
    
    def remove_from_cache(self, avatar_id: str) -> bool:
        """
        Remove a specific avatar from the cache.
        
        Args:
            avatar_id: The avatar identifier to remove
            
        Returns:
            True if avatar was removed, False if not in cache
        """
        with self._lock:
            if avatar_id not in self._cache:
                return False
            
            entry = self._cache.pop(avatar_id)
            
            try:
                del entry["instance"]
            except Exception as e:
                logger.warning(f"Error cleaning up avatar {avatar_id}: {e}")
            
            logger.info(f"Removed avatar from cache: {avatar_id}")
            return True
