-- PULSE Analytics Database Schema
-- Docker initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    persona_id VARCHAR(50) NOT NULL,
    persona_name VARCHAR(100),
    scenario JSONB DEFAULT '{}',
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    current_stage INTEGER DEFAULT 1,
    trust_score INTEGER DEFAULT 5,
    sale_outcome VARCHAR(50) DEFAULT 'in_progress',
    overall_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    emotion VARCHAR(50),
    stage INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Missteps table
CREATE TABLE IF NOT EXISTS missteps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    misstep_id VARCHAR(100) NOT NULL,
    trust_penalty INTEGER,
    response_hint TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scorecards table
CREATE TABLE IF NOT EXISTS scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    overall_score DECIMAL(5,2),
    stage_scores JSONB DEFAULT '{}',
    rubric_compliance JSONB DEFAULT '{}',
    ai_feedback JSONB DEFAULT '{}',
    transcript JSONB DEFAULT '[]',  -- Full conversation transcript for review
    end_reason VARCHAR(50),  -- 'completed', 'inappropriate_remark', 'sale_won', 'sale_lost'
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompts table (for admin management)
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    prompt_key VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt versions table (for history)
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (optional, for multi-user support)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'trainee',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_session_id ON conversation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_missteps_session_id ON missteps(session_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_session_id ON scorecards(session_id);

-- Insert default prompts
INSERT INTO prompts (prompt_key, title, content, category) VALUES
('system_director', 'Director Persona System Prompt', 
'You are a Director personality customer - direct, results-oriented, and time-conscious.
You value efficiency and bottom-line results. You''re skeptical of fluff and want concrete facts.
Speak in short, direct sentences. Ask pointed questions about ROI and outcomes.
You''re busy and don''t have time for small talk.', 'persona'),

('system_relater', 'Relater Persona System Prompt',
'You are a Relater personality customer - warm, relationship-focused, and empathetic.
You value personal connections and trust. You want to feel understood before making decisions.
Speak warmly and share personal context. Ask about the salesperson''s experience and recommendations.
You take time to build rapport before discussing business.', 'persona'),

('system_socializer', 'Socializer Persona System Prompt',
'You are a Socializer personality customer - enthusiastic, talkative, and optimistic.
You love new ideas and get excited easily. You may go off on tangents and tell stories.
Speak with energy and enthusiasm. Share anecdotes and ask about exciting features.
You enjoy the conversation as much as the outcome.', 'persona'),

('system_thinker', 'Thinker Persona System Prompt',
'You are a Thinker personality customer - analytical, detail-oriented, and cautious.
You need data and logic to make decisions. You ask many clarifying questions.
Speak methodically and ask for specifics, comparisons, and evidence.
You won''t be rushed and need time to process information.', 'persona'),

('feedback_template', 'AI Feedback Generation Template',
'Analyze this sales training session and provide constructive feedback.
Focus on PULSE methodology adherence: Probe, Understand, Link, Solve, Earn.
Provide specific, actionable coaching tips.', 'feedback')

ON CONFLICT (prompt_key) DO NOTHING;

-- Insert demo user
INSERT INTO users (username, email, role) VALUES
('demo', 'demo@pulse.local', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Session events table (for readiness tracking)
CREATE TABLE IF NOT EXISTS session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    skill_tag VARCHAR(100) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- User skill aggregates table
CREATE TABLE IF NOT EXISTS user_skill_agg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    skill_tag VARCHAR(100) NOT NULL,
    time_window VARCHAR(20) NOT NULL,
    avg_score DECIMAL(5,2),
    sample_size INTEGER,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, skill_tag, time_window)
);

-- User readiness snapshots table
CREATE TABLE IF NOT EXISTS user_readiness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_id BIGSERIAL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    snapshot_at TIMESTAMPTZ DEFAULT NOW(),
    readiness_overall DECIMAL(5,2),
    readiness_technical DECIMAL(5,2),
    readiness_communication DECIMAL(5,2),
    readiness_structure DECIMAL(5,2),
    readiness_behavioral DECIMAL(5,2),
    meta JSONB DEFAULT '{}'
);

-- Indexes for readiness tables
CREATE INDEX IF NOT EXISTS idx_session_events_user_id ON session_events(user_id);
CREATE INDEX IF NOT EXISTS idx_session_events_occurred_at ON session_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_user_skill_agg_user_id ON user_skill_agg(user_id);
CREATE INDEX IF NOT EXISTS idx_user_readiness_user_id ON user_readiness(user_id);
CREATE INDEX IF NOT EXISTS idx_user_readiness_snapshot_at ON user_readiness(snapshot_at);

-- ============================================================================
-- PERSONAS TABLE (for avatar/voice configuration)
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

-- Seed default personas
INSERT INTO personas (
    persona_key, name, difficulty, description, greeting,
    avatar_gender, voice_openai, voice_google, voice_elevenlabs, color
) VALUES
(
    'director', 'Director', 'Expert',
    'Direct, results-oriented, time-conscious',
    'I don''t have much time. What do you have for me?',
    'male', 'onyx', 'en-US-Neural2-D', 'pNInz6obpgDQGcFmaJgB', '#EF4444'
),
(
    'relater', 'Relater', 'Beginner',
    'Warm, relationship-focused, empathetic',
    'Hi there! It''s so nice to meet you. How are you doing today?',
    'female', 'shimmer', 'en-US-Neural2-C', '21m00Tcm4TlvDq8ikWAM', '#10B981'
),
(
    'socializer', 'Socializer', 'Moderate',
    'Enthusiastic, talkative, optimistic',
    'Oh hey! I''m so excited to be here! I''ve heard great things about Sleep Number!',
    'female', 'nova', 'en-US-Neural2-E', 'EXAVITQu4vr4xnSDxMaL', '#F59E0B'
),
(
    'thinker', 'Thinker', 'Challenging',
    'Analytical, detail-oriented, cautious',
    'Hello. I''ve done some research on Sleep Number, but I have several questions before we proceed.',
    'male', 'echo', 'en-US-Neural2-A', 'VR6AewLTigWG4xSOukaG', '#3B82F6'
)
ON CONFLICT (persona_key) DO NOTHING;

-- Add avatar_id and voice_id columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS voice_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_sessions_avatar_id ON sessions(avatar_id);

-- Grant permissions (for PostgREST compatibility if needed later)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pulse_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pulse_admin;
