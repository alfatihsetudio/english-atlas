import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await (supabase.from('battle_invites') as any)
      .select('*')
      .limit(1);

    return NextResponse.json({ data, error });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
