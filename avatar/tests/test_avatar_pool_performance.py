"""
Performance tests for AvatarPoolManager.

Tests verify:
- Cache hit latency targets (< 100ms)
- LRU eviction efficiency
- Memory management
- Concurrent access performance
"""

import os
import sys
import time
import threading
import tempfile
import shutil
import pytest
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from avatar_pool import AvatarPoolManager, AVATAR_REQUIRED_FILES


class MockLiteAvatar:
    """Mock LiteAvatar with configurable load time."""
    
    LOAD_TIME_SECONDS = 0.1  # Simulated load time
    
    def __init__(self, data_dir, num_threads=1, generate_offline=True, use_gpu=False, fps=30):
        # Simulate loading time
        time.sleep(self.LOAD_TIME_SECONDS)
        self.data_dir = data_dir
        self._id = id(self)
    
    def handle(self, audio_path, result_dir):
        pass


@pytest.fixture
def temp_avatars_dir():
    """Create a temporary directory with mock avatar data."""
    temp_dir = tempfile.mkdtemp()
    
    avatars = [
        "20250408/avatar_a",
        "20250408/avatar_b",
        "20250408/avatar_c",
        "20250408/avatar_d",
        "20250408/avatar_e",
    ]
    
    for avatar_id in avatars:
        avatar_dir = os.path.join(temp_dir, avatar_id)
        os.makedirs(avatar_dir, exist_ok=True)
        
        for filename in AVATAR_REQUIRED_FILES:
            filepath = os.path.join(avatar_dir, filename)
            with open(filepath, "w") as f:
                f.write(f"mock {filename}")
    
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


class TestCacheHitPerformance:
    """Tests for cache hit latency."""
    
    def test_cache_hit_latency_under_100ms(self, temp_avatars_dir):
        """Verify cache hit returns in under 100ms."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            # First call - cache miss (will take ~100ms due to mock load time)
            pool.get_avatar("20250408/avatar_a")
            
            # Measure cache hit latency
            iterations = 100
            start = time.perf_counter()
            
            for _ in range(iterations):
                pool.get_avatar("20250408/avatar_a")
            
            elapsed = time.perf_counter() - start
            avg_latency_ms = (elapsed / iterations) * 1000
            
            print(f"\nCache hit avg latency: {avg_latency_ms:.3f}ms")
            
            # Should be well under 100ms (typically < 1ms)
            assert avg_latency_ms < 100, f"Cache hit too slow: {avg_latency_ms:.3f}ms"
    
    def test_cache_hit_latency_under_1ms(self, temp_avatars_dir):
        """Verify cache hit returns in under 1ms (ideal target)."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            pool.get_avatar("20250408/avatar_a")
            
            # Warm up
            for _ in range(10):
                pool.get_avatar("20250408/avatar_a")
            
            # Measure
            iterations = 1000
            start = time.perf_counter()
            
            for _ in range(iterations):
                pool.get_avatar("20250408/avatar_a")
            
            elapsed = time.perf_counter() - start
            avg_latency_ms = (elapsed / iterations) * 1000
            
            print(f"\nCache hit avg latency (warmed): {avg_latency_ms:.4f}ms")
            
            # Ideal target is under 1ms
            assert avg_latency_ms < 1, f"Cache hit slower than ideal: {avg_latency_ms:.4f}ms"


class TestEvictionPerformance:
    """Tests for LRU eviction efficiency."""
    
    def test_eviction_maintains_performance(self, temp_avatars_dir):
        """Verify eviction doesn't degrade cache hit performance."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=2
            )
            
            # Fill cache and cause evictions
            pool.get_avatar("20250408/avatar_a")
            pool.get_avatar("20250408/avatar_b")
            pool.get_avatar("20250408/avatar_c")  # Evicts avatar_a
            
            # Measure cache hit after eviction
            iterations = 100
            start = time.perf_counter()
            
            for _ in range(iterations):
                pool.get_avatar("20250408/avatar_b")
            
            elapsed = time.perf_counter() - start
            avg_latency_ms = (elapsed / iterations) * 1000
            
            print(f"\nPost-eviction cache hit latency: {avg_latency_ms:.3f}ms")
            
            assert avg_latency_ms < 1, f"Post-eviction hit too slow: {avg_latency_ms:.3f}ms"
    
    def test_lru_order_efficiency(self, temp_avatars_dir):
        """Verify LRU ordering is maintained efficiently."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            # Load 3 avatars
            pool.get_avatar("20250408/avatar_a")
            pool.get_avatar("20250408/avatar_b")
            pool.get_avatar("20250408/avatar_c")
            
            # Access pattern that updates LRU order
            iterations = 100
            start = time.perf_counter()
            
            for i in range(iterations):
                # Rotate through avatars
                if i % 3 == 0:
                    pool.get_avatar("20250408/avatar_a")
                elif i % 3 == 1:
                    pool.get_avatar("20250408/avatar_b")
                else:
                    pool.get_avatar("20250408/avatar_c")
            
            elapsed = time.perf_counter() - start
            avg_latency_ms = (elapsed / iterations) * 1000
            
            print(f"\nLRU rotation avg latency: {avg_latency_ms:.3f}ms")
            
            # All should be cache hits
            stats = pool.get_stats()
            assert stats["hits"] >= iterations


class TestConcurrentPerformance:
    """Tests for concurrent access performance."""
    
    def test_concurrent_cache_hits(self, temp_avatars_dir):
        """Verify concurrent cache hits don't cause contention issues."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            # Pre-load avatar
            pool.get_avatar("20250408/avatar_a")
            
            latencies = []
            errors = []
            
            def measure_access():
                try:
                    start = time.perf_counter()
                    pool.get_avatar("20250408/avatar_a")
                    elapsed = (time.perf_counter() - start) * 1000
                    latencies.append(elapsed)
                except Exception as e:
                    errors.append(e)
            
            # Run concurrent accesses
            threads = [threading.Thread(target=measure_access) for _ in range(50)]
            
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            
            assert len(errors) == 0, f"Errors during concurrent access: {errors}"
            
            avg_latency = sum(latencies) / len(latencies)
            max_latency = max(latencies)
            
            print(f"\nConcurrent access - avg: {avg_latency:.3f}ms, max: {max_latency:.3f}ms")
            
            # Average should still be under 10ms even with contention
            assert avg_latency < 10, f"Concurrent avg too slow: {avg_latency:.3f}ms"
    
    def test_concurrent_different_avatars(self, temp_avatars_dir):
        """Verify concurrent access to different avatars."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            # Pre-load all avatars
            pool.get_avatar("20250408/avatar_a")
            pool.get_avatar("20250408/avatar_b")
            pool.get_avatar("20250408/avatar_c")
            
            results = {"a": [], "b": [], "c": []}
            errors = []
            
            def access_avatar(avatar_suffix, result_key):
                try:
                    start = time.perf_counter()
                    pool.get_avatar(f"20250408/avatar_{avatar_suffix}")
                    elapsed = (time.perf_counter() - start) * 1000
                    results[result_key].append(elapsed)
                except Exception as e:
                    errors.append(e)
            
            threads = []
            for _ in range(20):
                threads.append(threading.Thread(target=access_avatar, args=("a", "a")))
                threads.append(threading.Thread(target=access_avatar, args=("b", "b")))
                threads.append(threading.Thread(target=access_avatar, args=("c", "c")))
            
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            
            assert len(errors) == 0
            
            for key, latencies in results.items():
                avg = sum(latencies) / len(latencies)
                print(f"Avatar {key} - avg latency: {avg:.3f}ms")
                assert avg < 10


class TestMemoryEfficiency:
    """Tests for memory management."""
    
    def test_cache_size_respected(self, temp_avatars_dir):
        """Verify cache never exceeds max_size."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=2
            )
            
            # Load more avatars than max_size
            for suffix in ["a", "b", "c", "d", "e"]:
                pool.get_avatar(f"20250408/avatar_{suffix}")
                
                # Cache should never exceed max_size
                assert len(pool._cache) <= pool.max_size
            
            # Final cache size should be exactly max_size
            assert len(pool._cache) == 2
    
    def test_eviction_cleans_up_instance(self, temp_avatars_dir):
        """Verify evicted instances are cleaned up."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=1
            )
            
            # Load first avatar
            avatar1 = pool.get_avatar("20250408/avatar_a")
            avatar1_id = id(avatar1)
            
            # Load second avatar (evicts first)
            pool.get_avatar("20250408/avatar_b")
            
            # First avatar should no longer be in cache
            assert "20250408/avatar_a" not in pool._cache
            
            # Stats should show eviction
            stats = pool.get_stats()
            assert stats["evictions"] == 1


class TestFallbackPerformance:
    """Tests for fallback behavior performance."""
    
    def test_fallback_latency(self, temp_avatars_dir):
        """Verify fallback doesn't add significant latency."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=2
            )
            
            # Pre-load a valid avatar
            pool.get_avatar("20250408/avatar_a")
            
            # Measure fallback latency (requesting non-existent avatar)
            iterations = 10
            start = time.perf_counter()
            
            for _ in range(iterations):
                try:
                    pool.get_avatar("nonexistent/avatar", fallback_to_default=True)
                except FileNotFoundError:
                    pass  # Expected if no fallback available
            
            elapsed = time.perf_counter() - start
            avg_latency_ms = (elapsed / iterations) * 1000
            
            print(f"\nFallback avg latency: {avg_latency_ms:.3f}ms")
            
            # Fallback should be fast (just returning cached avatar)
            # Allow more time since it includes error handling
            assert avg_latency_ms < 50


class TestStatisticsAccuracy:
    """Tests for statistics tracking accuracy."""
    
    def test_hit_rate_calculation(self, temp_avatars_dir):
        """Verify hit rate is calculated correctly."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            # 1 miss
            pool.get_avatar("20250408/avatar_a")
            
            # 9 hits
            for _ in range(9):
                pool.get_avatar("20250408/avatar_a")
            
            stats = pool.get_stats()
            
            assert stats["hits"] == 9
            assert stats["misses"] == 1
            assert stats["hit_rate"] == "90.0%"
    
    def test_load_time_tracking(self, temp_avatars_dir):
        """Verify load times are tracked accurately."""
        with patch("avatar_pool.liteAvatar", MockLiteAvatar):
            pool = AvatarPoolManager(
                avatars_base_dir=temp_avatars_dir,
                max_size=3
            )
            
            # Load 3 avatars
            pool.get_avatar("20250408/avatar_a")
            pool.get_avatar("20250408/avatar_b")
            pool.get_avatar("20250408/avatar_c")
            
            stats = pool.get_stats()
            
            # Should have 3 load times recorded
            assert len(pool._stats["load_times"]) == 3
            
            # Average should be around MockLiteAvatar.LOAD_TIME_SECONDS
            avg_load = stats["avg_load_time_seconds"]
            expected = MockLiteAvatar.LOAD_TIME_SECONDS
            
            # Allow 50% tolerance for timing variations
            assert expected * 0.5 <= avg_load <= expected * 1.5


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
