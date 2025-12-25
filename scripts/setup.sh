#!/bin/bash
# =============================================================================
# Docker PULSE - First-Time Setup Script
# =============================================================================
# This script sets up Docker PULSE on a fresh Apple Silicon Mac (M1/M2/M3/M4).
# It installs all dependencies, configures the environment, and starts services.
#
# Prerequisites:
#   - macOS with Apple Silicon (M1/M2/M3/M4)
#   - 32GB+ RAM recommended (16GB minimum)
#
# Usage:
#   ./scripts/setup.sh
# =============================================================================

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}${BOLD}              Docker PULSE - First-Time Setup                   ${NC}${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}     100% Local AI on Apple Silicon (MPS/Metal GPU)             ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "\n${CYAN}▶${NC} ${BOLD}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# =============================================================================
# System Checks
# =============================================================================

check_macos() {
    print_step "Checking operating system..."
    
    if [[ "$(uname)" != "Darwin" ]]; then
        print_error "This script requires macOS"
        exit 1
    fi
    print_success "macOS detected"
}

check_apple_silicon() {
    print_step "Checking for Apple Silicon..."
    
    ARCH=$(uname -m)
    if [[ "$ARCH" != "arm64" ]]; then
        print_error "This script requires Apple Silicon (M1/M2/M3/M4)"
        print_info "Detected architecture: $ARCH"
        exit 1
    fi
    
    CHIP_INFO=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
    print_success "Apple Silicon detected: $CHIP_INFO"
}

check_ram() {
    print_step "Checking available RAM..."
    
    TOTAL_RAM_BYTES=$(sysctl -n hw.memsize)
    TOTAL_RAM_GB=$((TOTAL_RAM_BYTES / 1024 / 1024 / 1024))
    
    print_success "Total RAM: ${TOTAL_RAM_GB}GB"
    
    if [[ $TOTAL_RAM_GB -lt 16 ]]; then
        print_error "Minimum 16GB RAM required for local LLM inference"
        exit 1
    fi
    
    # Recommend model based on RAM
    if [[ $TOTAL_RAM_GB -ge 192 ]]; then
        RECOMMENDED_MODEL="mlx-community/Qwen3-235B-A22B-4bit"
        MODEL_SIZE="235b"
    elif [[ $TOTAL_RAM_GB -ge 64 ]]; then
        RECOMMENDED_MODEL="mlx-community/Qwen2.5-72B-Instruct-4bit"
        MODEL_SIZE="72b"
    elif [[ $TOTAL_RAM_GB -ge 32 ]]; then
        RECOMMENDED_MODEL="mlx-community/Qwen2.5-32B-Instruct-4bit"
        MODEL_SIZE="32b"
    else
        RECOMMENDED_MODEL="mlx-community/Qwen2.5-14B-Instruct-4bit"
        MODEL_SIZE="14b"
    fi
    
    print_info "Recommended model: ${MODEL_SIZE} (${RECOMMENDED_MODEL})"
}

# =============================================================================
# Dependency Installation
# =============================================================================

check_homebrew() {
    print_step "Checking Homebrew..."
    
    if ! command -v brew &> /dev/null; then
        print_warning "Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    print_success "Homebrew installed"
}

check_docker() {
    print_step "Checking Docker Desktop..."
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Please install Docker Desktop for Mac."
        print_info "Download from: https://www.docker.com/products/docker-desktop/"
        echo ""
        echo -n "Press Enter after installing Docker Desktop..."
        read -r
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_warning "Docker Desktop is not running. Please start it."
        echo -n "Press Enter after starting Docker Desktop..."
        read -r
    fi
    
    print_success "Docker Desktop is running"
}

check_python() {
    print_step "Checking Python installation..."
    
    if ! command -v python3 &> /dev/null; then
        print_warning "Python 3 not found. Installing via Homebrew..."
        brew install python@3.11
    fi
    
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    
    if [[ $PYTHON_MAJOR -lt 3 ]] || [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -lt 10 ]]; then
        print_warning "Python 3.10+ required (found $PYTHON_VERSION). Installing..."
        brew install python@3.11
    fi
    
    print_success "Python $PYTHON_VERSION detected"
}

check_git() {
    print_step "Checking Git..."
    
    if ! command -v git &> /dev/null; then
        print_warning "Git not found. Installing via Homebrew..."
        brew install git
    fi
    
    print_success "Git installed"
}

# =============================================================================
# Project Setup
# =============================================================================

setup_env_file() {
    print_step "Setting up environment file..."
    
    if [[ ! -f "$PROJECT_DIR/.env" ]]; then
        if [[ -f "$PROJECT_DIR/.env.example" ]]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            print_success "Created .env from .env.example"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
    
    # Update MLX model based on RAM
    sed -i '' "s|^MLX_MODEL=.*|MLX_MODEL=${RECOMMENDED_MODEL}|" "$PROJECT_DIR/.env"
    print_info "Set MLX_MODEL to ${RECOMMENDED_MODEL}"
}

# =============================================================================
# MLX Setup
# =============================================================================

install_mlx() {
    print_step "Installing MLX Omni Server..."
    
    if pip3 show mlx-omni-server > /dev/null 2>&1; then
        print_success "MLX Omni Server already installed"
    else
        pip3 install mlx-omni-server
        print_success "MLX Omni Server installed"
    fi
}

download_model() {
    print_step "Downloading LLM model: ${RECOMMENDED_MODEL}..."
    print_info "This may take 5-30 minutes depending on your internet connection"
    print_info "Model size: ~18-120GB depending on model"
    
    # Start MLX server in background to trigger download
    mlx-omni-server --port 10240 &
    MLX_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Trigger model download with a test request
    print_info "Triggering model download..."
    curl -s http://localhost:10240/v1/chat/completions \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"${RECOMMENDED_MODEL}\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}], \"max_tokens\": 10}" \
        > /dev/null 2>&1 &
    
    # Wait for download to complete (check every 30 seconds)
    echo -n "Downloading model"
    while ! curl -s http://localhost:10240/v1/models 2>/dev/null | grep -q "Qwen"; do
        echo -n "."
        sleep 30
    done
    echo ""
    
    # Stop the test server
    kill $MLX_PID 2>/dev/null || true
    wait $MLX_PID 2>/dev/null || true
    
    print_success "Model downloaded successfully"
}

# =============================================================================
# Docker Setup
# =============================================================================

build_docker() {
    print_step "Building Docker containers..."
    
    cd "$PROJECT_DIR"
    docker compose build
    
    print_success "Docker containers built"
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}${BOLD}                    Setup Complete!                              ${NC}${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Configuration:${NC}"
    echo "  • AI Provider: MLX (100% local, no cloud)"
    echo "  • Model: ${RECOMMENDED_MODEL}"
    echo "  • TTS: Local Piper TTS"
    echo "  • RAM: ${TOTAL_RAM_GB}GB"
    echo ""
    echo -e "${BOLD}To Start Docker PULSE:${NC}"
    echo ""
    echo "  1. Start the MLX server (Terminal 1):"
    echo -e "     ${CYAN}./scripts/start-mlx-server.sh${NC}"
    echo ""
    echo "  2. Start Docker PULSE (Terminal 2):"
    echo -e "     ${CYAN}docker compose up -d${NC}"
    echo ""
    echo "  3. Open the application:"
    echo -e "     ${CYAN}http://localhost:3050${NC}"
    echo ""
    echo -e "${BOLD}Useful Commands:${NC}"
    echo "  • View logs: docker compose logs -f"
    echo "  • Stop all: docker compose down"
    echo "  • Stop MLX: pkill -f mlx-omni-server"
    echo ""
    echo -e "${YELLOW}Note: First AI response may take 1-2 minutes while model loads.${NC}"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    print_header
    
    # System checks
    check_macos
    check_apple_silicon
    check_ram
    
    # Dependencies
    check_homebrew
    check_docker
    check_python
    check_git
    
    # Project setup
    setup_env_file
    
    # MLX setup
    install_mlx
    download_model
    
    # Docker setup
    build_docker
    
    # Summary
    print_summary
}

main "$@"
