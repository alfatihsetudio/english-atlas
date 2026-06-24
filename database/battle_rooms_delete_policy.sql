-- Fix: Tambahkan DELETE policy untuk battle_rooms agar Host bisa membatalkan room
-- Jalankan SQL ini di Supabase SQL Editor

-- Policy DELETE untuk battle_rooms (hanya host yang boleh delete room miliknya)
CREATE POLICY "Enable delete for room host" 
ON public.battle_rooms 
FOR DELETE 
USING (auth.uid() = host_id);
