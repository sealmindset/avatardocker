-- Migration: Add personas table with avatar configuration
-- Date: 2025-12-24
-- Purpose: Enable dynamic avatar swapping per persona for Training Sessions
--
-- This migration creates a personas table to store persona configurations
-- including avatar assignments from ModelScope LiteAvatarGallery.

-- ============================================================================
-- PERSONAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS personas (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    
    -- Persona identification (matches keys in pulse_engine.py PERSONAS dict)
    persona_key VARCHAR(50) UNIQUE NOT NULL,
    
    -- Basic info
    name VARCHAR(100) NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'Moderate',
    description TEXT,
    greeting TEXT,
    
    -- System prompt configuration
    system_prompt TEXT,
    system_prompt_summary TEXT,
    
    -- Avatar configuration (ModelScope LiteAvatarGallery)
    avatar_id VARCHAR(255),                    -- e.g., "20250408/P1lXrpJL507-PZ4hMPutyF7A"
    avatar_gender VARCHAR(10) DEFAULT 'female', -- 'female' or 'male'
    avatar_style VARCHAR(50) DEFAULT 'casual',  -- 'casual', 'professional', etc.
    avatar_randomize BOOLEAN DEFAULT FALSE,     -- If true, randomly select avatar each session
    
    -- Voice configuration (Piper TTS)
    voice_id VARCHAR(100),                     -- Piper voice model ID
    voice_style VARCHAR(50) DEFAULT 'medium',  -- Voice quality/style
    
    -- Legacy voice IDs (for backward compatibility with cloud TTS)
    voice_openai VARCHAR(50),                  -- OpenAI TTS voice
    voice_google VARCHAR(100),                 -- Google TTS voice
    voice_elevenlabs VARCHAR(100),             -- ElevenLabs voice ID
    
    -- UI configuration
    color VARCHAR(20) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_personas_persona_key ON personas(persona_key);
CREATE INDEX IF NOT EXISTS idx_personas_avatar_id ON personas(avatar_id);
CREATE INDEX IF NOT EXISTS idx_personas_is_active ON personas(is_active);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;
CREATE TRIGGER update_personas_updated_at
    BEFORE UPDATE ON personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DEFAULT PERSONAS
-- These match the PERSONAS dictionary in pulse_engine.py
-- ============================================================================

INSERT INTO personas (
    persona_key, name, difficulty, description, greeting,
    avatar_gender, voice_openai, voice_google, voice_elevenlabs,
    color
) VALUES
(
    'director',
    'Director',
    'Expert',
    'Direct, results-oriented, time-conscious',
    'I don''t have much time. What do you have for me?',
    'male',
    'onyx',
    'en-US-Neural2-D',
    'pNInz6obpgDQGcFmaJgB',
    '#EF4444'  -- Red
),
(
    'relater',
    'Relater',
    'Beginner',
    'Warm, relationship-focused, empathetic',
    'Hi there! It''s so nice to meet you. How are you doing today?',
    'female',
    'shimmer',
    'en-US-Neural2-C',
    '21m00Tcm4TlvDq8ikWAM',
    '#10B981'  -- Green
),
(
    'socializer',
    'Socializer',
    'Moderate',
    'Enthusiastic, talkative, optimistic',
    'Oh hey! I''m so excited to be here! I''ve heard great things about Sleep Number!',
    'female',
    'nova',
    'en-US-Neural2-E',
    'EXAVITQu4vr4xnSDxMaL',
    '#F59E0B'  -- Amber
),
(
    'thinker',
    'Thinker',
    'Challenging',
    'Analytical, detail-oriented, cautious',
    'Hello. I''ve done some research on Sleep Number, but I have several questions before we proceed.',
    'male',
    'echo',
    'en-US-Neural2-A',
    'VR6AewLTigWG4xSOukaG',
    '#3B82F6'  -- Blue
)
ON CONFLICT (persona_key) DO UPDATE SET
    name = EXCLUDED.name,
    difficulty = EXCLUDED.difficulty,
    description = EXCLUDED.description,
    greeting = EXCLUDED.greeting,
    avatar_gender = EXCLUDED.avatar_gender,
    voice_openai = EXCLUDED.voice_openai,
    voice_google = EXCLUDED.voice_google,
    voice_elevenlabs = EXCLUDED.voice_elevenlabs,
    color = EXCLUDED.color,
    updated_at = NOW();

-- ============================================================================
-- UPDATE SESSIONS TABLE
-- Add avatar_id column to track which avatar was used in each session
-- ============================================================================

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(255);

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS voice_id VARCHAR(100);

-- Index for avatar usage tracking
CREATE INDEX IF NOT EXISTS idx_sessions_avatar_id ON sessions(avatar_id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON personas TO pulse_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pulse_admin;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE personas IS 'Persona configurations for Training Sessions with avatar and voice assignments';
COMMENT ON COLUMN personas.persona_key IS 'Unique key matching pulse_engine.py PERSONAS dict (e.g., director, relater)';
COMMENT ON COLUMN personas.avatar_id IS 'ModelScope LiteAvatar ID (e.g., 20250408/P1lXrpJL507-PZ4hMPutyF7A)';
COMMENT ON COLUMN personas.avatar_randomize IS 'If true, randomly select avatar matching gender each session';
COMMENT ON COLUMN personas.voice_id IS 'Piper TTS voice model ID for local TTS';
COMMENT ON COLUMN sessions.avatar_id IS 'Avatar used for this specific session (resolved from persona config)';
