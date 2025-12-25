"""
API Resilience Integration - Wraps the PULSE API with DOE self-annealing.

Provides resilient wrappers for all external dependencies:
- Database connections
- AI providers (OpenAI, Anthropic, Google, Ollama)
- Avatar service
- TTS service
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime

from .resilient_service import ResilientService
from .circuit_breaker import CircuitBreakerConfig
from .retry_manager import RetryConfig
from .config_annealer import ConfigParameter

logger = logging.getLogger(__name__)


class PulseAPIResilience(ResilientService):
    """
    PULSE API with DOE self-annealing resilience.
    
    Monitors and protects all external dependencies:
    - Database (PostgreSQL)
    - AI Provider (OpenAI/Anthropic/Google/Ollama)
    - Avatar Service (LiteAvatar)
    - TTS Service (Piper/OpenAI)
    """
    
    def __init__(self, db=None, ai_provider=None):
        super().__init__("pulse-api")
        
        self.db = db
        self.ai_provider = ai_provider
        
        # Metrics tracking
        self._latency_samples = []
        self._max_samples = 100
        
        self._setup_dependencies()
        self._setup_tunable_parameters()
    
    def _setup_dependencies(self):
        """Register all service dependencies."""
        
        # Database dependency
        self.register_dependency(
            "database",
            self._check_database,
            circuit_config=CircuitBreakerConfig(
                failure_threshold=3,
                timeout_seconds=10,
                success_threshold=2
            ),
            retry_config=RetryConfig(
                max_attempts=3,
                base_delay=0.5,
                max_delay=5.0
            )
        )
        
        # AI Provider dependency
        self.register_dependency(
            "ai_provider",
            self._check_ai_provider,
            circuit_config=CircuitBreakerConfig(
                failure_threshold=5,
                timeout_seconds=30,
                success_threshold=3
            ),
            retry_config=RetryConfig(
                max_attempts=3,
                base_delay=1.0,
                max_delay=10.0
            )
        )
        
        # Avatar Service dependency
        self.register_dependency(
            "avatar_service",
            self._check_avatar_service,
            circuit_config=CircuitBreakerConfig(
                failure_threshold=3,
                timeout_seconds=15,
                success_threshold=2
            ),
            retry_config=RetryConfig(
                max_attempts=2,
                base_delay=1.0,
                max_delay=5.0
            )
        )
        
        # TTS Service dependency
        self.register_dependency(
            "tts_service",
            self._check_tts_service,
            circuit_config=CircuitBreakerConfig(
                failure_threshold=3,
                timeout_seconds=15,
                success_threshold=2
            ),
            retry_config=RetryConfig(
                max_attempts=2,
                base_delay=0.5,
                max_delay=3.0
            )
        )
    
    def _setup_tunable_parameters(self):
        """Register parameters for DOE optimization."""
        
        # Database pool size
        self.register_tunable_parameter(ConfigParameter(
            name="db_pool_size",
            current_value=int(os.getenv("DB_POOL_SIZE", "10")),
            min_value=5,
            max_value=50,
            step=5,
            description="Database connection pool size"
        ))
        
        # Request timeout
        self.register_tunable_parameter(ConfigParameter(
            name="request_timeout",
            current_value=int(os.getenv("REQUEST_TIMEOUT", "30")),
            min_value=10,
            max_value=120,
            step=10,
            description="Default request timeout in seconds"
        ))
        
        # AI retry attempts
        self.register_tunable_parameter(ConfigParameter(
            name="ai_retry_attempts",
            current_value=int(os.getenv("AI_RETRY_ATTEMPTS", "3")),
            min_value=1,
            max_value=5,
            step=1,
            description="Number of retry attempts for AI calls"
        ))
        
        # Health check interval
        self.register_tunable_parameter(ConfigParameter(
            name="health_check_interval",
            current_value=int(os.getenv("HEALTH_CHECK_INTERVAL", "30")),
            min_value=10,
            max_value=120,
            step=10,
            description="Health check interval in seconds"
        ))
    
    async def _check_database(self) -> Dict[str, Any]:
        """Check database health."""
        if self.db is None:
            return {"status": "not_configured"}
        
        try:
            # Execute a simple query
            result = await self.db.execute("SELECT 1")
            return {"status": "healthy", "connected": True}
        except Exception as e:
            raise RuntimeError(f"Database check failed: {e}")
    
    async def _check_ai_provider(self) -> Dict[str, Any]:
        """Check AI provider health."""
        provider = os.getenv("AI_PROVIDER", "openai")
        
        # Simple connectivity check based on provider
        if provider == "mlx":
            url = os.getenv("MLX_BASE_URL", "http://localhost:10240")
        elif provider == "docker":
            url = os.getenv("DOCKER_BASE_URL", "http://localhost:12434")
        else:
            # Cloud providers - assume healthy if API key is set
            key_var = f"{provider.upper()}_API_KEY"
            if os.getenv(key_var):
                return {"status": "healthy", "provider": provider, "type": "cloud"}
            return {"status": "not_configured", "provider": provider}
        
        # Check local provider
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(f"{url}/health")
                if response.status_code == 200:
                    return {"status": "healthy", "provider": provider, "type": "local"}
            except:
                pass
        
        raise RuntimeError(f"AI provider {provider} not reachable")
    
    async def _check_avatar_service(self) -> Dict[str, Any]:
        """Check avatar service health."""
        avatar_mode = os.getenv("AVATAR_MODE", "docker")
        
        if avatar_mode == "docker":
            url = "http://avatar:8080/health"
        else:
            url = "http://localhost:8060/health"
        
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    return {"status": "healthy", "initialized": data.get("initialized", False)}
            except Exception as e:
                raise RuntimeError(f"Avatar service check failed: {e}")
        
        raise RuntimeError("Avatar service not reachable")
    
    async def _check_tts_service(self) -> Dict[str, Any]:
        """Check TTS service health."""
        tts_provider = os.getenv("TTS_PROVIDER", "piper")
        
        if tts_provider == "piper":
            url = "http://piper-tts:8000/health"
            
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                try:
                    response = await client.get(url)
                    if response.status_code == 200:
                        return {"status": "healthy", "provider": "piper"}
                except:
                    pass
            
            raise RuntimeError("Piper TTS not reachable")
        else:
            # Cloud TTS - assume healthy if configured
            return {"status": "healthy", "provider": tts_provider, "type": "cloud"}
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check."""
        health = await self.health_monitor.check_all()
        
        return {
            "status": self.health_monitor.get_overall_status().value,
            "service": self.name,
            "dependencies": self.health_monitor.get_status(),
            "uptime_seconds": self.get_metrics().get("uptime_seconds", 0)
        }
    
    async def collect_metrics(self) -> Dict[str, float]:
        """Collect metrics for DOE annealing."""
        metrics = self.get_metrics()
        
        return {
            "latency": metrics.get("latency", 0),
            "error_rate": metrics.get("error_rate", 0),
            "throughput": metrics.get("request_count", 0) / max(1, metrics.get("uptime_seconds", 1))
        }
    
    def record_latency(self, latency_ms: float):
        """Record a latency sample."""
        self._latency_samples.append(latency_ms)
        if len(self._latency_samples) > self._max_samples:
            self._latency_samples.pop(0)
    
    def get_avg_latency(self) -> float:
        """Get average latency from samples."""
        if not self._latency_samples:
            return 0.0
        return sum(self._latency_samples) / len(self._latency_samples)


# Global instance
_api_resilience: Optional[PulseAPIResilience] = None


def get_api_resilience() -> PulseAPIResilience:
    """Get or create the global API resilience instance."""
    global _api_resilience
    if _api_resilience is None:
        _api_resilience = PulseAPIResilience()
    return _api_resilience


async def init_api_resilience(db=None, ai_provider=None) -> PulseAPIResilience:
    """Initialize API resilience with dependencies."""
    global _api_resilience
    _api_resilience = PulseAPIResilience(db=db, ai_provider=ai_provider)
    await _api_resilience.initialize()
    return _api_resilience


async def shutdown_api_resilience():
    """Shutdown API resilience."""
    global _api_resilience
    if _api_resilience:
        await _api_resilience.shutdown()
        _api_resilience = None
