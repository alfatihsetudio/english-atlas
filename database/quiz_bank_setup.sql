-- Pregenerated Questions Pool Table
CREATE TABLE IF NOT EXISTS pregenerated_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode VARCHAR(20) NOT NULL, -- 'classic', 'ranked', 'battle'
    tier INTEGER NOT NULL, -- 1-5
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer VARCHAR(1) NOT NULL,
    explanation TEXT NOT NULL,
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

-- Index for fast queue filtering
CREATE INDEX IF NOT EXISTS idx_pregen_mode_tier_unused ON pregenerated_questions(mode, tier) WHERE is_used = false;
