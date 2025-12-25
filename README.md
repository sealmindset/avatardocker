# AvatarDocker

PULSE Training Platform with MLX-powered local AI on Apple Silicon.

## Features

- **MLX-Only AI**: Local LLM inference on Apple Silicon (M1/M2/M3/M4)
- **LiteAvatar**: CPU-based avatar rendering with lip-sync
- **Piper TTS**: Local text-to-speech synthesis
- **Dark Mode**: Full dark/light theme support
- **PULSE Framework**: Sales behavioral certification with progress tracking
- **Trust Score**: Real-time customer sentiment tracking
- **Sentiment Gauge**: Visual customer mood indicator

## Quick Start

```bash
# Start all services (including MLX LLM server)
./start.sh

# Stop all services
./stop.sh
```

## Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| UI | 3150 | Next.js frontend |
| API | 8150 | FastAPI backend |
| Avatar | 8160 | LiteAvatar service |
| TTS | 8170 | Piper TTS |
| DB | 5534 | PostgreSQL |
| MLX | 10240 | MLX LLM server (host) |

## Login

Demo credentials: `demo` / `demo`

## Requirements

- macOS with Apple Silicon (M1/M2/M3/M4)
- Docker Desktop
- Python 3.10+ (for MLX)
- 32GB+ RAM recommended (for Qwen2.5-32B model)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Host Machine                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              MLX LLM Server (:10240)                 │    │
│  │         mlx-community/Qwen2.5-32B-Instruct          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   UI     │  │   API    │  │  Avatar  │  │   TTS    │    │
│  │  :3150   │──│  :8150   │──│  :8160   │  │  :8170   │    │
│  │ Next.js  │  │ FastAPI  │  │LiteAvatar│  │  Piper   │    │
│  └──────────┘  └────┬─────┘  └──────────┘  └──────────┘    │
│                     │                                        │
│                     ▼                                        │
│              ┌──────────┐                                    │
│              │    DB    │                                    │
│              │  :5534   │                                    │
│              │ Postgres │                                    │
│              └──────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables

Key environment variables in `.env`:

```bash
# AI Provider (MLX only)
AI_PROVIDER=mlx
MLX_BASE_URL=http://host.docker.internal:10240
MLX_MODEL=mlx-community/Qwen2.5-32B-Instruct-4bit

# Avatar Mode
AVATAR_MODE=native  # or 'docker'

# Database
DB_PASSWORD=pulse_dev_password
```

## Development

### Native Avatar Mode (Recommended)

Uses MPS/Metal GPU acceleration for faster avatar rendering:

```bash
./start.sh native
```

### Docker Avatar Mode

Runs avatar in Docker container (CPU only, slower):

```bash
./start.sh docker
```

## Differences from DockerPulse

- **MLX-Only**: No OpenAI, Claude, Ollama, or Azure AI dependencies
- **Different Ports**: Avoids conflicts with DockerPulse
- **Simplified Auth**: Demo-only login (no Azure SSO)
- **Enhanced UI**: Dark mode, theme toggle from pulseapp

## License

Proprietary - All rights reserved.
