import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getRankInfo(points: number) {
  const safePoints = Math.max(0, points);
  if (safePoints >= 7001) return { tier: 'Immortal', win: 10, lose: -40 };
  if (safePoints >= 4001) return { tier: 'Advanced', win: 10, lose: -20 };
  if (safePoints >= 2001) return { tier: 'Intermediate', win: 10, lose: -10 };
  if (safePoints >= 501) return { tier: 'Elementary', win: 10, lose: -5 };
  return { tier: 'Rookie', win: 10, lose: 0 };
}

function calculateNewPoints(currentPoints: number, isCorrect: boolean): number {
  const info = getRankInfo(currentPoints);
  const change = isCorrect ? info.win : info.lose;
  return Math.max(0, currentPoints + change);
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, answers } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // 1. Fetch the quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sesi kuis tidak ditemukan.' }, { status: 404 });
    }

    if (session.is_submitted) {
      return NextResponse.json({ error: 'Sesi kuis ini sudah dikirim sebelumnya.' }, { status: 400 });
    }

    const correctAnswersList: string[] = session.correct_answers;
    const explanationsList: string[] = session.explanations;
    const mode = session.mode;

    // 2. Compare answers and count correct/wrong
    let correctCount = 0;
    let wrongCount = 0;

    correctAnswersList.forEach((correctAnswer, idx) => {
      const userAnswer = answers[idx];
      if (userAnswer && userAnswer.toLowerCase() === correctAnswer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    let pointChange = 0;
    let newPoints = 0;
    let derankedTier: string | null = null;

    // 3. Update profiles if Ranked mode and userId exists
    if (mode === 'ranked' && session.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('rank_points, highest_rank_points')
        .eq('id', session.user_id)
        .single();

      if (profileError) {
        console.error('[Submit Quiz API] Error fetching profile:', profileError);
      } else if (profile) {
        const currentPoints = profile.rank_points || 0;
        const currentHighest = profile.highest_rank_points || 0;

        let tempPoints = currentPoints;
        correctAnswersList.forEach((correctAnswer, idx) => {
          const userAnswer = answers[idx];
          const isCorrect = userAnswer && userAnswer.toLowerCase() === correctAnswer;
          tempPoints = calculateNewPoints(tempPoints, isCorrect);
        });

        newPoints = tempPoints;
        pointChange = newPoints - currentPoints;

        const newHighest = Math.max(currentHighest, newPoints);

        // Check if user deranked
        const oldTierInfo = getRankInfo(currentPoints);
        const newTierInfo = getRankInfo(newPoints);
        
        // Define tiers mapping to check if new tier index is lower
        const tierHierarchy = ['Rookie', 'Elementary', 'Intermediate', 'Advanced', 'Immortal'];
        const oldIdx = tierHierarchy.indexOf(oldTierInfo.tier);
        const newIdx = tierHierarchy.indexOf(newTierInfo.tier);

        if (newIdx < oldIdx) {
          derankedTier = newTierInfo.tier;
        }

        // Update database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            rank_points: newPoints,
            highest_rank_points: newHighest
          })
          .eq('id', session.user_id);

        if (updateError) {
          console.error('[Submit Quiz API] Error updating profiles:', updateError);
          throw new Error(`Gagal menyimpan poin ke profil: ${updateError.message}`);
        }
      }
    }

    // 4. Mark session as submitted
    await supabase
      .from('quiz_sessions')
      .update({ is_submitted: true })
      .eq('id', sessionId);

    // 5. Return validation results, keys, and explanations for review
    return NextResponse.json({
      correct: correctCount,
      wrong: wrongCount,
      pointChange,
      newPoints,
      derankedTier,
      correctAnswers: correctAnswersList,
      explanations: explanationsList
    });

  } catch (error: any) {
    console.error('[Submit Quiz API] Fatal Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
