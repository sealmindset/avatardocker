"""
Health Monitor - Monitors health of all service dependencies.

Provides continuous health checking with automatic status tracking,
latency measurement, and failure detection.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Callable, Optional, Any
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class ServiceHealth:
    """Health state for a single service."""
    name: str
    status: ServiceStatus = ServiceStatus.UNKNOWN
    last_check: Optional[datetime] = None
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    latency_ms: float = 0.0
    error_rate: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "name": self.name,
            "status": self.status.value,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "consecutive_failures": self.consecutive_failures,
            "consecutive_successes": self.consecutive_successes,
            "latency_ms": round(self.latency_ms, 2),
            "error_rate": round(self.error_rate, 4),
            "metadata": self.metadata
        }


class HealthMonitor:
    """
    Monitors health of all service dependencies.
    
    Features:
    - Periodic health checks with configurable interval
    - Latency tracking and status determination
    - Consecutive failure/success counting
    - Async-safe with proper locking
    """
    
    def __init__(self, check_interval: int = 30):
        self.services: Dict[str, ServiceHealth] = {}
        self.health_checks: Dict[str, Callable] = {}
        self.check_interval = check_interval
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        
        # Latency thresholds (ms)
        self.healthy_threshold = 100
        self.degraded_threshold = 500
    
    def register(self, name: str, health_check: Callable) -> None:
        """
        Register a service with its health check function.
        
        Args:
            name: Service identifier
            health_check: Async function that returns health info or raises on failure
        """
        self.services[name] = ServiceHealth(name=name)
        self.health_checks[name] = health_check
        logger.info(f"[HealthMonitor] Registered service: {name}")
    
    def unregister(self, name: str) -> None:
        """Remove a service from monitoring."""
        self.services.pop(name, None)
        self.health_checks.pop(name, None)
        logger.info(f"[HealthMonitor] Unregistered service: {name}")
    
    async def check_service(self, name: str) -> ServiceHealth:
        """
        Check health of a single service.
        
        Args:
            name: Service identifier
            
        Returns:
            Updated ServiceHealth object
        """
        if name not in self.health_checks:
            return ServiceHealth(name=name, status=ServiceStatus.UNKNOWN)
        
        health = self.services[name]
        start = datetime.now()
        
        try:
            result = await self.health_checks[name]()
            latency = (datetime.now() - start).total_seconds() * 1000
            
            async with self._lock:
                health.last_check = datetime.now()
                health.latency_ms = latency
                health.consecutive_failures = 0
                health.consecutive_successes += 1
                
                # Determine status based on latency thresholds
                if latency < self.healthy_threshold:
                    health.status = ServiceStatus.HEALTHY
                elif latency < self.degraded_threshold:
                    health.status = ServiceStatus.DEGRADED
                else:
                    health.status = ServiceStatus.DEGRADED
                
                # Update error rate (exponential moving average)
                health.error_rate = health.error_rate * 0.9
                
                health.metadata = result if isinstance(result, dict) else {"result": result}
                
            logger.debug(f"[HealthMonitor] {name}: {health.status.value} ({latency:.1f}ms)")
            
        except Exception as e:
            async with self._lock:
                health.last_check = datetime.now()
                health.consecutive_failures += 1
                health.consecutive_successes = 0
                health.status = ServiceStatus.UNHEALTHY
                
                # Update error rate
                health.error_rate = health.error_rate * 0.9 + 0.1
                
                health.metadata = {"error": str(e), "error_type": type(e).__name__}
                
            logger.warning(f"[HealthMonitor] {name} health check failed: {e}")
        
        return health
    
    async def check_all(self) -> Dict[str, ServiceHealth]:
        """
        Check health of all registered services concurrently.
        
        Returns:
            Dictionary of service name to ServiceHealth
        """
        if not self.health_checks:
            return {}
        
        tasks = [self.check_service(name) for name in self.health_checks]
        await asyncio.gather(*tasks, return_exceptions=True)
        return self.services
    
    async def start(self) -> None:
        """Start periodic health monitoring in background."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(f"[HealthMonitor] Started with {self.check_interval}s interval")
    
    async def stop(self) -> None:
        """Stop health monitoring."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("[HealthMonitor] Stopped")
    
    async def _monitor_loop(self) -> None:
        """Background monitoring loop."""
        while self._running:
            try:
                await self.check_all()
            except Exception as e:
                logger.error(f"[HealthMonitor] Monitor loop error: {e}")
            await asyncio.sleep(self.check_interval)
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get current status of all services.
        
        Returns:
            Dictionary with service statuses
        """
        return {
            name: health.to_dict()
            for name, health in self.services.items()
        }
    
    def get_overall_status(self) -> ServiceStatus:
        """
        Get overall system health status.
        
        Returns:
            HEALTHY if all services healthy
            DEGRADED if any service degraded
            UNHEALTHY if any service unhealthy
        """
        if not self.services:
            return ServiceStatus.UNKNOWN
        
        statuses = [h.status for h in self.services.values()]
        
        if ServiceStatus.UNHEALTHY in statuses:
            return ServiceStatus.UNHEALTHY
        if ServiceStatus.DEGRADED in statuses:
            return ServiceStatus.DEGRADED
        if ServiceStatus.UNKNOWN in statuses:
            return ServiceStatus.UNKNOWN
        return ServiceStatus.HEALTHY
    
    def is_healthy(self, name: str) -> bool:
        """Check if a specific service is healthy."""
        if name not in self.services:
            return False
        return self.services[name].status == ServiceStatus.HEALTHY
    
    def is_available(self, name: str) -> bool:
        """Check if a service is available (healthy or degraded)."""
        if name not in self.services:
            return False
        return self.services[name].status in (ServiceStatus.HEALTHY, ServiceStatus.DEGRADED)
