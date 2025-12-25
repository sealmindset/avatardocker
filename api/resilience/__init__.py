"""
DOE Self-Annealing Resilience Module

Provides resilient, self-healing capabilities for all API services:
- Health monitoring with automatic recovery
- Circuit breaker pattern for cascade failure prevention
- Retry logic with exponential backoff
- Fallback chains for graceful degradation
- Configuration annealing for automatic optimization
"""

from .health_monitor import HealthMonitor, ServiceHealth, ServiceStatus
from .circuit_breaker import CircuitBreaker, CircuitBreakerConfig, CircuitOpenError, circuit_breaker
from .retry_manager import RetryManager, RetryConfig, with_retry
from .fallback_registry import FallbackRegistry, FallbackChain, fallback_registry
from .config_annealer import ConfigAnnealer, ConfigParameter, AnnealingState, MetricType
from .resilient_service import ResilientService
from .api_resilience import (
    PulseAPIResilience,
    get_api_resilience,
    init_api_resilience,
    shutdown_api_resilience
)

__all__ = [
    # Health Monitor
    "HealthMonitor",
    "ServiceHealth", 
    "ServiceStatus",
    # Circuit Breaker
    "CircuitBreaker",
    "CircuitBreakerConfig",
    "CircuitOpenError",
    "circuit_breaker",
    # Retry Manager
    "RetryManager",
    "RetryConfig",
    "with_retry",
    # Fallback Registry
    "FallbackRegistry",
    "FallbackChain",
    "fallback_registry",
    # Config Annealer
    "ConfigAnnealer",
    "ConfigParameter",
    "AnnealingState",
    "MetricType",
    # Resilient Service
    "ResilientService",
    # API Resilience
    "PulseAPIResilience",
    "get_api_resilience",
    "init_api_resilience",
    "shutdown_api_resilience",
]
