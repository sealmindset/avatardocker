# AvatarDocker Implementation Specification

## Overview

AvatarDocker is a Docker Compose-based PULSE Training platform that combines:
- **UI/UX from pulseapp**: Dark mode, theme toggle, PULSE progress bar, Trust Score, Sentiment Gauge
- **Backend from dockerpulse**: LiteAvatar, Piper TTS, PostgreSQL, FastAPI
- **MLX-only AI**: Apple Silicon local LLM (no OpenAI, Claude, Ollama, Azure dependencies)

## Port Configuration

| Service | AvatarDocker | DockerPulse | Notes |
|---------|--------------|-------------|-------|
| UI | 3150 | 3050 | Next.js frontend |
| API | 8150 | 8050 | FastAPI backend |
| Avatar | 8160 | 8060 | LiteAvatar service |
| TTS | 8170 | 8070 | Piper TTS |
| DB | 5534 | 5433 | PostgreSQL |
| MLX | 10240 | 10240 | Shared (host) |

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

## Directory Structure

```
avatardocker/
├── api/                    # FastAPI backend (from dockerpulse)
│   ├── Dockerfile
│   ├── main.py
│   ├── database.py
│   ├── pulse_engine.py
│   ├── avatar_manager.py
│   └── requirements.txt
├── avatar/                 # LiteAvatar service (from dockerpulse)
│   ├── Dockerfile
│   ├── api_server.py
│   ├── avatar_pool.py
│   └── requirements.txt
├── db/                     # PostgreSQL schema (from dockerpulse)
│   └── init.sql
├── piper-tts/              # Piper TTS (from dockerpulse)
│   └── Dockerfile
├── ui/                     # Next.js frontend (pulseapp UI + dockerpulse hooks)
│   ├── app/
│   │   ├── layout.tsx      # Dark mode, theme provider
│   │   ├── page.tsx        # Login (demo-only)
│   │   ├── globals.css     # Dark mode CSS
│   │   ├── pre-session/
│   │   ├── session/        # LiteAvatar + PULSE progress
│   │   ├── feedback/
│   │   └── api/            # Orchestrator routes
│   ├── components/
│   │   ├── AuthContext.tsx # Simplified demo-only auth
│   │   ├── SessionContext.tsx
│   │   ├── SbnProgressBar.tsx
│   │   ├── SentimentGauge.tsx
│   │   ├── theme-provider.tsx
│   │   ├── mode-toggle.tsx
│   │   └── ui/
│   ├── hooks/
│   │   ├── useLiteAvatar.ts
│   │   ├── useAvatarLoops.ts
│   │   └── useSpeechRecognition.ts
│   ├── Dockerfile
│   └── package.json
├── scripts/
│   └── start-mlx-server.sh
├── docs/
│   └── implementation_spec.md
├── docker-compose.yml
├── .env
├── .env.example
├── start.sh
├── stop.sh
├── README.md
└── CHANGELOG.md
```

## Key Changes from Source Projects

### From pulseapp (UI/UX)
- ✅ Dark mode with theme toggle
- ✅ PULSE progress bar component
- ✅ Trust Score meter
- ✅ Sentiment Gauge overlay
- ✅ Sale outcome tracking (won/lost/stalled)
- ✅ Modern login page design
- ❌ Azure SSO (removed, demo-only auth)
- ❌ Azure Speech Avatar (replaced with LiteAvatar)

### From dockerpulse (Backend)
- ✅ LiteAvatar service with avatar pool
- ✅ Piper TTS for local speech synthesis
- ✅ PostgreSQL database schema
- ✅ FastAPI backend structure
- ✅ Avatar loops for instant playback
- ❌ OpenAI/Claude/Ollama support (MLX only)

### New for avatardocker
- MLX-only AI provider configuration
- Simplified auth (demo credentials only)
- Combined UI/UX from both projects
- New port configuration to avoid conflicts

## Implementation Phases

### Phase 1: Project Setup
1. Create avatardocker directory
2. Copy dockerpulse backend (api, avatar, db, piper-tts)
3. Update port numbers in all configs
4. Create docker-compose.yml

### Phase 2: UI Migration
1. Copy dockerpulse UI as base
2. Apply pulseapp globals.css (dark mode)
3. Add theme-provider and mode-toggle
4. Update layout.tsx with dark mode support

### Phase 3: Component Migration
1. Add SbnProgressBar from pulseapp
2. Add SentimentGauge from pulseapp
3. Add Trust Score meter
4. Simplify AuthContext (demo-only)

### Phase 4: Session Page Integration
1. Merge pulseapp session UI with dockerpulse LiteAvatar
2. Add PULSE progress tracking
3. Add sale outcome modal
4. Integrate Sentiment Gauge overlay

### Phase 5: MLX Configuration
1. Remove all non-MLX AI providers from API
2. Update .env for MLX-only
3. Integrate MLX startup into start.sh
4. Test end-to-end with MLX

### Phase 6: Testing & Polish
1. Test all pages and flows
2. Verify dark mode throughout
3. Test LiteAvatar rendering
4. Test speech recognition
5. Update documentation

## Environment Variables

```bash
# Database
DB_PASSWORD=pulse_dev_password
DATABASE_URL=postgresql://pulse_admin:pulse_dev_password@db:5432/pulse_analytics

# AI Provider (MLX only)
AI_PROVIDER=mlx
MLX_BASE_URL=http://host.docker.internal:10240
MLX_MODEL=mlx-community/Qwen2.5-32B-Instruct-4bit
MLX_PORT=10240

# TTS
TTS_PROVIDER=local
PIPER_TTS_URL=http://piper-tts:8000

# Avatar
AVATAR_MODE=native
AVATAR_DATA_DIR=/app/lite-avatar/data/sample_data/preload

# UI
NEXT_PUBLIC_API_URL=http://localhost:8150
NEXT_PUBLIC_AVATAR_URL=http://localhost:8160
```

## Success Criteria

1. ✅ All services start without errors
2. ✅ UI displays with dark mode support
3. ✅ Demo login works (demo/demo)
4. ✅ Pre-session page shows persona selector
5. ✅ Session page shows LiteAvatar
6. ✅ PULSE progress bar updates during conversation
7. ✅ Trust Score meter reflects conversation quality
8. ✅ Sentiment Gauge shows customer mood
9. ✅ Speech recognition captures user input
10. ✅ MLX generates AI responses
11. ✅ Piper TTS synthesizes speech
12. ✅ LiteAvatar lip-syncs to audio
13. ✅ Sale outcome modal appears on win/loss
14. ✅ Feedback page shows session summary

## Timeline Estimate

- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 1 hour
- Phase 4: 2 hours
- Phase 5: 30 minutes
- Phase 6: 1 hour

**Total: ~6 hours**
