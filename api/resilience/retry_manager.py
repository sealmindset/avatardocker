"""
Retry Manager - Handles retries with exponential backoff and jitter.

Provides configurable retry logic to handle transient failures
without overwhelming services during recovery.
"""

import asyncio
import logging
import random
from dataclasses import dataclass, field
from typing import Callable, Optional, Type, Tuple, Any
from functools import wraps

logger = logging.getLogger(__name__)


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    base_delay: float = 1.0           # Base delay in seconds
    max_delay: float = 60.0           # Maximum delay cap
    exponential_base: float = 2.0     # Exponential backoff multiplier
    jitter: bool = True               # Add randomness to prevent thundering herd
    jitter_range: float = 0.25        # Jitter as percentage of delay
    
    # Exceptions that should trigger retry (default: all)
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,)
    
    # Exceptions that should NOT be retried
    non_retryable_exceptions: Tuple[Type[Exception], ...] = ()


class RetryExhaustedError(Exception):
    """Raised when all retry attempts have been exhausted."""
    
    def __init__(self, attempts: int, last_error: Exception):
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(f"All {attempts} retry attempts exhausted. Last error: {last_error}")


class RetryManager:
    """
    Manages retry logic with exponential backoff.
    
    Features:
    - Exponential backoff with configurable base
    - Jitter to prevent thundering herd
    - Configurable retryable/non-retryable exceptions
    - Detailed logging of retry attempts
    """
    
    def __init__(self, config: Optional[RetryConfig] = None):
        self.config = config or RetryConfig()
        self.total_retries = 0
        self.successful_retries = 0
    
    def calculate_delay(self, attempt: int) -> float:
        """
        Calculate delay for given attempt number.
        
        Args:
            attempt: Zero-indexed attempt number
            
        Returns:
            Delay in seconds
        """
        delay = min(
            self.config.base_delay * (self.config.exponential_base ** attempt),
            self.config.max_delay
        )
        
        if self.config.jitter:
            # Add jitter: delay * (1 - jitter_range/2) to delay * (1 + jitter_range/2)
            jitter_factor = 1 + (random.random() - 0.5) * self.config.jitter_range * 2
            delay = delay * jitter_factor
        
        return delay
    
    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with retry logic.
        
        Args:
            func: Async function to execute
            *args, **kwargs: Arguments to pass to function
            
        Returns:
            Result of successful function call
            
        Raises:
            RetryExhaustedError: If all attempts fail
            Exception: If non-retryable exception is raised
        """
        last_exception = None
        
        for attempt in range(self.config.max_attempts):
            try:
                result = await func(*args, **kwargs)
                
                # Track successful retry
                if attempt > 0:
                    self.successful_retries += 1
                    logger.info(
                        f"[RetryManager] Succeeded on attempt {attempt + 1}"
                    )
                
                return result
                
            except self.config.non_retryable_exceptions as e:
                # Don't retry these exceptions
                logger.debug(f"[RetryManager] Non-retryable exception: {type(e).__name__}")
                raise
                
            except self.config.retryable_exceptions as e:
                last_exception = e
                self.total_retries += 1
                
                if attempt < self.config.max_attempts - 1:
                    delay = self.calculate_delay(attempt)
                    logger.warning(
                        f"[RetryManager] Attempt {attempt + 1}/{self.config.max_attempts} "
                        f"failed: {type(e).__name__}: {e}. Retrying in {delay:.2f}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"[RetryManager] All {self.config.max_attempts} attempts failed. "
                        f"Last error: {type(e).__name__}: {e}"
                    )
        
        raise RetryExhaustedError(self.config.max_attempts, last_exception)
    
    def get_stats(self) -> dict:
        """Get retry statistics."""
        return {
            "total_retries": self.total_retries,
            "successful_retries": self.successful_retries,
            "config": {
                "max_attempts": self.config.max_attempts,
                "base_delay": self.config.base_delay,
                "max_delay": self.config.max_delay,
                "exponential_base": self.config.exponential_base,
                "jitter": self.config.jitter
            }
        }


def with_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    non_retryable_exceptions: Tuple[Type[Exception], ...] = ()
):
    """
    Decorator to add retry logic to async functions.
    
    Usage:
        @with_retry(max_attempts=5, base_delay=2.0)
        async def call_flaky_service():
            ...
    """
    config = RetryConfig(
        max_attempts=max_attempts,
        base_delay=base_delay,
        max_delay=max_delay,
        exponential_base=exponential_base,
        jitter=jitter,
        retryable_exceptions=retryable_exceptions,
        non_retryable_exceptions=non_retryable_exceptions
    )
    manager = RetryManager(config)
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await manager.execute(func, *args, **kwargs)
        
        # Attach manager for inspection
        wrapper._retry_manager = manager
        return wrapper
    
    return decorator
