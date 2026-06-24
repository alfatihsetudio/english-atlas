-- Buat tabel battle_invites
CREATE TABLE IF NOT EXISTS battle_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES battle_rooms(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mengaktifkan Supabase Realtime untuk tabel battle_invites
ALTER PUBLICATION supabase_realtime ADD TABLE battle_invites;

-- Mengaktifkan Row Level Security (RLS)
ALTER TABLE battle_invites ENABLE ROW LEVEL SECURITY;

-- Kebijakan (Policy) RLS untuk battle_invites:
-- 1. Mengizinkan pengguna terautentikasi membaca undangan di mana mereka adalah pengirim atau penerima
CREATE POLICY "Allow select for involved users" ON battle_invites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 2. Mengizinkan pengguna terautentikasi membuat undangan atas nama mereka sendiri
CREATE POLICY "Allow insert for sender" ON battle_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- 3. Mengizinkan pengirim atau penerima memperbarui status undangan
CREATE POLICY "Allow update for involved users" ON battle_invites
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

