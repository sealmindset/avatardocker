#!/bin/bash
# ===========================================
# Native Avatar Service Runner (MPS/Metal GPU Acceleration)
# ===========================================
# This script runs the LiteAvatar service natively on macOS
# to leverage MPS (Metal Performance Shaders) for GPU acceleration.
# 
# Prerequisites:
#   - Python 3.10+ installed
#   - Run: ./setup_native.sh first to create venv and install dependencies
#
# Usage:
#   ./run_native.sh
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
LITE_AVATAR_DIR="$SCRIPT_DIR/lite-avatar"
PORT=${AVATAR_PORT:-8060}

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Virtual environment not found. Run ./setup_native.sh first."
    exit 1
fi

# Check if lite-avatar exists
if [ ! -d "$LITE_AVATAR_DIR" ]; then
    echo "❌ LiteAvatar not found. Run ./setup_native.sh first."
    exit 1
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Set environment variables for MPS/Metal
export PYTORCH_ENABLE_MPS_FALLBACK=1
export AVATAR_DATA_DIR="$LITE_AVATAR_DIR/data/sample_data/preload"
export AVATAR_USE_GPU=true

# Add lite-avatar to Python path so lite_avatar module can be imported
export PYTHONPATH="$LITE_AVATAR_DIR:$PYTHONPATH"

echo "🚀 Starting Native Avatar Service with MPS/Metal acceleration..."
echo "   Port: $PORT"
echo "   Data: $AVATAR_DATA_DIR"
echo "   GPU:  MPS/Metal enabled"

# Run the API server from the lite-avatar directory
cd "$LITE_AVATAR_DIR"
python "$SCRIPT_DIR/api_server.py" --port $PORT --gpu
