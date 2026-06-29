-- Tambahkan kolom is_observer ke battle_participants
-- Multiple observers diperbolehkan, karena disimpan per-row

ALTER TABLE battle_participants 
  ADD COLUMN IF NOT EXISTS is_observer BOOLEAN DEFAULT false;

-- Index untuk query yang filter is_observer
CREATE INDEX IF NOT EXISTS idx_battle_participants_observer 
  ON battle_participants(room_id, is_observer);
