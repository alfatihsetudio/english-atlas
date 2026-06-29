-- 1. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Pengguna dapat menghapus pesan chat mereka" ON public.friend_messages;

-- 2. Buat policy baru yang mengizinkan pengirim atau penerima menghapus pesan
CREATE POLICY "Pengguna dapat menghapus pesan chat mereka" 
ON public.friend_messages 
FOR DELETE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
