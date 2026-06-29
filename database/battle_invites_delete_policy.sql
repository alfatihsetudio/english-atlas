-- Tambahkan policy DELETE untuk battle_invites
-- Mengizinkan pengirim (host) atau penerima membatalkan/menghapus undangan

CREATE POLICY "Allow delete for involved users" ON battle_invites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
