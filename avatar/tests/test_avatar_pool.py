"""
Unit tests for AvatarPoolManager

Tests cover:
- Cache hit/miss behavior
- LRU eviction
- Thread safety
- Error handling
- Statistics tracking
- Preloading
"""

import os
import sys
import time
import threading
import tempfile
import shutil
import pytest
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from avatar_pool import AvatarPoolManager, AVATAR_REQUIRED_FILES


class MockLiteAvatar:
    """Mock LiteAvatar class for testing without actual model loading."""
    
    def __init__(self, data_dir, num_threads=1, generate_offline=True, use_gpu=False, fps=30):
        self.data_dir = data_dir
        self.num_threads = num_threads
        self.generate_offline = generate_offline
        self.use_gpu = use_gpu
        self.fps = fps
        self._id = id(self)
    
    def handle(self, audio_path, result_dir):
        """Mock handle method."""
        pass


@pytest.fixture
def temp_avatars_dir():
    """Create a temporary directory with mock avatar data."""
    temp_dir = tempfile.mkdtemp()
    
    # Create mock avatar directories
    avatars = [
        "20250408/avatar_a",
        "20250408/avatar_b",
        "20250408/avatar_c",
        "20250408/avatar_d",
    ]
    
    for avatar_id in avatars:
        avatar_dir = os.path.join(temp_dir, avatar_id)
        os.makedirs(avatar_dir, exist_ok=True)
        
        # Create required files
        for filename in AVATAR_REQUIRED_FILES:
            filepath = os.path.join(avatar_dir, filename)
            with open(filepath, "w") as f:
                f.write(f"mock {filename}")
    
    yield temp_dir
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def pool_manager(temp_avatars_dir):
    """Create an AvatarPoolManager with mocked LiteAvatar."""
    with patch("avatar_pool.liteAvatar", MockLiteAvatar):
        pool = AvatarPoolManager(
            avatars_base_dir=temp_avatars_dir,
            max_size=2,
            use_gpu=False
        )
        yield pool


@pytest.fixture
def pool_manager_size_3(temp_avatars_dir):
    """Create an AvatarPoolManager with max_size=3."""
    with patch("avatar_pool.liteAvatar", MockLiteAvatar):
        pool = AvatarPoolManager(
            avatars_base_dir=temp_avatars_dir,
            max_size=3,
            use_gpu=False
        )
        yield pool


class TestAvatarPoolManagerBasic:
    """Basic functionality tests."""
    
    def test_initialization(self, temp_avatars_dir):
        """Test pool manager initializes correctly."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3,
                use_gpu=False
            )
            
            assert pool.avatars_base_dir == temp_avatars_dir
            assert pool.max_size == 3
            assert pool.use_gpu is False
            assert len(pool._cache) == 0
    
    def test_initialization_with_preload(self, temp_avatars_dir):
        """Test pool manager preloads avatar on init."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3,
                use_gpu=False,
                preload_avatar_id="20250408/avatar_a"
            )
            
            assert len(pool._cache) == 1
            assert "20250408/avatar_a" in pool._cache
    
    def test_get_avatar_loads_on_miss(self, pool_manager):
        """Test that get_avatar loads avatar on cache miss."""
        avatar_id = "20250408/avatar_a"
        
        # Initially empty
        assert len(pool_manager._cache) == 0
        
        # Get avatar
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            avatar = pool_manager.get_avatar(avatar_id)
        
        # Should be cached now
        assert len(pool_manager._cache) == 1
        assert avatar_id in pool_manager._cache
        assert avatar is not None
    
    def test_get_avatar_returns_cached(self, pool_manager):
        """Test that get_avatar returns cached instance on hit."""
        avatar_id = "20250408/avatar_a"
        
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # First call - cache miss
            avatar1 = pool_manager.get_avatar(avatar_id)
            
            # Second call - cache hit
            avatar2 = pool_manager.get_avatar(avatar_id)
        
        # Should be the same instance
        assert avatar1 is avatar2
        
        # Stats should reflect hit
        stats = pool_manager.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1


class TestCacheEviction:
    """Tests for LRU cache eviction."""
    
    def test_eviction_when_full(self, pool_manager):
        """Test that LRU avatar is evicted when cache is full."""
        # pool_manager has max_size=2
        
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # Load 2 avatars (fills cache)
            pool_manager.get_avatar("20250408/avatar_a")
            pool_manager.get_avatar("20250408/avatar_b")
            
            assert len(pool_manager._cache) == 2
            
            # Load 3rd avatar (should evict avatar_a)
            pool_manager.get_avatar("20250408/avatar_c")
        
        assert len(pool_manager._cache) == 2
        assert "20250408/avatar_a" not in pool_manager._cache
        assert "20250408/avatar_b" in pool_manager._cache
        assert "20250408/avatar_c" in pool_manager._cache
        
        stats = pool_manager.get_stats()
        assert stats["evictions"] == 1
    
    def test_lru_order_updated_on_access(self, pool_manager):
        """Test that accessing an avatar updates its LRU position."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # Load a and b
            pool_manager.get_avatar("20250408/avatar_a")
            pool_manager.get_avatar("20250408/avatar_b")
            
            # Access a again (makes b the LRU)
            pool_manager.get_avatar("20250408/avatar_a")
            
            # Load c (should evict b, not a)
            pool_manager.get_avatar("20250408/avatar_c")
        
        assert "20250408/avatar_a" in pool_manager._cache
        assert "20250408/avatar_b" not in pool_manager._cache
        assert "20250408/avatar_c" in pool_manager._cache
    
    def test_multiple_evictions(self, pool_manager):
        """Test multiple sequential evictions."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # Load all 4 avatars sequentially (max_size=2)
            pool_manager.get_avatar("20250408/avatar_a")
            pool_manager.get_avatar("20250408/avatar_b")
            pool_manager.get_avatar("20250408/avatar_c")
            pool_manager.get_avatar("20250408/avatar_d")
        
        # Only last 2 should be cached
        assert len(pool_manager._cache) == 2
        assert "20250408/avatar_c" in pool_manager._cache
        assert "20250408/avatar_d" in pool_manager._cache
        
        stats = pool_manager.get_stats()
        assert stats["evictions"] == 2


class TestErrorHandling:
    """Tests for error handling."""
    
    def test_nonexistent_avatar_raises_error(self, pool_manager):
        """Test that requesting non-existent avatar raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            pool_manager.get_avatar("nonexistent/avatar")
    
    def test_incomplete_avatar_raises_error(self, temp_avatars_dir):
        """Test that avatar with missing files raises ValueError."""
        # Create incomplete avatar directory
        incomplete_dir = os.path.join(temp_avatars_dir, "20250408/incomplete")
        os.makedirs(incomplete_dir, exist_ok=True)
        
        # Only create some files
        with open(os.path.join(incomplete_dir, "bg_video.mp4"), "w") as f:
            f.write("mock")
        
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=2
            )
            
            with pytest.raises(ValueError) as exc_info:
                pool.get_avatar("20250408/incomplete")
            
            assert "missing required files" in str(exc_info.value)
    
    def test_error_increments_stats(self, pool_manager):
        """Test that errors increment error counter."""
        initial_errors = pool_manager._stats["errors"]
        
        try:
            pool_manager.get_avatar("nonexistent/avatar")
        except FileNotFoundError:
            pass
        
        assert pool_manager._stats["errors"] == initial_errors + 1


class TestStatistics:
    """Tests for statistics tracking."""
    
    def test_initial_stats(self, pool_manager):
        """Test initial statistics are zero."""
        stats = pool_manager.get_stats()
        
        assert stats["cache_size"] == 0
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["evictions"] == 0
        assert stats["hit_rate"] == "0.0%"
    
    def test_stats_after_operations(self, pool_manager):
        """Test statistics after various operations."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # Miss
            pool_manager.get_avatar("20250408/avatar_a")
            # Hit
            pool_manager.get_avatar("20250408/avatar_a")
            # Miss
            pool_manager.get_avatar("20250408/avatar_b")
            # Miss + eviction
            pool_manager.get_avatar("20250408/avatar_c")
        
        stats = pool_manager.get_stats()
        
        assert stats["hits"] == 1
        assert stats["misses"] == 3
        assert stats["evictions"] == 1
        assert stats["hit_rate"] == "25.0%"
        assert stats["cache_size"] == 2
    
    def test_load_time_tracking(self, pool_manager):
        """Test that load times are tracked."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool_manager.get_avatar("20250408/avatar_a")
        
        stats = pool_manager.get_stats()
        
        assert stats["avg_load_time_seconds"] >= 0
        assert len(pool_manager._stats["load_times"]) == 1


class TestPreloading:
    """Tests for avatar preloading."""
    
    def test_preload_avatars(self, pool_manager_size_3):
        """Test preloading multiple avatars."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            result = pool_manager_size_3.preload_avatars([
                "20250408/avatar_a",
                "20250408/avatar_b"
            ])
        
        assert len(result["loaded"]) == 2
        assert len(result["failed"]) == 0
        assert len(pool_manager_size_3._cache) == 2
    
    def test_preload_skips_cached(self, pool_manager_size_3):
        """Test that preload skips already cached avatars."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # Pre-cache one avatar
            pool_manager_size_3.get_avatar("20250408/avatar_a")
            
            # Preload including the cached one
            result = pool_manager_size_3.preload_avatars([
                "20250408/avatar_a",
                "20250408/avatar_b"
            ])
        
        assert "20250408/avatar_a" in result["skipped"]
        assert "20250408/avatar_b" in result["loaded"]
    
    def test_preload_respects_max_size(self, pool_manager):
        """Test that preload respects max_size limit."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            # Try to preload 4 avatars (max_size=2)
            result = pool_manager.preload_avatars([
                "20250408/avatar_a",
                "20250408/avatar_b",
                "20250408/avatar_c",
                "20250408/avatar_d"
            ])
        
        # Should only load first 2
        assert len(result["loaded"]) == 2
        assert len(pool_manager._cache) == 2


class TestCacheManagement:
    """Tests for cache management operations."""
    
    def test_clear_cache(self, pool_manager):
        """Test clearing the cache."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool_manager.get_avatar("20250408/avatar_a")
            pool_manager.get_avatar("20250408/avatar_b")
        
        assert len(pool_manager._cache) == 2
        
        result = pool_manager.clear_cache()
        
        assert result["cleared_count"] == 2
        assert len(pool_manager._cache) == 0
    
    def test_remove_from_cache(self, pool_manager):
        """Test removing specific avatar from cache."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool_manager.get_avatar("20250408/avatar_a")
            pool_manager.get_avatar("20250408/avatar_b")
        
        result = pool_manager.remove_from_cache("20250408/avatar_a")
        
        assert result is True
        assert "20250408/avatar_a" not in pool_manager._cache
        assert "20250408/avatar_b" in pool_manager._cache
    
    def test_remove_nonexistent_returns_false(self, pool_manager):
        """Test removing non-cached avatar returns False."""
        result = pool_manager.remove_from_cache("nonexistent/avatar")
        assert result is False
    
    def test_get_cached_avatars(self, pool_manager):
        """Test getting list of cached avatars."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool_manager.get_avatar("20250408/avatar_a")
            pool_manager.get_avatar("20250408/avatar_b")
        
        cached = pool_manager.get_cached_avatars()
        
        assert len(cached) == 2
        assert "20250408/avatar_a" in cached
        assert "20250408/avatar_b" in cached


class TestAvailabilityChecks:
    """Tests for avatar availability checking."""
    
    def test_is_avatar_available_true(self, pool_manager):
        """Test is_avatar_available returns True for valid avatar."""
        assert pool_manager.is_avatar_available("20250408/avatar_a") is True
    
    def test_is_avatar_available_false_nonexistent(self, pool_manager):
        """Test is_avatar_available returns False for non-existent avatar."""
        assert pool_manager.is_avatar_available("nonexistent/avatar") is False
    
    def test_is_avatar_cached_true(self, pool_manager):
        """Test is_avatar_cached returns True for cached avatar."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool_manager.get_avatar("20250408/avatar_a")
        
        assert pool_manager.is_avatar_cached("20250408/avatar_a") is True
    
    def test_is_avatar_cached_false(self, pool_manager):
        """Test is_avatar_cached returns False for non-cached avatar."""
        assert pool_manager.is_avatar_cached("20250408/avatar_a") is False
    
    def test_get_available_avatars(self, pool_manager):
        """Test listing all available avatars."""
        available = pool_manager.get_available_avatars()
        
        assert len(available) == 4
        
        avatar_ids = [a["id"] for a in available]
        assert "20250408/avatar_a" in avatar_ids
        assert "20250408/avatar_b" in avatar_ids
        assert "20250408/avatar_c" in avatar_ids
        assert "20250408/avatar_d" in avatar_ids


class TestThreadSafety:
    """Tests for thread safety."""
    
    def test_concurrent_access_same_avatar(self, pool_manager):
        """Test concurrent access to the same avatar."""
        results = []
        errors = []
        
        def access_avatar():
            try:
                with patch("avatar_pool.liteAvatar", MockLiteAvatar):
                    avatar = pool_manager.get_avatar("20250408/avatar_a")
                    results.append(avatar)
            except Exception as e:
                errors.append(e)
        
        threads = [threading.Thread(target=access_avatar) for _ in range(10)]
        
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(errors) == 0
        assert len(results) == 10
        # All should be the same instance
        assert all(r is results[0] for r in results)
    
    def test_concurrent_access_different_avatars(self, pool_manager_size_3):
        """Test concurrent access to different avatars."""
        results = {}
        errors = []
        lock = threading.Lock()
        
        def access_avatar(avatar_id):
            try:
                with patch("avatar_pool.liteAvatar", MockLiteAvatar):
                    avatar = pool_manager_size_3.get_avatar(avatar_id)
                    with lock:
                        results[avatar_id] = avatar
            except Exception as e:
                errors.append(e)
        
        avatar_ids = ["20250408/avatar_a", "20250408/avatar_b", "20250408/avatar_c"]
        threads = [threading.Thread(target=access_avatar, args=(aid,)) for aid in avatar_ids]
        
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(errors) == 0
        assert len(results) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
