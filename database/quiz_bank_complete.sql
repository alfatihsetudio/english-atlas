-- Pregenerated Questions Pool Table (Now private per user)
CREATE TABLE IF NOT EXISTS pregenerated_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Belongs exclusively to this user
    mode VARCHAR(20) NOT NULL, -- 'classic', 'ranked'
    tier INTEGER NOT NULL, -- 1-5
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer VARCHAR(1) NOT NULL,
    explanation TEXT NOT NULL,
    raw_data JSONB, -- Stores full Gemini JSON payload (e.g. for classic options breakdowns)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_used BOOLEAN DEFAULT false NOT NULL
);

-- Secure User Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL,
    tier INTEGER NOT NULL,
    questions JSONB NOT NULL, -- Array of questions (without correct_answer and explanation)
    correct_answers JSONB NOT NULL, -- Array of correct answer keys
    explanations JSONB NOT NULL, -- Array of explanations
    is_submitted BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast user-specific queue filtering
CREATE INDEX IF NOT EXISTS idx_pregen_user_mode_tier_unused ON pregenerated_questions(user_id, mode, tier) WHERE is_used = false;

-- Disable Row Level Security (RLS) on these tables so that anonymous / public keys can read and write without policy violations
ALTER TABLE pregenerated_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions DISABLE ROW LEVEL SECURITY;
