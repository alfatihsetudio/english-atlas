-- Tambahkan kolom questions dengan tipe data JSONB ke tabel battle_rooms
ALTER TABLE public.battle_rooms 
ADD COLUMN IF NOT EXISTS questions jsonb;

-- Beritahu Supabase API (PostgREST) untuk memuat ulang schema cache-nya
NOTIFY pgrst, 'reload schema';
