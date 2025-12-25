#!/bin/bash
# =============================================================================
# MLX Setup Script for Docker PULSE
# =============================================================================
# This script sets up MLX Omni Server for local LLM inference on Apple Silicon.
# It installs dependencies, downloads models, and configures the environment.
#
# Usage:
#   ./scripts/setup-mlx.sh              # Interactive setup
#   ./scripts/setup-mlx.sh --auto       # Auto-select model based on RAM
#   ./scripts/setup-mlx.sh --model 32b  # Specify model size (14b, 32b, 72b, 235b)
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

# Model configurations
declare -A MODELS
MODELS["14b"]="mlx-community/Qwen2.5-14B-Instruct-4bit"
MODELS["32b"]="mlx-community/Qwen2.5-32B-Instruct-4bit"
MODELS["72b"]="mlx-community/Qwen2.5-72B-Instruct-4bit"
MODELS["235b"]="mlx-community/Qwen3-235B-A22B-4bit"

declare -A MODEL_RAM
MODEL_RAM["14b"]=16
MODEL_RAM["32b"]=32
MODEL_RAM["72b"]=64
MODEL_RAM["235b"]=192

declare -A MODEL_QUALITY
MODEL_QUALITY["14b"]="Acceptable"
MODEL_QUALITY["32b"]="Good"
MODEL_QUALITY["72b"]="Very Good"
MODEL_QUALITY["235b"]="Best (matches GPT-4o)"

# Default configuration
DEFAULT_PORT="10240"
AUTO_MODE=false
SELECTED_MODEL=""

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}${BOLD}           MLX Setup for Docker PULSE                          ${NC}${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}     Local LLM Inference on Apple Silicon (MPS/Metal)          ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}▶${NC} ${BOLD}$1${NC}"
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
        print_info "MLX is optimized for Apple Silicon Macs"
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
        print_info "MLX requires Apple Silicon for MPS/Metal GPU acceleration"
        exit 1
    fi
    
    # Get chip info
    CHIP_INFO=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
    print_success "Apple Silicon detected: $CHIP_INFO"
}

check_ram() {
    print_step "Checking available RAM..."
    
    TOTAL_RAM_BYTES=$(sysctl -n hw.memsize)
    TOTAL_RAM_GB=$((TOTAL_RAM_BYTES / 1024 / 1024 / 1024))
    
    print_success "Total RAM: ${TOTAL_RAM_GB}GB"
    
    # Recommend model based on RAM
    if [[ $TOTAL_RAM_GB -ge 192 ]]; then
        RECOMMENDED_MODEL="235b"
    elif [[ $TOTAL_RAM_GB -ge 64 ]]; then
        RECOMMENDED_MODEL="72b"
    elif [[ $TOTAL_RAM_GB -ge 32 ]]; then
        RECOMMENDED_MODEL="32b"
    elif [[ $TOTAL_RAM_GB -ge 16 ]]; then
        RECOMMENDED_MODEL="14b"
    else
        print_error "Insufficient RAM for local LLM inference"
        print_info "Minimum 16GB RAM required"
        print_info "Docker PULSE will fall back to cloud AI (Anthropic Claude)"
        exit 1
    fi
    
    print_info "Recommended model for your system: ${RECOMMENDED_MODEL} (${MODELS[$RECOMMENDED_MODEL]})"
}

check_python() {
    print_step "Checking Python installation..."
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        print_info "Install Python 3.10+ from https://www.python.org/downloads/"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    
    if [[ $PYTHON_MAJOR -lt 3 ]] || [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -lt 10 ]]; then
        print_error "Python 3.10+ required (found $PYTHON_VERSION)"
        print_info "Install Python 3.10+ from https://www.python.org/downloads/"
        exit 1
    fi
    
    print_success "Python $PYTHON_VERSION detected"
}

check_pip() {
    print_step "Checking pip installation..."
    
    if ! command -v pip3 &> /dev/null; then
        print_warning "pip3 not found, attempting to install..."
        python3 -m ensurepip --upgrade
    fi
    
    PIP_VERSION=$(pip3 --version | cut -d' ' -f2)
    print_success "pip $PIP_VERSION detected"
}

# =============================================================================
# Installation Functions
# =============================================================================

install_mlx_omni_server() {
    print_step "Installing MLX Omni Server..."
    
    if pip3 show mlx-omni-server > /dev/null 2>&1; then
        CURRENT_VERSION=$(pip3 show mlx-omni-server | grep Version | cut -d' ' -f2)
        print_success "MLX Omni Server already installed (version $CURRENT_VERSION)"
        
        echo -n "  Would you like to upgrade to the latest version? [y/N] "
        read -r UPGRADE
        if [[ "$UPGRADE" =~ ^[Yy]$ ]]; then
            pip3 install --upgrade mlx-omni-server
            print_success "MLX Omni Server upgraded"
        fi
    else
        pip3 install mlx-omni-server
        print_success "MLX Omni Server installed"
    fi
}

install_huggingface_cli() {
    print_step "Checking Hugging Face CLI..."
    
    if ! command -v huggingface-cli &> /dev/null; then
        print_info "Installing Hugging Face Hub CLI..."
        pip3 install huggingface_hub[cli]
    fi
    
    print_success "Hugging Face CLI available"
}

# =============================================================================
# Model Selection
# =============================================================================

select_model_interactive() {
    echo ""
    echo -e "${BOLD}Available Models:${NC}"
    echo ""
    echo "  ┌─────────┬────────────────────────────────────────────┬──────────┬─────────────────────────┐"
    echo "  │ Option  │ Model                                      │ RAM Req  │ Quality                 │"
    echo "  ├─────────┼────────────────────────────────────────────┼──────────┼─────────────────────────┤"
    
    for size in "14b" "32b" "72b" "235b"; do
        MODEL_NAME="${MODELS[$size]}"
        RAM_REQ="${MODEL_RAM[$size]}GB"
        QUALITY="${MODEL_QUALITY[$size]}"
        
        # Highlight recommended model
        if [[ "$size" == "$RECOMMENDED_MODEL" ]]; then
            echo -e "  │ ${GREEN}${size}${NC}     │ ${MODEL_NAME} │ ${RAM_REQ}    │ ${QUALITY} ${GREEN}← Recommended${NC} │"
        else
            # Check if model is too large for system
            if [[ ${MODEL_RAM[$size]} -gt $TOTAL_RAM_GB ]]; then
                echo -e "  │ ${RED}${size}${NC}     │ ${MODEL_NAME} │ ${RAM_REQ}    │ ${QUALITY} ${RED}(insufficient RAM)${NC} │"
            else
                echo "  │ ${size}     │ ${MODEL_NAME} │ ${RAM_REQ}    │ ${QUALITY} │"
            fi
        fi
    done
    
    echo "  └─────────┴────────────────────────────────────────────┴──────────┴─────────────────────────┘"
    echo ""
    
    echo -n "Select model size [14b/32b/72b/235b] (default: $RECOMMENDED_MODEL): "
    read -r MODEL_CHOICE
    
    if [[ -z "$MODEL_CHOICE" ]]; then
        SELECTED_MODEL="$RECOMMENDED_MODEL"
    elif [[ -n "${MODELS[$MODEL_CHOICE]}" ]]; then
        SELECTED_MODEL="$MODEL_CHOICE"
    else
        print_error "Invalid model selection: $MODEL_CHOICE"
        exit 1
    fi
    
    # Warn if model is too large
    if [[ ${MODEL_RAM[$SELECTED_MODEL]} -gt $TOTAL_RAM_GB ]]; then
        print_warning "Selected model requires ${MODEL_RAM[$SELECTED_MODEL]}GB RAM but you have ${TOTAL_RAM_GB}GB"
        echo -n "  Continue anyway? [y/N] "
        read -r CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    print_success "Selected model: ${MODELS[$SELECTED_MODEL]}"
}

download_model() {
    print_step "Downloading model: ${MODELS[$SELECTED_MODEL]}..."
    print_info "This may take several minutes depending on your internet connection"
    print_info "Model will be cached in ~/.cache/huggingface/"
    
    # Use huggingface-cli to download the model
    huggingface-cli download "${MODELS[$SELECTED_MODEL]}" --quiet
    
    print_success "Model downloaded successfully"
}

# =============================================================================
# Configuration
# =============================================================================

configure_env() {
    print_step "Configuring Docker PULSE environment..."
    
    ENV_FILE="$PROJECT_DIR/.env"
    
    if [[ ! -f "$ENV_FILE" ]]; then
        print_error ".env file not found at $ENV_FILE"
        exit 1
    fi
    
    # Update AI_PROVIDER to mlx
    if grep -q "^AI_PROVIDER=" "$ENV_FILE"; then
        sed -i '' 's/^AI_PROVIDER=.*/AI_PROVIDER=mlx/' "$ENV_FILE"
    else
        echo "AI_PROVIDER=mlx" >> "$ENV_FILE"
    fi
    
    # Update MLX_MODEL
    if grep -q "^MLX_MODEL=" "$ENV_FILE"; then
        sed -i '' "s|^MLX_MODEL=.*|MLX_MODEL=${MODELS[$SELECTED_MODEL]}|" "$ENV_FILE"
    else
        echo "MLX_MODEL=${MODELS[$SELECTED_MODEL]}" >> "$ENV_FILE"
    fi
    
    print_success "Environment configured"
    print_info "AI_PROVIDER=mlx"
    print_info "MLX_MODEL=${MODELS[$SELECTED_MODEL]}"
}

create_launchd_plist() {
    print_step "Creating launchd service for auto-start (optional)..."
    
    PLIST_PATH="$HOME/Library/LaunchAgents/com.dockerpulse.mlx-server.plist"
    
    echo -n "  Would you like MLX server to start automatically on login? [y/N] "
    read -r AUTO_START
    
    if [[ "$AUTO_START" =~ ^[Yy]$ ]]; then
        cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dockerpulse.mlx-server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which mlx-omni-server)</string>
        <string>--port</string>
        <string>${DEFAULT_PORT}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Logs/mlx-server.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Logs/mlx-server.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$(dirname $(which python3))</string>
    </dict>
</dict>
</plist>
EOF
        
        # Load the service
        launchctl load "$PLIST_PATH" 2>/dev/null || true
        
        print_success "Launchd service created and loaded"
        print_info "MLX server will start automatically on login"
        print_info "Logs: ~/Library/Logs/mlx-server.log"
    else
        print_info "Skipping auto-start configuration"
        print_info "Start manually with: ./scripts/start-mlx-server.sh"
    fi
}

# =============================================================================
# Verification
# =============================================================================

verify_installation() {
    print_step "Verifying installation..."
    
    # Check if mlx-omni-server is installed
    if ! command -v mlx-omni-server &> /dev/null; then
        print_error "mlx-omni-server command not found"
        exit 1
    fi
    
    print_success "MLX Omni Server is installed and ready"
}

start_server_test() {
    print_step "Testing MLX server startup..."
    
    # Start server in background
    mlx-omni-server --port $DEFAULT_PORT &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test health endpoint
    if curl -s "http://localhost:$DEFAULT_PORT/health" > /dev/null 2>&1; then
        print_success "MLX server is running on port $DEFAULT_PORT"
    else
        print_warning "Server started but health check failed (this is normal for first run)"
        print_info "The server may still be loading the model"
    fi
    
    # Stop test server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
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
    echo "  • AI Provider: MLX (local Apple Silicon)"
    echo "  • Model: ${MODELS[$SELECTED_MODEL]}"
    echo "  • Port: $DEFAULT_PORT"
    echo "  • Fallback: Anthropic Claude"
    echo ""
    echo -e "${BOLD}Next Steps:${NC}"
    echo ""
    echo "  1. Start the MLX server:"
    echo -e "     ${CYAN}./scripts/start-mlx-server.sh${NC}"
    echo ""
    echo "  2. In a new terminal, start Docker PULSE:"
    echo -e "     ${CYAN}docker compose up -d${NC}"
    echo ""
    echo "  3. Open the application:"
    echo -e "     ${CYAN}http://localhost:3050${NC}"
    echo ""
    echo -e "${BOLD}Useful Commands:${NC}"
    echo "  • Check MLX server status: curl http://localhost:$DEFAULT_PORT/health"
    echo "  • View MLX server logs: tail -f ~/Library/Logs/mlx-server.log"
    echo "  • Stop MLX server: pkill -f mlx-omni-server"
    echo ""
    echo -e "${YELLOW}Note: The first request may take 1-2 minutes while the model loads.${NC}"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto)
                AUTO_MODE=true
                shift
                ;;
            --model)
                if [[ -n "${MODELS[$2]}" ]]; then
                    SELECTED_MODEL="$2"
                else
                    print_error "Invalid model: $2"
                    print_info "Valid options: 14b, 32b, 72b, 235b"
                    exit 1
                fi
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --auto          Auto-select model based on available RAM"
                echo "  --model SIZE    Specify model size (14b, 32b, 72b, 235b)"
                echo "  --help          Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0              # Interactive setup"
                echo "  $0 --auto       # Auto-select best model for your system"
                echo "  $0 --model 72b  # Install 72B model"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

main() {
    parse_args "$@"
    
    print_header
    
    # System checks
    check_macos
    check_apple_silicon
    check_ram
    check_python
    check_pip
    
    echo ""
    
    # Installation
    install_mlx_omni_server
    install_huggingface_cli
    
    echo ""
    
    # Model selection
    if [[ -n "$SELECTED_MODEL" ]]; then
        print_info "Using specified model: ${MODELS[$SELECTED_MODEL]}"
    elif [[ "$AUTO_MODE" == true ]]; then
        SELECTED_MODEL="$RECOMMENDED_MODEL"
        print_info "Auto-selected model: ${MODELS[$SELECTED_MODEL]}"
    else
        select_model_interactive
    fi
    
    echo ""
    
    # Download model
    download_model
    
    echo ""
    
    # Configuration
    configure_env
    create_launchd_plist
    
    echo ""
    
    # Verification
    verify_installation
    
    # Summary
    print_summary
}

main "$@"
