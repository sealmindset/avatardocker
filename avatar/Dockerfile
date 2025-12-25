# LiteAvatar Docker Service
# Runs on CPU - no GPU required
# Generates talking avatar videos from audio input
# Modified to work with newer numpy versions

FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    git \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Clone lite-avatar repository
RUN git clone https://github.com/HumanAIGC/lite-avatar.git /app/lite-avatar

WORKDIR /app/lite-avatar

# Install Python dependencies (CPU-only versions of PyTorch)
RUN pip install --no-cache-dir torch==2.1.1 torchvision==0.16.1 torchaudio==2.1.1 --index-url https://download.pytorch.org/whl/cpu

# Install numpy 1.24.x (last version with np.float etc, but has _typing)
RUN pip install --no-cache-dir "numpy>=1.24.0,<1.25.0"

# Install opencv-python-headless first (instead of opencv-python)
RUN pip install --no-cache-dir opencv-python-headless

# Install ALL dependencies from requirements.txt (excluding torch/triton/opencv/numpy/modelscope)
# We'll handle modelscope separately with relaxed constraints
RUN grep -v "^torch" requirements.txt | \
    grep -v "^triton" | \
    grep -v "^Wave" | \
    grep -v "^numpy" | \
    grep -v "^modelscope" | \
    grep -v "opencv-python" > requirements_filtered.txt && \
    pip install --no-cache-dir -r requirements_filtered.txt || true

# Ensure ALL critical packages are installed with correct versions
RUN pip install --no-cache-dir \
    loguru \
    pydub \
    librosa \
    soundfile \
    imageio \
    imageio-ffmpeg \
    onnxruntime \
    "typeguard>=2.13.0,<3.0.0" \
    einops \
    six \
    rotary-embedding-torch \
    pyyaml \
    omegaconf \
    hydra-core \
    jamo \
    jaconv \
    jieba \
    sentencepiece \
    editdistance \
    addict \
    simplejson \
    h5py \
    huggingface-hub

# Install FastAPI for the API wrapper
RUN pip install --no-cache-dir fastapi uvicorn python-multipart aiofiles

# Install modelscope with --no-deps to avoid numpy constraint, then fix deps
RUN pip install --no-cache-dir --no-deps modelscope && \
    pip install --no-cache-dir packaging requests tqdm filelock

# Download models
RUN modelscope download --model HumanAIGC-Engineering/LiteAvatarGallery \
    lite_avatar_weights/lm.pb \
    lite_avatar_weights/model_1.onnx \
    lite_avatar_weights/model.pb \
    --local_dir ./ && \
    mkdir -p ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/lm/ && \
    mv lite_avatar_weights/lm.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/lm/ && \
    mv lite_avatar_weights/model_1.onnx ./weights/ && \
    mv lite_avatar_weights/model.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/ && \
    rm -rf lite_avatar_weights

# Download sample avatar data
RUN cd data && unzip sample_data.zip -d sample_data || true

# Copy patches for numpy/typeguard compatibility
COPY lite-avatar-patches/ /app/patches/

# Apply patches to LiteAvatar code
RUN chmod +x /app/patches/patch_liteavatar.sh && /app/patches/patch_liteavatar.sh

# Copy API wrapper and avatar pool manager
COPY api_server.py /app/lite-avatar/api_server.py
COPY avatar_pool.py /app/lite-avatar/avatar_pool.py

EXPOSE 8080

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8080"]
