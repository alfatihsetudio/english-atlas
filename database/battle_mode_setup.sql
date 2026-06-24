-- Setup Database untuk Fitur Battle Mode (Multiplayer)

-- 1. Membuat tabel battle_rooms
CREATE TABLE IF NOT EXISTS public.battle_rooms (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  host_id uuid NOT NULL,
  room_code varchar(6) NOT NULL,
  question_count integer NOT NULL DEFAULT 5,
  status varchar(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT battle_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT battle_rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT battle_rooms_room_code_key UNIQUE (room_code)
);

-- 2. Membuat tabel battle_participants
CREATE TABLE IF NOT EXISTS public.battle_participants (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  is_ready boolean NOT NULL DEFAULT false,
  joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT battle_participants_pkey PRIMARY KEY (room_id, user_id),
  CONSTRAINT battle_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.battle_rooms(id) ON DELETE CASCADE,
  CONSTRAINT battle_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 3. Mengaktifkan Row Level Security (RLS)
ALTER TABLE public.battle_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;

-- 4. Membuat Policy (Kebijakan Akses) yang longgar untuk keperluan real-time MVP
-- Untuk production, sesuaikan dengan aturan auth yang lebih ketat

-- Policy untuk battle_rooms
CREATE POLICY "Enable read access for all users" ON public.battle_rooms FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.battle_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Enable update for room host" ON public.battle_rooms FOR UPDATE USING (auth.uid() = host_id);

-- Policy untuk battle_participants
CREATE POLICY "Enable read access for all users" ON public.battle_participants FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.battle_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for participants" ON public.battle_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for participants or host" ON public.battle_participants FOR DELETE USING (auth.uid() = user_id OR auth.uid() IN (SELECT host_id FROM public.battle_rooms WHERE id = room_id));

-- 5. Mengaktifkan Supabase Realtime
-- Jika publikasi 'supabase_realtime' sudah ada:
ALTER PUBLICATION supabase_realtime ADD TABLE battle_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_participants;
