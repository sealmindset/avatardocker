#!/usr/bin/env python3
"""
Piper TTS HTTP Server - Fast local neural text-to-speech.
Provides an API endpoint for TTS using Piper voices.
"""

import asyncio
import base64
import io
import os
import wave
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from piper import PiperVoice

app = FastAPI(
    title="Piper TTS Server",
    description="Fast local neural TTS using Piper",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load voice model on startup
VOICE_MODEL_PATH = os.getenv("PIPER_VOICE_MODEL", "/app/voices/en_US-amy-medium.onnx")
voice: Optional[PiperVoice] = None

@app.on_event("startup")
async def load_voice():
    global voice
    print(f"Loading Piper voice model: {VOICE_MODEL_PATH}")
    voice = PiperVoice.load(VOICE_MODEL_PATH)
    print("Piper voice model loaded successfully")

class TTSRequest(BaseModel):
    input: str
    voice: str = "amy"  # ignored for now, using single voice
    speed: float = 1.0

class TTSResponse(BaseModel):
    audio_base64: str
    format: str
    duration_seconds: float

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "piper-tts-server", "voice_loaded": voice is not None}

@app.get("/voices")
async def list_voices():
    return {
        "voices": [
            {"id": "amy", "name": "Amy (US English)", "language": "en-US"}
        ]
    }

@app.post("/tts")
async def synthesize(request: TTSRequest):
    """Generate speech from text using Piper TTS."""
    if voice is None:
        raise HTTPException(status_code=503, detail="Voice model not loaded")
    
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="Empty input text")
    
    try:
        # Generate audio
        audio_buffer = io.BytesIO()
        
        with wave.open(audio_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(voice.config.sample_rate)
            
            # Synthesize and write audio using correct Piper API
            for chunk in voice.synthesize(request.input):
                wav_file.writeframes(chunk.audio_int16_bytes)
        
        # Get the audio data
        audio_data = audio_buffer.getvalue()
        
        # Calculate duration
        duration = len(audio_data) / (voice.config.sample_rate * 2)  # 16-bit = 2 bytes per sample
        
        return TTSResponse(
            audio_base64=base64.b64encode(audio_data).decode("utf-8"),
            format="wav",
            duration_seconds=duration
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/audio/speech")
async def openai_compatible_tts(request: TTSRequest):
    """OpenAI-compatible TTS endpoint."""
    return await synthesize(request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
