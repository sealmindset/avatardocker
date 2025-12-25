# Changelog

All notable changes to AvatarDocker are documented in this file.

## [1.0.0] - 2025-12-25

### Initial Release

**AvatarDocker** - PULSE Training Platform with MLX-powered local AI on Apple Silicon.

### Features

- **MLX-Only AI Provider**
  - Local LLM inference using Apple Silicon (M1/M2/M3/M4)
  - Default model: `mlx-community/Qwen2.5-32B-Instruct-4bit`
  - No cloud AI dependencies (OpenAI, Anthropic, Azure removed)
  - Automatic MLX server startup in `start.sh`

- **UI/UX from pulseapp**
  - Dark mode with system theme detection
  - Theme toggle in navigation
  - PULSE progress bar (Probe → Understand → Link → Simplify → Earn)
  - Trust Score meter (1-10 scale with color coding)
  - Sentiment Gauge overlay (Frustrated → Engaged → Delighted)
  - Sale outcome modal (Won/Lost with feedback)
  - Modern login page design

- **Backend from dockerpulse**
  - LiteAvatar service with avatar pool (LRU cache)
  - Piper TTS for local speech synthesis
  - PostgreSQL database
  - FastAPI backend
  - Avatar loops for instant playback

- **Simplified Authentication**
  - Demo-only login (credentials: demo/demo)
  - No Azure SSO dependency
  - LocalStorage session persistence

- **Port Configuration** (avoids conflicts with dockerpulse)
  - UI: 3150
  - API: 8150
  - Avatar: 8160
  - TTS: 8170
  - DB: 5534
  - MLX: 10240 (shared with host)

### Files Created

**Root**
- `docker-compose.yml` - Docker Compose configuration
- `.env` / `.env.example` - Environment configuration
- `start.sh` - Startup script with MLX integration
- `stop.sh` - Shutdown script
- `README.md` - Project documentation

**API** (copied from dockerpulse)
- `api/main.py` - FastAPI application (updated for MLX-only)
- `api/ai_providers.py` - AI provider abstraction
- `api/database.py` - PostgreSQL operations
- `api/pulse_engine.py` - PULSE framework logic

**Avatar** (copied from dockerpulse)
- `avatar/api_server.py` - LiteAvatar API
- `avatar/avatar_pool.py` - Avatar pool manager

**UI** (dockerpulse base + pulseapp UI/UX)
- `ui/app/globals.css` - Dark mode CSS variables
- `ui/app/layout.tsx` - Theme provider integration
- `ui/app/page.tsx` - Login page with loading state
- `ui/components/theme-provider.tsx` - next-themes wrapper
- `ui/components/mode-toggle.tsx` - Dark/light toggle
- `ui/components/SbnProgressBar.tsx` - PULSE progress
- `ui/components/SentimentGauge.tsx` - Customer mood gauge
- `ui/components/AuthContext.tsx` - Demo-only auth

**Documentation**
- `docs/implementation_spec.md` - Implementation specification

### Technical Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, next-themes
- **Backend**: FastAPI, asyncpg, httpx
- **Database**: PostgreSQL 16
- **AI**: MLX (mlx-omni-server)
- **TTS**: Piper TTS
- **Avatar**: LiteAvatar (CPU-based lip-sync)
- **Container**: Docker Compose

### Requirements

- macOS with Apple Silicon (M1/M2/M3/M4)
- Docker Desktop
- Python 3.10+
- 32GB+ RAM recommended
