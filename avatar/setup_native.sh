#!/bin/bash
# ===========================================
# Native Avatar Service Setup (MPS/Metal GPU Acceleration)
# ===========================================
# This script sets up the LiteAvatar service to run natively on macOS
# with MPS (Metal Performance Shaders) for GPU acceleration.
#
# Requirements:
#   - macOS with Apple Silicon (M1/M2/M3/M4)
#   - Python 3.10+ installed
#   - Homebrew (for ffmpeg)
#
# Usage:
#   ./setup_native.sh
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

echo "🔧 Setting up Native Avatar Service with MPS/Metal support..."
echo "   Directory: $SCRIPT_DIR"

# Check for Python 3.10+ (prefer 3.11 as 3.12 removed distutils)
PYTHON_CMD=""
for cmd in python3.11 python3.10 python3.12 python3; do
    if command -v $cmd &> /dev/null; then
        version=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        major=$(echo $version | cut -d. -f1)
        minor=$(echo $version | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
            PYTHON_CMD=$cmd
            echo "✅ Found Python $version at $(which $cmd)"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Python 3.10+ is required but not found."
    echo "   Install with: brew install python@3.11"
    exit 1
fi

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg not found. Installing with Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo "❌ Homebrew not found. Install ffmpeg manually or install Homebrew first."
        exit 1
    fi
fi
echo "✅ ffmpeg found at $(which ffmpeg)"

# Create virtual environment
if [ -d "$VENV_DIR" ]; then
    echo "🔄 Removing existing virtual environment..."
    rm -rf "$VENV_DIR"
fi

echo "📦 Creating virtual environment..."
$PYTHON_CMD -m venv "$VENV_DIR"

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install PyTorch with MPS support (Apple Silicon)
echo "📦 Installing PyTorch with MPS/Metal support..."
pip install torch torchvision torchaudio

# Install other dependencies
echo "📦 Installing avatar dependencies..."
pip install \
    fastapi \
    uvicorn \
    pydub \
    numpy \
    opencv-python-headless \
    pillow \
    scipy \
    requests \
    python-multipart

# Clone/update LiteAvatar if needed
LITE_AVATAR_DIR="$SCRIPT_DIR/lite-avatar"
if [ ! -d "$LITE_AVATAR_DIR" ]; then
    echo "📥 Cloning LiteAvatar repository..."
    git clone https://github.com/HumanAIGC/lite-avatar.git "$LITE_AVATAR_DIR"
else
    echo "✅ LiteAvatar directory exists"
fi

# Install LiteAvatar dependencies
echo "📦 Installing LiteAvatar dependencies..."
cd "$LITE_AVATAR_DIR"

# Install additional dependencies from requirements.txt (filtering out problematic ones)
if [ -f requirements.txt ]; then
    echo "📦 Installing from requirements.txt..."
    grep -v "^torch" requirements.txt | \
        grep -v "^triton" | \
        grep -v "^Wave" | \
        grep -v "^numpy" | \
        grep -v "^modelscope" | \
        grep -v "opencv-python" > requirements_filtered.txt
    pip install -r requirements_filtered.txt || true
fi

# Install critical packages
pip install \
    loguru \
    pydub \
    librosa \
    soundfile \
    imageio \
    imageio-ffmpeg \
    onnxruntime \
    "typeguard>=2.13.0,<3.0.0" \
    einops \
    rotary-embedding-torch \
    omegaconf \
    hydra-core \
    huggingface-hub \
    modelscope

# Download models using modelscope
echo "📥 Downloading LiteAvatar models..."
python -c "
from modelscope import snapshot_download
snapshot_download('HumanAIGC-Engineering/LiteAvatarGallery', 
                  allow_patterns=['lite_avatar_weights/*'],
                  local_dir='.')
" || echo "⚠️ Model download may have failed, will try on first run"

# Set up weights directory
if [ -d "lite_avatar_weights" ]; then
    mkdir -p ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/lm/
    mv lite_avatar_weights/lm.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/lm/ 2>/dev/null || true
    mv lite_avatar_weights/model_1.onnx ./weights/ 2>/dev/null || true
    mv lite_avatar_weights/model.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/ 2>/dev/null || true
    rm -rf lite_avatar_weights
fi

# Unzip sample data if needed
if [ -f "data/sample_data.zip" ] && [ ! -d "data/sample_data" ]; then
    echo "📦 Extracting sample data..."
    cd data && unzip -o sample_data.zip -d sample_data || true
    cd ..
fi

# Apply patches for numpy/typeguard compatibility
if [ -d "$SCRIPT_DIR/lite-avatar-patches" ]; then
    echo "🔧 Applying compatibility patches..."
    cp -r "$SCRIPT_DIR/lite-avatar-patches/"* "$LITE_AVATAR_DIR/" 2>/dev/null || true
    if [ -f "$LITE_AVATAR_DIR/patch_liteavatar.sh" ]; then
        chmod +x "$LITE_AVATAR_DIR/patch_liteavatar.sh"
        cd "$LITE_AVATAR_DIR" && ./patch_liteavatar.sh || true
    fi
fi

# Try to install lite_avatar as a package
pip install -e . 2>/dev/null || pip install . 2>/dev/null || echo "⚠️ Package install skipped"

# Verify MPS is available
echo ""
echo "🔍 Verifying MPS/Metal GPU support..."
python -c "
import torch
print(f'   PyTorch version: {torch.__version__}')
print(f'   MPS available: {torch.backends.mps.is_available()}')
print(f'   MPS built: {torch.backends.mps.is_built()}')
if torch.backends.mps.is_available():
    print('   ✅ MPS/Metal GPU acceleration is available!')
else:
    print('   ⚠️  MPS not available, will use CPU')
"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the native avatar service:"
echo "   cd $SCRIPT_DIR"
echo "   ./run_native.sh"
echo ""
echo "Or run manually:"
echo "   source $VENV_DIR/bin/activate"
echo "   python api_server.py --port 8060"
