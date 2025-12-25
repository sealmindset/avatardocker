"""
Resilient Service - Base class for services with DOE self-annealing.

Provides a unified interface for building resilient services with:
- Health monitoring
- Circuit breaker protection
- Automatic retries
- Fallback chains
- Configuration annealing
"""

import asyncio
import logging
from typing import Dict, Any, Optional, Callable, List
from abc import ABC, abstractmethod
from datetime import datetime

from .health_monitor import HealthMonitor, ServiceStatus
from .circuit_breaker import CircuitBreaker, CircuitBreakerConfig, CircuitOpenError
from .retry_manager import RetryManager, RetryConfig
from .fallback_registry import FallbackRegistry
from .config_annealer import ConfigAnnealer, ConfigParameter

logger = logging.getLogger(__name__)


class ResilientService(ABC):
    """
    Base class for resilient services with DOE self-annealing.
    
    Subclass this to create services that automatically:
    - Monitor dependency health
    - Handle failures gracefully
    - Retry transient errors
    - Fall back to alternatives
    - Optimize configuration
    
    Usage:
        class MyService(ResilientService):
            def __init__(self):
                super().__init__("my-service")
                self.register_dependency("database", self._check_db)
                
            async def health_check(self):
                return {"status": "ok"}
                
            async def collect_metrics(self):
                return {"latency": 50, "error_rate": 0.01}
    """
    
    def __init__(self, name: str):
        self.name = name
        self.health_monitor = HealthMonitor(check_interval=30)
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.retry_managers: Dict[str, RetryManager] = {}
        self.fallback_registry = FallbackRegistry()
        self.config_annealer = ConfigAnnealer()
        
        self._initialized = False
        self._start_time: Optional[datetime] = None
        self._request_count = 0
        self._error_count = 0
        self._total_latency = 0.0
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Implement service-specific health check.
        
        Returns:
            Dictionary with health information
        """
        pass
    
    @abstractmethod
    async def collect_metrics(self) -> Dict[str, float]:
        """
        Collect current performance metrics for annealing.
        
        Returns:
            Dictionary with metric name to value
        """
        pass
    
    def register_dependency(
        self,
        name: str,
        health_check: Callable,
        circuit_config: Optional[CircuitBreakerConfig] = None,
        retry_config: Optional[RetryConfig] = None
    ) -> None:
        """
        Register a service dependency with resilience features.
        
        Args:
            name: Dependency identifier
            health_check: Async function to check dependency health
            circuit_config: Circuit breaker configuration
            retry_config: Retry configuration
        """
        # Register health check
        self.health_monitor.register(name, health_check)
        
        # Create circuit breaker
        self.circuit_breakers[name] = CircuitBreaker(
            f"{self.name}.{name}",
            circuit_config or CircuitBreakerConfig()
        )
        
        # Create retry manager
        self.retry_managers[name] = RetryManager(
            retry_config or RetryConfig()
        )
        
        logger.info(f"[{self.name}] Registered dependency: {name}")
    
    def register_fallback(
        self,
        name: str,
        primary: Callable,
        fallbacks: Optional[List[tuple]] = None
    ) -> None:
        """
        Register a service with fallback chain.
        
        Args:
            name: Service identifier
            primary: Primary async function
            fallbacks: List of (priority, name, function) tuples
        """
        chain = self.fallback_registry.register(name, primary)
        
        if fallbacks:
            for priority, fallback_name, func in fallbacks:
                chain.add_fallback(func, priority, fallback_name)
    
    def register_tunable_parameter(self, param: ConfigParameter) -> None:
        """
        Register a parameter for DOE optimization.
        
        Args:
            param: ConfigParameter to register
        """
        self.config_annealer.register_parameter(param)
    
    async def call_dependency(
        self,
        name: str,
        func: Callable,
        *args,
        use_circuit_breaker: bool = True,
        use_retry: bool = True,
        use_fallback: bool = True,
        **kwargs
    ) -> Any:
        """
        Call a dependency with full resilience stack.
        
        Applies circuit breaker, retry, and fallback in order.
        
        Args:
            name: Dependency identifier
            func: Async function to call
            *args, **kwargs: Arguments to pass
            use_circuit_breaker: Whether to use circuit breaker
            use_retry: Whether to use retry logic
            use_fallback: Whether to use fallback chain
            
        Returns:
            Result of successful call
        """
        start_time = datetime.now()
        self._request_count += 1
        
        try:
            # Build the call chain
            async def execute():
                return await func(*args, **kwargs)
            
            # Wrap with retry if enabled
            if use_retry and name in self.retry_managers:
                original_execute = execute
                async def execute():
                    return await self.retry_managers[name].execute(original_execute)
            
            # Wrap with circuit breaker if enabled
            if use_circuit_breaker and name in self.circuit_breakers:
                result = await self.circuit_breakers[name].call(execute)
            else:
                result = await execute()
            
            # Track latency
            latency = (datetime.now() - start_time).total_seconds() * 1000
            self._total_latency += latency
            
            return result
            
        except CircuitOpenError:
            # Try fallback if available
            if use_fallback and name in self.fallback_registry.chains:
                logger.info(f"[{self.name}] Circuit open, using fallback for {name}")
                return await self.fallback_registry.call(name, *args, **kwargs)
            raise
            
        except Exception as e:
            self._error_count += 1
            
            # Try fallback if available
            if use_fallback and name in self.fallback_registry.chains:
                logger.info(f"[{self.name}] Error, using fallback for {name}: {e}")
                return await self.fallback_registry.call(name, *args, **kwargs)
            raise
    
    async def initialize(self) -> None:
        """Initialize the resilient service."""
        if self._initialized:
            return
        
        logger.info(f"[{self.name}] Initializing resilient service...")
        self._start_time = datetime.now()
        
        # Start health monitoring
        await self.health_monitor.start()
        
        # Initial health check
        await self.health_monitor.check_all()
        
        self._initialized = True
        logger.info(f"[{self.name}] Resilient service initialized")
    
    async def shutdown(self) -> None:
        """Shutdown the resilient service."""
        logger.info(f"[{self.name}] Shutting down resilient service...")
        
        # Stop health monitoring
        await self.health_monitor.stop()
        
        # Stop annealing
        self.config_annealer.stop()
        
        self._initialized = False
        logger.info(f"[{self.name}] Resilient service shutdown complete")
    
    async def start_annealing(
        self,
        max_iterations: int = 100,
        early_stop_iterations: int = 20
    ) -> Dict[str, Any]:
        """
        Start DOE configuration annealing.
        
        Args:
            max_iterations: Maximum iterations to run
            early_stop_iterations: Stop if no improvement
            
        Returns:
            Best configuration found
        """
        return await self.config_annealer.run_annealing(
            self.collect_metrics,
            max_iterations,
            early_stop_iterations
        )
    
    def get_metrics(self) -> Dict[str, float]:
        """Get current service metrics."""
        avg_latency = (
            self._total_latency / max(1, self._request_count)
        )
        error_rate = (
            self._error_count / max(1, self._request_count)
        )
        
        uptime = 0.0
        if self._start_time:
            uptime = (datetime.now() - self._start_time).total_seconds()
        
        return {
            "latency": avg_latency,
            "error_rate": error_rate,
            "request_count": self._request_count,
            "error_count": self._error_count,
            "uptime_seconds": uptime
        }
    
    def reset_metrics(self) -> None:
        """Reset service metrics."""
        self._request_count = 0
        self._error_count = 0
        self._total_latency = 0.0
    
    def get_resilience_status(self) -> Dict[str, Any]:
        """Get comprehensive resilience status."""
        return {
            "service": self.name,
            "initialized": self._initialized,
            "uptime_seconds": (
                (datetime.now() - self._start_time).total_seconds()
                if self._start_time else 0
            ),
            "metrics": self.get_metrics(),
            "health": {
                "overall": self.health_monitor.get_overall_status().value,
                "dependencies": self.health_monitor.get_status()
            },
            "circuit_breakers": {
                name: cb.get_status()
                for name, cb in self.circuit_breakers.items()
            },
            "fallbacks": self.fallback_registry.get_status(),
            "annealing": self.config_annealer.get_status()
        }
    
    def is_healthy(self) -> bool:
        """Check if service is healthy."""
        return self.health_monitor.get_overall_status() in (
            ServiceStatus.HEALTHY,
            ServiceStatus.DEGRADED
        )
