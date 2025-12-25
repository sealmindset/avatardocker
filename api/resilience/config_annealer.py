"""
Configuration Annealer - DOE Self-Annealing for automatic optimization.

Uses simulated annealing algorithm to find optimal configuration values
based on observed metrics (latency, error rate, throughput).
"""

import asyncio
import logging
import random
import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Callable, Optional, List, Union
from enum import Enum

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics used for optimization."""
    LATENCY = "latency"
    ERROR_RATE = "error_rate"
    THROUGHPUT = "throughput"
    MEMORY = "memory"
    CPU = "cpu"


@dataclass
class ConfigParameter:
    """A tunable configuration parameter."""
    name: str
    current_value: Union[int, float]
    min_value: Union[int, float]
    max_value: Union[int, float]
    step: Union[int, float]
    is_integer: bool = False
    description: str = ""
    
    def __post_init__(self):
        """Infer is_integer from current_value type."""
        if isinstance(self.current_value, int) and not isinstance(self.current_value, bool):
            self.is_integer = True
    
    def clamp(self, value: Union[int, float]) -> Union[int, float]:
        """Clamp value to valid range."""
        clamped = max(self.min_value, min(self.max_value, value))
        return int(clamped) if self.is_integer else clamped
    
    def perturb(self, temperature: float = 1.0) -> Union[int, float]:
        """Generate a perturbed value based on temperature."""
        # Higher temperature = larger perturbations
        delta = random.gauss(0, self.step * temperature)
        new_value = self.current_value + delta
        return self.clamp(new_value)


@dataclass
class AnnealingState:
    """Current state of the annealing process."""
    temperature: float = 1.0
    best_score: float = float('inf')
    current_score: float = float('inf')
    best_config: Dict[str, Any] = field(default_factory=dict)
    iteration: int = 0
    last_improvement: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ConfigAnnealer:
    """
    DOE Self-Annealing Configuration Optimizer.
    
    Uses simulated annealing to find optimal configuration values
    based on observed metrics. The algorithm:
    
    1. Starts at high "temperature" allowing large changes
    2. Gradually cools, reducing change magnitude
    3. Accepts worse solutions probabilistically (exploration)
    4. Converges on optimal configuration
    
    Features:
    - Multi-parameter optimization
    - Configurable metric weights
    - Async-compatible
    - Detailed history tracking
    """
    
    def __init__(
        self,
        initial_temperature: float = 1.0,
        cooling_rate: float = 0.95,
        min_temperature: float = 0.01,
        iterations_per_temp: int = 10,
        metric_weights: Optional[Dict[str, float]] = None
    ):
        self.initial_temperature = initial_temperature
        self.cooling_rate = cooling_rate
        self.min_temperature = min_temperature
        self.iterations_per_temp = iterations_per_temp
        
        # Default metric weights (lower score is better)
        self.metric_weights = metric_weights or {
            MetricType.LATENCY.value: 0.4,
            MetricType.ERROR_RATE.value: 0.4,
            MetricType.THROUGHPUT.value: -0.2,  # Negative = higher is better
        }
        
        self.parameters: Dict[str, ConfigParameter] = {}
        self.state = AnnealingState(temperature=initial_temperature)
        self.metrics_history: List[Dict] = []
        self._running = False
        self._callbacks: List[Callable] = []
    
    def register_parameter(self, param: ConfigParameter) -> None:
        """
        Register a tunable parameter.
        
        Args:
            param: ConfigParameter to register
        """
        self.parameters[param.name] = param
        self.state.best_config[param.name] = param.current_value
        logger.info(
            f"[ConfigAnnealer] Registered parameter: {param.name} "
            f"(current={param.current_value}, range=[{param.min_value}, {param.max_value}])"
        )
    
    def on_improvement(self, callback: Callable) -> None:
        """Register callback for when improvement is found."""
        self._callbacks.append(callback)
    
    def calculate_score(self, metrics: Dict[str, float]) -> float:
        """
        Calculate optimization score from metrics.
        
        Lower score is better.
        
        Args:
            metrics: Dictionary of metric name to value
            
        Returns:
            Weighted score
        """
        score = 0.0
        
        for metric_name, weight in self.metric_weights.items():
            if metric_name in metrics:
                value = metrics[metric_name]
                
                # Scale error rate (typically 0-1) to be comparable to latency
                if metric_name == MetricType.ERROR_RATE.value:
                    value *= 1000
                
                score += value * weight
        
        return score
    
    def generate_neighbor(self) -> Dict[str, Any]:
        """
        Generate a neighboring configuration.
        
        Perturbs some parameters based on current temperature.
        
        Returns:
            New configuration dictionary
        """
        new_config = {}
        
        for name, param in self.parameters.items():
            # Probability of changing each parameter decreases with temperature
            change_prob = 0.3 + 0.4 * self.state.temperature
            
            if random.random() < change_prob:
                new_config[name] = param.perturb(self.state.temperature)
            else:
                new_config[name] = param.current_value
        
        return new_config
    
    def accept_probability(self, current_score: float, new_score: float) -> float:
        """
        Calculate probability of accepting a solution.
        
        Always accepts better solutions. Accepts worse solutions
        with probability based on temperature (simulated annealing).
        
        Args:
            current_score: Current best score
            new_score: Score of new solution
            
        Returns:
            Probability of acceptance (0-1)
        """
        if new_score < current_score:
            return 1.0
        
        if self.state.temperature <= 0:
            return 0.0
        
        # Simulated annealing acceptance probability
        delta = new_score - current_score
        return math.exp(-delta / (self.state.temperature * 100))
    
    def apply_config(self, config: Dict[str, Any]) -> None:
        """Apply a configuration to parameters."""
        for name, value in config.items():
            if name in self.parameters:
                self.parameters[name].current_value = value
    
    async def anneal_step(self, metrics_collector: Callable) -> Dict[str, Any]:
        """
        Perform one annealing step.
        
        Args:
            metrics_collector: Async function that returns current metrics
            
        Returns:
            Current best configuration
        """
        # Generate neighbor configuration
        new_config = self.generate_neighbor()
        
        # Apply new configuration
        old_config = {n: p.current_value for n, p in self.parameters.items()}
        self.apply_config(new_config)
        
        # Allow system to stabilize
        await asyncio.sleep(0.5)
        
        # Collect metrics with new configuration
        try:
            metrics = await metrics_collector()
        except Exception as e:
            logger.warning(f"[ConfigAnnealer] Metrics collection failed: {e}")
            # Revert on failure
            self.apply_config(old_config)
            return self.state.best_config
        
        # Calculate scores
        new_score = self.calculate_score(metrics)
        
        # Decide whether to accept
        if random.random() < self.accept_probability(self.state.current_score, new_score):
            self.state.current_score = new_score
            
            if new_score < self.state.best_score:
                self.state.best_score = new_score
                self.state.best_config = new_config.copy()
                self.state.last_improvement = self.state.iteration
                
                logger.info(
                    f"[ConfigAnnealer] New best config! Score: {new_score:.4f} "
                    f"(iteration {self.state.iteration})"
                )
                
                # Notify callbacks
                for callback in self._callbacks:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(new_config, new_score)
                        else:
                            callback(new_config, new_score)
                    except Exception as e:
                        logger.error(f"[ConfigAnnealer] Callback error: {e}")
        else:
            # Revert to previous configuration
            self.apply_config(old_config)
        
        # Record history
        self.metrics_history.append({
            "iteration": self.state.iteration,
            "temperature": self.state.temperature,
            "score": new_score,
            "accepted": new_score <= self.state.current_score,
            "config": new_config,
            "metrics": metrics,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep history bounded
        if len(self.metrics_history) > 1000:
            self.metrics_history = self.metrics_history[-500:]
        
        self.state.iteration += 1
        
        return self.state.best_config
    
    async def run_annealing(
        self,
        metrics_collector: Callable,
        max_iterations: int = 100,
        early_stop_iterations: int = 20
    ) -> Dict[str, Any]:
        """
        Run the full annealing process.
        
        Args:
            metrics_collector: Async function returning metrics dict
            max_iterations: Maximum iterations to run
            early_stop_iterations: Stop if no improvement for this many iterations
            
        Returns:
            Best configuration found
        """
        self._running = True
        self.state = AnnealingState(temperature=self.initial_temperature)
        self.state.started_at = datetime.now()
        
        # Initialize best config
        for name, param in self.parameters.items():
            self.state.best_config[name] = param.current_value
        
        # Get initial score
        try:
            initial_metrics = await metrics_collector()
            self.state.current_score = self.calculate_score(initial_metrics)
            self.state.best_score = self.state.current_score
        except Exception as e:
            logger.error(f"[ConfigAnnealer] Failed to get initial metrics: {e}")
            return self.state.best_config
        
        logger.info(
            f"[ConfigAnnealer] Starting annealing. Initial score: {self.state.best_score:.4f}"
        )
        
        while self._running:
            # Check termination conditions
            if self.state.temperature <= self.min_temperature:
                logger.info("[ConfigAnnealer] Reached minimum temperature")
                break
            
            if self.state.iteration >= max_iterations:
                logger.info("[ConfigAnnealer] Reached maximum iterations")
                break
            
            # Early stopping
            iterations_since_improvement = self.state.iteration - self.state.last_improvement
            if iterations_since_improvement >= early_stop_iterations:
                logger.info(
                    f"[ConfigAnnealer] Early stop: no improvement for "
                    f"{early_stop_iterations} iterations"
                )
                break
            
            # Run iterations at current temperature
            for _ in range(self.iterations_per_temp):
                if not self._running:
                    break
                await self.anneal_step(metrics_collector)
            
            # Cool down
            self.state.temperature *= self.cooling_rate
            
            logger.debug(
                f"[ConfigAnnealer] Temp: {self.state.temperature:.4f}, "
                f"Best: {self.state.best_score:.4f}, "
                f"Iter: {self.state.iteration}"
            )
        
        self.state.completed_at = datetime.now()
        
        # Apply best configuration
        self.apply_config(self.state.best_config)
        
        duration = (self.state.completed_at - self.state.started_at).total_seconds()
        logger.info(
            f"[ConfigAnnealer] Complete. Best score: {self.state.best_score:.4f} "
            f"({self.state.iteration} iterations in {duration:.1f}s)"
        )
        
        return self.state.best_config
    
    def stop(self) -> None:
        """Stop the annealing process."""
        self._running = False
        logger.info("[ConfigAnnealer] Stop requested")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current annealing status."""
        return {
            "running": self._running,
            "temperature": self.state.temperature,
            "iteration": self.state.iteration,
            "best_score": self.state.best_score,
            "current_score": self.state.current_score,
            "best_config": self.state.best_config,
            "last_improvement": self.state.last_improvement,
            "started_at": self.state.started_at.isoformat() if self.state.started_at else None,
            "parameters": {
                name: {
                    "current": param.current_value,
                    "min": param.min_value,
                    "max": param.max_value,
                    "step": param.step
                }
                for name, param in self.parameters.items()
            },
            "history_length": len(self.metrics_history)
        }
    
    def get_recent_history(self, n: int = 10) -> List[Dict]:
        """Get the n most recent history entries."""
        return self.metrics_history[-n:]
