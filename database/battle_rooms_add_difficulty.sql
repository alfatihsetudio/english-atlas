-- Tambahkan kolom difficulty dengan tipe data VARCHAR ke tabel battle_rooms
ALTER TABLE public.battle_rooms 
ADD COLUMN IF NOT EXISTS difficulty varchar(50) NOT NULL DEFAULT 'Tier 1: Foundation (Easy)';

-- Beritahu Supabase API (PostgREST) untuk memuat ulang schema cache-nya secara paksa
NOTIFY pgrst, 'reload schema';
