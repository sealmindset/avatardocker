"""
Circuit Breaker - Prevents cascade failures by failing fast.

Implements the circuit breaker pattern with three states:
- CLOSED: Normal operation, requests pass through
- OPEN: Failing fast, requests rejected immediately
- HALF_OPEN: Testing recovery with limited requests
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Callable, Optional, TypeVar, Any
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing, reject requests
    HALF_OPEN = "half_open" # Testing recovery


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker behavior."""
    failure_threshold: int = 5          # Failures before opening
    success_threshold: int = 3          # Successes to close from half-open
    timeout_seconds: int = 30           # Time before transitioning to half-open
    half_open_max_calls: int = 3        # Max concurrent calls in half-open state
    
    # Optional: exceptions that should NOT trip the breaker
    excluded_exceptions: tuple = ()


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and rejecting requests."""
    
    def __init__(self, name: str, time_until_retry: float = 0):
        self.name = name
        self.time_until_retry = time_until_retry
        super().__init__(f"Circuit '{name}' is open. Retry in {time_until_retry:.1f}s")


class CircuitBreaker:
    """
    Circuit breaker pattern for resilient service calls.
    
    Usage:
        breaker = CircuitBreaker("my-service")
        result = await breaker.call(my_async_function, arg1, arg2)
    """
    
    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.last_state_change: datetime = datetime.now()
        self.half_open_calls = 0
        self.total_calls = 0
        self.total_failures = 0
        self._lock = asyncio.Lock()
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.
        
        Args:
            func: Async function to execute
            *args, **kwargs: Arguments to pass to function
            
        Returns:
            Result of function call
            
        Raises:
            CircuitOpenError: If circuit is open
            Exception: If function raises and circuit trips
        """
        async with self._lock:
            can_execute, time_until_retry = await self._can_execute()
            if not can_execute:
                raise CircuitOpenError(self.name, time_until_retry)
        
        self.total_calls += 1
        
        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except self.config.excluded_exceptions:
            # Don't count excluded exceptions as failures
            raise
        except Exception as e:
            await self._on_failure(e)
            raise
    
    async def _can_execute(self) -> tuple[bool, float]:
        """
        Check if execution is allowed.
        
        Returns:
            Tuple of (can_execute, time_until_retry)
        """
        if self.state == CircuitState.CLOSED:
            return True, 0
        
        if self.state == CircuitState.OPEN:
            if self.last_failure_time:
                elapsed = (datetime.now() - self.last_failure_time).total_seconds()
                if elapsed >= self.config.timeout_seconds:
                    self._transition_to(CircuitState.HALF_OPEN)
                    self.half_open_calls = 0
                    return True, 0
                return False, self.config.timeout_seconds - elapsed
            return False, self.config.timeout_seconds
        
        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls < self.config.half_open_max_calls:
                self.half_open_calls += 1
                return True, 0
            return False, 0
        
        return False, 0
    
    async def _on_success(self) -> None:
        """Handle successful execution."""
        async with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self._transition_to(CircuitState.CLOSED)
                    self.failure_count = 0
                    self.success_count = 0
            elif self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.failure_count = max(0, self.failure_count - 1)
    
    async def _on_failure(self, error: Exception) -> None:
        """Handle failed execution."""
        async with self._lock:
            self.failure_count += 1
            self.total_failures += 1
            self.last_failure_time = datetime.now()
            
            if self.state == CircuitState.HALF_OPEN:
                self._transition_to(CircuitState.OPEN)
            elif self.state == CircuitState.CLOSED:
                if self.failure_count >= self.config.failure_threshold:
                    self._transition_to(CircuitState.OPEN)
    
    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to a new state with logging."""
        old_state = self.state
        self.state = new_state
        self.last_state_change = datetime.now()
        
        if new_state == CircuitState.OPEN:
            logger.warning(
                f"[CircuitBreaker] {self.name}: {old_state.value} -> OPEN "
                f"(failures: {self.failure_count})"
            )
        elif new_state == CircuitState.HALF_OPEN:
            logger.info(f"[CircuitBreaker] {self.name}: {old_state.value} -> HALF_OPEN")
        elif new_state == CircuitState.CLOSED:
            logger.info(f"[CircuitBreaker] {self.name}: {old_state.value} -> CLOSED (recovered)")
    
    def reset(self) -> None:
        """Manually reset the circuit breaker to closed state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.half_open_calls = 0
        self.last_state_change = datetime.now()
        logger.info(f"[CircuitBreaker] {self.name}: Manually reset to CLOSED")
    
    def get_status(self) -> dict:
        """Get current circuit breaker status."""
        time_in_state = (datetime.now() - self.last_state_change).total_seconds()
        
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "total_calls": self.total_calls,
            "total_failures": self.total_failures,
            "failure_rate": self.total_failures / max(1, self.total_calls),
            "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None,
            "time_in_state_seconds": round(time_in_state, 1),
            "config": {
                "failure_threshold": self.config.failure_threshold,
                "success_threshold": self.config.success_threshold,
                "timeout_seconds": self.config.timeout_seconds
            }
        }


def circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None):
    """
    Decorator to apply circuit breaker to async functions.
    
    Usage:
        @circuit_breaker("my-service")
        async def call_external_service():
            ...
    """
    breaker = CircuitBreaker(name, config)
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)
        
        # Attach breaker for inspection
        wrapper._circuit_breaker = breaker
        return wrapper
    
    return decorator
