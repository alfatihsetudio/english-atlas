-- Fix: Izinkan host room untuk mengupdate is_observer milik peserta lain
-- Policy lama hanya mengizinkan user mengupdate baris miliknya sendiri

-- Hapus policy UPDATE lama
DROP POLICY IF EXISTS "Enable update for participants" ON public.battle_participants;

-- Buat policy UPDATE baru:
-- 1. Peserta bisa update baris SENDIRI (untuk is_ready, score, dll)
-- 2. Host bisa update baris siapapun di dalam roomnya (untuk is_observer)
CREATE POLICY "Enable update for participants and host"
ON public.battle_participants
FOR UPDATE
USING (
  auth.uid() = user_id
  OR auth.uid() IN (
    SELECT host_id FROM public.battle_rooms WHERE id = room_id
  )
);
