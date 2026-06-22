import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Using non-null assertion (!) because we expect these variables to be defined in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
