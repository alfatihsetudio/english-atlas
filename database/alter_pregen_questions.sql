-- Add raw_data column to store full Gemini JSON payload for complex question structures (like classic mode)
ALTER TABLE pregenerated_questions ADD COLUMN IF NOT EXISTS raw_data JSONB;
