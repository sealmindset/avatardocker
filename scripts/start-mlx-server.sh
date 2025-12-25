#!/bin/bash
# =============================================================================
# MLX Omni Server Startup Script for Docker PULSE
# =============================================================================
# This script starts the MLX Omni Server for local LLM inference on Apple Silicon.
# It provides an OpenAI-compatible API for the Docker PULSE application.
#
# Prerequisites:
#   - macOS with Apple Silicon (M1/M2/M3/M4)
#   - Python 3.10+ with pip
#   - Sufficient RAM for the chosen model
#
# Usage:
#   ./scripts/start-mlx-server.sh
#   ./scripts/start-mlx-server.sh --model mlx-community/Qwen2.5-72B-Instruct-4bit
#   ./scripts/start-mlx-server.sh --port 10240
# =============================================================================

set -e

# Default configuration
DEFAULT_MODEL="mlx-community/Qwen2.5-32B-Instruct-4bit"
DEFAULT_PORT="10240"

# Parse command line arguments
MODEL="${MLX_MODEL:-$DEFAULT_MODEL}"
PORT="${MLX_PORT:-$DEFAULT_PORT}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --model)
            MODEL="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --model MODEL    MLX model to use (default: $DEFAULT_MODEL)"
            echo "  --port PORT      Port to run server on (default: $DEFAULT_PORT)"
            echo "  --help           Show this help message"
            echo ""
            echo "Available models (by RAM requirement):"
            echo "  mlx-community/Qwen3-235B-A22B-4bit      (192GB+ RAM, best quality)"
            echo "  mlx-community/Qwen2.5-72B-Instruct-4bit (64GB RAM, very good)"
            echo "  mlx-community/Qwen2.5-32B-Instruct-4bit (32GB RAM, good)"
            echo "  mlx-community/Qwen2.5-14B-Instruct-4bit (16GB RAM, acceptable)"
            echo ""
            echo "Environment variables:"
            echo "  MLX_MODEL        Override default model"
            echo "  MLX_PORT         Override default port"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  MLX Omni Server for Docker PULSE${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Check if running on macOS with Apple Silicon
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}Error: This script requires macOS${NC}"
    exit 1
fi

ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${RED}Error: This script requires Apple Silicon (M1/M2/M3/M4)${NC}"
    echo -e "${YELLOW}Detected architecture: $ARCH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Running on Apple Silicon ($ARCH)${NC}"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

if [[ $PYTHON_MAJOR -lt 3 ]] || [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -lt 10 ]]; then
    echo -e "${RED}Error: Python 3.10+ required (found $PYTHON_VERSION)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python $PYTHON_VERSION detected${NC}"

# Check available RAM
TOTAL_RAM_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
echo -e "${GREEN}✓ Available RAM: ${TOTAL_RAM_GB}GB${NC}"

# Recommend model based on RAM
if [[ $TOTAL_RAM_GB -ge 192 ]]; then
    RECOMMENDED="mlx-community/Qwen3-235B-A22B-4bit"
elif [[ $TOTAL_RAM_GB -ge 64 ]]; then
    RECOMMENDED="mlx-community/Qwen2.5-72B-Instruct-4bit"
elif [[ $TOTAL_RAM_GB -ge 32 ]]; then
    RECOMMENDED="mlx-community/Qwen2.5-32B-Instruct-4bit"
else
    RECOMMENDED="mlx-community/Qwen2.5-14B-Instruct-4bit"
fi

if [[ "$MODEL" != "$RECOMMENDED" ]]; then
    echo -e "${YELLOW}Note: Based on your RAM, recommended model is: $RECOMMENDED${NC}"
fi

# Install mlx-omni-server if not present
if ! pip3 show mlx-omni-server > /dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}Installing mlx-omni-server...${NC}"
    pip3 install mlx-omni-server
    echo -e "${GREEN}✓ mlx-omni-server installed${NC}"
else
    echo -e "${GREEN}✓ mlx-omni-server already installed${NC}"
fi

echo ""
echo -e "${BLUE}Starting MLX Omni Server...${NC}"
echo -e "  Model: ${GREEN}$MODEL${NC}"
echo -e "  Port:  ${GREEN}$PORT${NC}"
echo -e "  API:   ${GREEN}http://localhost:$PORT/v1${NC}"
echo ""
echo -e "${YELLOW}The first request will download the model if not cached.${NC}"
echo -e "${YELLOW}This may take several minutes for large models.${NC}"
echo ""
echo -e "${BLUE}To use with Docker PULSE, set in .env:${NC}"
echo -e "  AI_PROVIDER=mlx"
echo -e "  MLX_BASE_URL=http://host.docker.internal:$PORT"
echo -e "  MLX_MODEL=$MODEL"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Start the server
exec mlx-omni-server --port "$PORT"
