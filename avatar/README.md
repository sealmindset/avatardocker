# LiteAvatar Service for Docker PULSE

This service provides a talking avatar that generates lip-synced video from audio input.

## Features

- **CPU-only** - No GPU required
- **30fps real-time** - Fast enough for conversation
- **REST API** - Easy integration with FastAPI
- **Docker-ready** - Runs as a container service

## Architecture

```
Audio (WAV) → LiteAvatar → Video (MP4)
```

The service uses the [HumanAIGC/lite-avatar](https://github.com/HumanAIGC/lite-avatar) model which:
1. Extracts audio features using Paraformer ASR
2. Predicts mouth parameters from audio
3. Renders a 2D face with synchronized lip movements

## Usage

### Start with Avatar (Optional)

```bash
# Start all services including avatar
docker compose --profile avatar up -d

# Or just build the avatar service
docker compose --profile avatar build avatar
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/avatars` | GET | List available avatars |
| `/render` | POST | Render video from base64 audio |
| `/render/upload` | POST | Render video from uploaded file |

### Example: Render from Base64 Audio

```bash
# Convert audio to base64
AUDIO_B64=$(base64 -i audio.wav)

# Request video
curl -X POST http://localhost:8060/render \
  -H "Content-Type: application/json" \
  -d "{\"audio_base64\": \"$AUDIO_B64\"}"
```

### Example: Upload Audio File

```bash
curl -X POST http://localhost:8060/render/upload \
  -F "audio=@audio.wav" \
  -o avatar.mp4
```

## Requirements

- Audio: WAV format, 16kHz, mono
- Output: MP4 video, 30fps

## Notes

- First request may be slow (model loading)
- Subsequent requests are faster (~1-3 seconds per second of audio)
- The avatar service is **optional** - PULSE works without it using browser TTS

## Troubleshooting

### Build fails
The Docker build downloads ~2GB of models. Ensure you have:
- Stable internet connection
- At least 10GB free disk space

### Slow rendering
CPU rendering is slower than GPU. For faster results:
- Use shorter audio clips
- Consider running on a machine with more CPU cores
