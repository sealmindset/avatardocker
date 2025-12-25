FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    piper-tts \
    fastapi \
    uvicorn[standard]

# Copy server code
COPY server.py .

# Download voice model during build
RUN mkdir -p /app/voices && \
    python -c "from piper import PiperVoice; PiperVoice.load('en_US-amy-medium', download_dir='/app/voices')" || true

# Alternative: download directly from HuggingFace
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    curl -L -o /app/voices/en_US-amy-medium.onnx \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx?download=true" && \
    curl -L -o /app/voices/en_US-amy-medium.onnx.json \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json?download=true" && \
    apt-get remove -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

ENV PIPER_VOICE_MODEL=/app/voices/en_US-amy-medium.onnx

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
