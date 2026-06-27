-- Add user_id referencing auth.users to pregenerated_questions
ALTER TABLE pregenerated_questions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old index if exists and create user-specific index
DROP INDEX IF EXISTS idx_pregen_mode_tier_unused;
CREATE INDEX IF NOT EXISTS idx_pregen_user_mode_tier_unused ON pregenerated_questions(user_id, mode, tier) WHERE is_used = false;
