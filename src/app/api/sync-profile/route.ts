import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const adminSupabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: profileData, error: profileError } = await adminSupabase
      .from('profiles')
      .select('username, avatar_url, rank_points, highest_rank_points, season_id, total_questions_answered, total_correct_answers, total_matches_played')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
       return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const date = new Date();
    const currentSeasonId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let currentRankPoints = profileData.rank_points || 0;
    let currentSeason = profileData.season_id;
    let wasReset = false;

    if (currentSeason !== currentSeasonId) {
       // Simpan riwayat season sebelumnya ke season_history
       try {
         await adminSupabase
           .from('season_history')
           .insert({
             user_id: user.id,
             season_id: profileData.season_id || 'unknown',
             rank_points: profileData.rank_points || 0,
             highest_rank_points: profileData.highest_rank_points || 0,
             total_matches: profileData.total_matches_played || 0,
             accuracy: profileData.total_questions_answered > 0
               ? Math.round(((profileData.total_correct_answers || 0) / profileData.total_questions_answered) * 100)
               : 0
           });
       } catch (historyErr) {
         console.error('[Sync Profile] Gagal menyimpan riwayat season:', historyErr);
       }

       currentRankPoints = Math.floor(currentRankPoints / 2) + 100;
       currentSeason = currentSeasonId;
       wasReset = true;

       await adminSupabase
         .from('profiles')
         .update({ 
           rank_points: currentRankPoints,
           season_id: currentSeasonId 
         })
         .eq('id', user.id);
    }
    
    let globalRank = null;
    try {
      const { data: rankPos } = await adminSupabase.rpc('get_user_rank_position', { user_id: user.id });
      globalRank = rankPos;
    } catch (e) {
      console.error("Error fetching global rank:", e);
    }

    return NextResponse.json({
       profile: {
          username: profileData.username,
          avatar_url: profileData.avatar_url,
          rank_points: currentRankPoints,
          highest_rank_points: profileData.highest_rank_points,
          season_id: currentSeason,
          global_rank: globalRank,
          total_questions_answered: profileData.total_questions_answered || 0,
          total_correct_answers: profileData.total_correct_answers || 0,
          total_matches_played: profileData.total_matches_played || 0
       },
       wasReset
    });
  } catch (error: any) {
    console.error('[Sync Profile API] Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
