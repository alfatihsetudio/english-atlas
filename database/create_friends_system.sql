-- ==========================================
-- 1. Tambah kolom last_seen_atlas di profiles
-- ==========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_atlas TIMESTAMP WITH TIME ZONE;

-- ==========================================
-- 2. Buat tabel friends
-- ==========================================
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id) -- Mencegah duplikasi pertemanan
);

-- RLS untuk tabel friends
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pengguna dapat melihat pertemanan mereka sendiri" 
ON friends FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Pengguna dapat membuat permintaan pertemanan" 
ON friends FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Pengguna dapat memperbarui status pertemanan (accept)" 
ON friends FOR UPDATE 
USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Pengguna dapat menghapus pertemanan (unfriend/reject)" 
ON friends FOR DELETE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ==========================================
-- 3. Buat tabel friend_messages (Chat Sementara)
-- ==========================================
CREATE TABLE IF NOT EXISTS friend_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS untuk tabel friend_messages
ALTER TABLE friend_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pengguna dapat melihat pesan chat mereka" 
ON friend_messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Pengguna dapat mengirim pesan" 
ON friend_messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Aktifkan Realtime untuk kedua tabel agar notifikasi realtime jalan
ALTER PUBLICATION supabase_realtime ADD TABLE friends;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_messages;
