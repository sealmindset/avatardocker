#!/bin/bash
# ===========================================
# AvatarDocker Stop Script
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Stopping AvatarDocker services..."

# Stop native avatar if running
if lsof -i :8160 > /dev/null 2>&1; then
    echo "   Stopping native avatar service..."
    pkill -f "python api_server.py --port 8160" || true
fi

# Stop MLX LLM server if running
if [ -f "$SCRIPT_DIR/logs/mlx-server.pid" ]; then
    MLX_PID=$(cat "$SCRIPT_DIR/logs/mlx-server.pid")
    if kill -0 $MLX_PID 2>/dev/null; then
        echo "   Stopping MLX LLM server..."
        kill $MLX_PID 2>/dev/null || true
        rm -f "$SCRIPT_DIR/logs/mlx-server.pid"
    fi
fi

# Stop Docker services
echo "   Stopping Docker services..."
docker compose --profile avatar down

echo ""
echo "✅ All AvatarDocker services stopped."
