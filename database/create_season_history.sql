CREATE TABLE IF NOT EXISTS season_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  rank_points INTEGER NOT NULL,
  highest_rank_points INTEGER NOT NULL,
  total_matches INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE season_history ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow anyone to view profile histories
CREATE POLICY "Allow public select access on season history"
ON season_history FOR SELECT
USING (true);

-- Insert policy: Allow authenticated users to insert their own records
CREATE POLICY "Allow users to insert their own season history"
ON season_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
