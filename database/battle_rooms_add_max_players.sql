-- Add max_players column to battle_rooms
ALTER TABLE battle_rooms 
ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 4;
