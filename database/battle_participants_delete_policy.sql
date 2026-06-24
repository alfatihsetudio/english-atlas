-- 1. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Enable delete for participants or host" ON public.battle_participants;
DROP POLICY IF EXISTS "Enable delete for participants" ON public.battle_participants;

-- 2. Buat policy baru yang mengizinkan pemain (guest) menghapus data mereka sendiri saat membatalkan main
CREATE POLICY "Enable delete for participants" 
ON public.battle_participants 
FOR DELETE 
USING (auth.uid() = user_id);
