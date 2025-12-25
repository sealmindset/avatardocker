#!/bin/bash
# ===========================================
# AvatarDocker Startup Script
# ===========================================
# This script starts all services with MLX LLM support
#
# AVATAR_MODE options:
#   native (default) - Run avatar natively with MPS/Metal GPU acceleration
#   docker - Run avatar in Docker container (CPU only, slower)
#
# Usage:
#   ./start.sh          # Start with default settings from .env
#   ./start.sh native   # Force native avatar mode
#   ./start.sh docker   # Force docker avatar mode
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env file (only lines with valid KEY=value format)
if [ -f .env ]; then
    set -a
    source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | grep -v '^#')
    set +a
fi

# Override AVATAR_MODE from command line if provided
if [ -n "$1" ]; then
    AVATAR_MODE="$1"
fi

# Default to native mode
AVATAR_MODE="${AVATAR_MODE:-native}"

# MLX LLM configuration
MLX_PORT="${MLX_PORT:-10240}"
MLX_MODEL="${MLX_MODEL:-mlx-community/Qwen2.5-32B-Instruct-4bit}"

echo "=========================================="
echo "  AvatarDocker Startup"
echo "=========================================="
echo "  Avatar Mode: $AVATAR_MODE"
echo "  AI Provider: MLX (Apple Silicon)"
echo "=========================================="
echo ""

# Function to check if native avatar is set up
check_native_setup() {
    if [ ! -d "$SCRIPT_DIR/avatar/.venv" ]; then
        echo "⚠️  Native avatar environment not set up."
        echo "   Run: cd avatar && ./setup_native.sh"
        return 1
    fi
    return 0
}

# Function to start native avatar service
start_native_avatar() {
    echo "🚀 Starting native avatar service (MPS/Metal GPU)..."
    
    if ! check_native_setup; then
        echo ""
        echo "Would you like to set up native avatar now? (y/n)"
        read -r response
        if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
            cd "$SCRIPT_DIR/avatar"
            ./setup_native.sh
            cd "$SCRIPT_DIR"
        else
            echo "Falling back to docker avatar mode..."
            AVATAR_MODE="docker"
            return 1
        fi
    fi
    
    # Check if avatar is already running
    if lsof -i :8160 > /dev/null 2>&1; then
        echo "✅ Avatar service already running on port 8160"
    else
        echo "   Starting avatar on port 8160..."
        cd "$SCRIPT_DIR/avatar"
        ./run_native.sh --port 8160 &
        AVATAR_PID=$!
        cd "$SCRIPT_DIR"
        
        # Wait for avatar to be ready
        echo "   Waiting for avatar service to be ready..."
        for i in {1..30}; do
            if curl -s http://localhost:8160/health > /dev/null 2>&1; then
                echo "✅ Avatar service ready!"
                break
            fi
            sleep 1
        done
    fi
    return 0
}

# Function to stop native avatar service
stop_native_avatar() {
    if lsof -i :8160 > /dev/null 2>&1; then
        echo "Stopping native avatar service..."
        pkill -f "python api_server.py --port 8160" || true
    fi
}

# Function to check if MLX LLM server is running
check_mlx_running() {
    if curl -s "http://localhost:$MLX_PORT/v1/models" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to start MLX LLM server (required for avatardocker)
start_mlx_server() {
    echo "🧠 MLX LLM Server (required for AvatarDocker)..."
    
    # Check if already running
    if check_mlx_running; then
        echo "✅ MLX LLM server already running on port $MLX_PORT"
        return 0
    fi
    
    # Check if on Apple Silicon
    if [[ "$(uname)" != "Darwin" ]] || [[ "$(uname -m)" != "arm64" ]]; then
        echo "❌ MLX requires Apple Silicon (M1/M2/M3/M4)."
        echo "   AvatarDocker cannot run without MLX."
        exit 1
    fi
    
    # Check if mlx-omni-server is installed
    if ! command -v mlx-omni-server &> /dev/null; then
        echo "   Installing mlx-omni-server..."
        pip3 install mlx-omni-server --quiet
    fi
    
    echo "   Starting MLX LLM server on port $MLX_PORT..."
    echo "   Model: $MLX_MODEL"
    
    # Start in background, redirect output to log file
    MLX_LOG="$SCRIPT_DIR/logs/mlx-server.log"
    mkdir -p "$SCRIPT_DIR/logs"
    
    nohup mlx-omni-server --port "$MLX_PORT" > "$MLX_LOG" 2>&1 &
    MLX_PID=$!
    echo $MLX_PID > "$SCRIPT_DIR/logs/mlx-server.pid"
    
    # Wait for server to be ready (up to 120 seconds for model loading)
    echo "   Waiting for MLX server to be ready (may take time on first run)..."
    for i in {1..120}; do
        if check_mlx_running; then
            echo "✅ MLX LLM server ready!"
            return 0
        fi
        # Check if process is still running
        if ! kill -0 $MLX_PID 2>/dev/null; then
            echo "❌ MLX server failed to start. Check $MLX_LOG"
            exit 1
        fi
        sleep 2
    done
    
    echo "⚠️  MLX server taking too long to start (model may still be downloading)"
    echo "   Check progress: tail -f $MLX_LOG"
    echo "   Continuing with startup..."
    return 0
}

# Start MLX LLM server (required)
start_mlx_server

# Start Docker services
echo ""
echo "🐳 Starting Docker services..."

if [ "$AVATAR_MODE" = "native" ]; then
    # Native mode: start avatar natively, Docker services without avatar
    export AVATAR_MODE=native
    
    # Start native avatar first
    if start_native_avatar; then
        echo ""
        echo "🐳 Starting Docker services (without avatar container)..."
        docker compose up -d db api ui piper-tts
    else
        # Fallback to docker mode
        echo ""
        echo "🐳 Starting Docker services (with avatar container)..."
        docker compose --profile avatar up -d
    fi
else
    # Docker mode: start all services including avatar container
    export AVATAR_MODE=docker
    echo "🐳 Starting Docker services (with avatar container)..."
    docker compose --profile avatar up -d
fi

echo ""
echo "=========================================="
echo "  AvatarDocker Started!"
echo "=========================================="
echo ""
echo "  UI:     http://localhost:3150"
echo "  API:    http://localhost:8150"
echo "  Avatar: http://localhost:8160 ($AVATAR_MODE mode)"
echo "  TTS:    http://localhost:8170"
echo "  MLX:    http://localhost:$MLX_PORT (local LLM)"
echo ""
echo "  AI Provider: MLX (Apple Silicon)"
echo "  Login: demo / demo"
echo ""
echo "  To stop: ./stop.sh"
echo "=========================================="
