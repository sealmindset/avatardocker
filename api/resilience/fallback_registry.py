"""
Fallback Registry - Manages fallback chains for graceful degradation.

When primary services fail, automatically falls back to alternative
implementations in priority order.
"""

import logging
from typing import Callable, Dict, Optional, Any, List, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class FallbackChain:
    """
    Chain of fallback options for a service.
    
    Executes primary first, then fallbacks in priority order
    until one succeeds.
    """
    name: str
    primary: Callable
    fallbacks: List[Tuple[int, str, Callable]] = field(default_factory=list)
    current_provider: str = "primary"
    total_calls: int = 0
    fallback_calls: int = 0
    
    def add_fallback(self, fallback: Callable, priority: int = 0, name: str = "fallback") -> None:
        """
        Add a fallback option.
        
        Args:
            fallback: Async function to use as fallback
            priority: Lower number = higher priority (tried first)
            name: Identifier for this fallback
        """
        self.fallbacks.append((priority, name, fallback))
        self.fallbacks.sort(key=lambda x: x[0])
        logger.info(f"[FallbackChain] {self.name}: Added fallback '{name}' (priority {priority})")
    
    async def execute(self, *args, **kwargs) -> Any:
        """
        Execute with automatic fallback.
        
        Tries primary first, then each fallback in priority order.
        
        Returns:
            Result from first successful call
            
        Raises:
            RuntimeError: If all options fail
        """
        self.total_calls += 1
        errors = []
        
        # Try primary first
        try:
            result = await self.primary(*args, **kwargs)
            self.current_provider = "primary"
            return result
        except Exception as e:
            errors.append(("primary", e))
            logger.warning(f"[FallbackChain] {self.name} primary failed: {type(e).__name__}: {e}")
        
        # Try fallbacks in priority order
        for priority, name, fallback in self.fallbacks:
            try:
                result = await fallback(*args, **kwargs)
                self.fallback_calls += 1
                self.current_provider = name
                logger.info(f"[FallbackChain] {self.name}: Using fallback '{name}'")
                return result
            except Exception as e:
                errors.append((name, e))
                logger.warning(
                    f"[FallbackChain] {self.name} fallback '{name}' failed: "
                    f"{type(e).__name__}: {e}"
                )
        
        # All options exhausted
        error_summary = "; ".join([f"{n}: {e}" for n, e in errors])
        raise RuntimeError(f"All fallbacks exhausted for {self.name}. Errors: {error_summary}")
    
    def get_status(self) -> dict:
        """Get fallback chain status."""
        return {
            "name": self.name,
            "current_provider": self.current_provider,
            "total_calls": self.total_calls,
            "fallback_calls": self.fallback_calls,
            "fallback_rate": self.fallback_calls / max(1, self.total_calls),
            "fallbacks": [
                {"priority": p, "name": n}
                for p, n, _ in self.fallbacks
            ]
        }


class FallbackRegistry:
    """
    Registry for service fallbacks.
    
    Centralized management of fallback chains across the application.
    """
    
    def __init__(self):
        self.chains: Dict[str, FallbackChain] = {}
    
    def register(self, name: str, primary: Callable) -> FallbackChain:
        """
        Register a primary service.
        
        Args:
            name: Service identifier
            primary: Primary async function
            
        Returns:
            FallbackChain for adding fallbacks
        """
        chain = FallbackChain(name=name, primary=primary)
        self.chains[name] = chain
        logger.info(f"[FallbackRegistry] Registered service: {name}")
        return chain
    
    def add_fallback(
        self,
        name: str,
        fallback: Callable,
        priority: int = 0,
        fallback_name: str = "fallback"
    ) -> None:
        """
        Add fallback to existing chain.
        
        Args:
            name: Service identifier
            fallback: Fallback async function
            priority: Lower = higher priority
            fallback_name: Identifier for this fallback
        """
        if name not in self.chains:
            raise KeyError(f"No fallback chain registered for '{name}'")
        self.chains[name].add_fallback(fallback, priority, fallback_name)
    
    async def call(self, name: str, *args, **kwargs) -> Any:
        """
        Call service with fallback support.
        
        Args:
            name: Service identifier
            *args, **kwargs: Arguments to pass
            
        Returns:
            Result from successful call
        """
        if name not in self.chains:
            raise KeyError(f"No fallback chain registered for '{name}'")
        return await self.chains[name].execute(*args, **kwargs)
    
    def get_chain(self, name: str) -> Optional[FallbackChain]:
        """Get a specific fallback chain."""
        return self.chains.get(name)
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all fallback chains."""
        return {
            name: chain.get_status()
            for name, chain in self.chains.items()
        }
    
    def list_services(self) -> List[str]:
        """List all registered service names."""
        return list(self.chains.keys())


# Global registry instance
fallback_registry = FallbackRegistry()
