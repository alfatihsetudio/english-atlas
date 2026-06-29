'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Loader2, Trophy, Swords, CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';

const VoiceChat = dynamic(() => import('@/components/VoiceChat'), { ssr: false });
const BattleChat = dynamic(() => import('@/components/BattleChat'), { ssr: false });

function seededShuffle<T>(array: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  const nextRandom = () => {
    h = Math.imul(1664525, h) + 1013904223 | 0;
    return (h >>> 0) / 0xffffffff;
  };
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

interface QuizQuestion {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
}

function shuffleOptions(question: QuizQuestion, seed: string): QuizQuestion {
  const letters = ['a', 'b', 'c', 'd'] as const;
  const correctLetter = question.correct_answer.toLowerCase() as 'a' | 'b' | 'c' | 'd';
  const correctText = question[`option_${correctLetter}` as keyof QuizQuestion] as string;
  const options = letters.map(l => question[`option_${l}` as keyof QuizQuestion] as string);
  const shuffledOptions = seededShuffle(options, seed);
  const newCorrectIndex = shuffledOptions.indexOf(correctText);
  const newCorrectLetter = newCorrectIndex !== -1 ? (letters[newCorrectIndex] as 'a' | 'b' | 'c' | 'd') : correctLetter;
  return {
    ...question,
    option_a: shuffledOptions[0] || '',
    option_b: shuffledOptions[1] || '',
    option_c: shuffledOptions[2] || '',
    option_d: shuffledOptions[3] || '',
    correct_answer: newCorrectLetter
  };
}

interface PlayerScore {
  user_id: string;
  username: string;
  avatar_url: string;
  score: number;
  is_ready: boolean; // used as is_finished flag
  is_observer?: boolean;
}

export default function BattlePlayPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'observing' | 'finished' | 'disqualified'>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const isObserverRef = useRef(false);
  
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [showFeedback, setShowFeedback] = useState<boolean | null>(null);
  const [showDisbandWarning, setShowDisbandWarning] = useState(false);
  const [showKickedModal, setShowKickedModal] = useState(false);

  // Live scores - fetched from DB and updated via realtime
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [finalScores, setFinalScores] = useState<PlayerScore[] | null>(null);
  const channelRef = useRef<any>(null);
  const isFinishedRef = useRef(false);
  const gameStateRef = useRef<'loading' | 'playing' | 'observing' | 'finished' | 'disqualified'>('loading');
  const isMountedRef = useRef(true);

  // Keep ref in sync for cleanup
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Lock final scores once everyone finishes so early leavers don't corrupt the scoreboard
  useEffect(() => {
    if (gameState === 'finished' && !finalScores) {
      const activePlayers = playerScores.filter(p => !p.is_observer);
      const validPlayers = activePlayers.filter(p => p.score !== -1);
      const allFinished = validPlayers.length > 0 && validPlayers.every(p => p.is_ready);
      if (allFinished) {
         setFinalScores([...playerScores]);
      }
    }
  }, [gameState, playerScores, finalScores]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function initGame() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session?.user) {
          router.replace('/arena');
          return;
        }
        const user = session.user;
        setCurrentUser(user);

        // Fetch Room (which now includes the questions column)
        const { data: roomData } = await (supabase.from('battle_rooms') as any)
          .select('*')
          .eq('room_code', roomCode)
          .single();

        if (!active) return;
        if (!roomData || roomData.status !== 'playing') {
          alert('Room tidak dalam status bermain!');
          router.replace('/arena');
          return;
        }
        setRoom(roomData);

        // Check if this user has been disqualified (score = -1) or is an observer
        const { data: myParticipant } = await (supabase.from('battle_participants') as any)
          .select('score, is_ready, is_observer')
          .eq('room_id', roomData.id)
          .eq('user_id', user.id)
          .single();
        
        if (!active) return;

        if (myParticipant && myParticipant.score === -1) {
          setGameState('disqualified');
          return;
        }

        // === Check if this player is an Observer ===
        const isObserver = myParticipant?.is_observer === true;
        isObserverRef.current = isObserver;

        if (isObserver) {
          // Observer: just load scores and watch
          await fetchLiveScores(roomData.id);
          setGameState('observing');
          // Still need realtime below — don't return yet
        } else {
          // Load questions from the DB (set by Host before game started)
          const totalQuestions = roomData.questions?.length || 0;
          if (totalQuestions === 0) {
            alert('Soal pertandingan tidak ditemukan!');
            router.replace('/arena');
            return;
          }
          const shuffledQuestions = seededShuffle(roomData.questions as QuizQuestion[], user.id + roomData.id);
          const fullyShuffled = shuffledQuestions.map((q: QuizQuestion, idx) => {
            return shuffleOptions(q, user.id + roomData.id + q.question + idx);
          });
          setQuestions(fullyShuffled);

          // Resume or Reset logic
          let isAlreadyFinished = false;
          if (myParticipant && myParticipant.score === 0 && myParticipant.is_ready) {
             // Fresh start from lobby
             await (supabase.from('battle_participants') as any)
               .update({ is_ready: false, score: 0 })
               .eq('room_id', roomData.id)
               .eq('user_id', user.id);
          } else if (myParticipant && myParticipant.score >= 0) {
             // Resuming game or already finished
             const progress = myParticipant.score % 1000;
             setMyScore(myParticipant.score);
             if (progress >= totalQuestions || myParticipant.is_ready) {
                isFinishedRef.current = true;
                isAlreadyFinished = true;
             } else {
                setCurrentQuestionIdx(progress);
             }
          }

          // Fetch initial live scores from DB
          await fetchLiveScores(roomData.id);

          if (isAlreadyFinished) {
             setGameState('finished');
          } else {
             setGameState('playing');
          }
        }

        // Setup realtime for live score updates
        const channelName = `battle_play_${roomData.id}_${Math.random().toString(36).substring(2, 9)}`;
        const channel = supabase.channel(channelName)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'battle_participants',
            filter: `room_id=eq.${roomData.id}`
          }, async () => {
            if (!active) return;
            const latest = await fetchLiveScores(roomData.id);
            // Observer: auto-transition to finished when all active players done
            if (isObserverRef.current && gameStateRef.current === 'observing') {
              const activePlayers = latest.filter(p => !p.is_observer);
              const allDone = activePlayers.length > 0 &&
                activePlayers.every(p => p.is_ready || p.score === -1);
              if (allDone) {
                setFinalScores(activePlayers);
                setGameState('finished');
              }
            }
          })
          .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'battle_rooms'
          }, (payload) => {
            if (active && payload.old?.id === roomData.id && currentUser?.id !== roomData.host_id) {
              setShowKickedModal(true);
            }
          })
          .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'battle_participants'
          }, (payload) => {
            if (active && payload.old?.room_id === roomData.id && currentUser?.id !== roomData.host_id) {
              setShowKickedModal(true);
            }
          })
          .subscribe();

        channelRef.current = channel;
      } catch (err: any) {
        console.error('Fatal error in initGame:', err);
        alert('Gagal menyiapkan arena: ' + err.message);
        router.replace('/arena');
      }
    }

    initGame();

    return () => {
      active = false;
      // ABANDONMENT PENALTY: only for active players, not observers
      if (!isObserverRef.current && gameStateRef.current === 'playing' && !isFinishedRef.current) {
        // Fire-and-forget: mark as forfeited
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.user) return;
          (supabase.from('battle_rooms') as any)
            .select('id')
            .eq('room_code', roomCode)
            .single()
            .then(({ data: roomRow }: { data: any }) => {
              if (!roomRow) return;
              (supabase.from('battle_participants') as any)
                .update({ score: -1 })
                .eq('room_id', roomRow.id)
                .eq('user_id', session.user.id)
                .then(() => {});
            });
        });
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomCode, router]);

  const fetchLiveScores = async (roomId: string) => {
    const { data } = await (supabase.from('battle_participants') as any)
      .select(`
        user_id,
        score,
        is_ready,
        is_observer,
        profiles:user_id (username, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('score', { ascending: false });

    if (data) {
      const mapped: PlayerScore[] = data.map((p: any) => ({
        user_id: p.user_id,
        username: p.profiles?.username || 'Player',
        avatar_url: p.profiles?.avatar_url || '',
        score: p.score,
        is_ready: p.is_ready,
        is_observer: p.is_observer || false
      }));
      setPlayerScores(mapped);
      return mapped;
    }
    return [];
  };

  const handleAnswer = async (index: number, optionLetter: string) => {
    if (isAnswering || gameState !== 'playing') return;
    setIsAnswering(true);
    setSelectedOption(index);

    const currentCorrect = Math.floor(myScore / 1000);
    const currentProgress = myScore % 1000;

    const question = questions[currentQuestionIdx];
    const isCorrect = optionLetter.toLowerCase() === question.correct_answer.toLowerCase();
    
    const newCorrect = isCorrect ? currentCorrect + 1 : currentCorrect;
    const newProgress = currentProgress + 1;
    const newEncodedScore = (newCorrect * 1000) + newProgress;

    setMyScore(newEncodedScore);
    setShowFeedback(isCorrect);

    // Update DB immediately so others see live progress
    if (room && currentUser) {
      (supabase.from('battle_participants') as any)
        .update({ score: newEncodedScore })
        .eq('room_id', room.id)
        .eq('user_id', currentUser.id)
        .then();
        
      // Update Winrate/Accuracy logic per question
      (supabase.from('profiles') as any).select('total_questions_answered, total_correct_answers')
        .eq('id', currentUser.id)
        .single()
        .then(({ data: profile }: { data: any }) => {
          if (profile) {
             const newTotalQuestions = (profile.total_questions_answered || 0) + 1;
             const newTotalCorrect = (profile.total_correct_answers || 0) + (isCorrect ? 1 : 0);
             (supabase.from('profiles') as any).update({
               total_questions_answered: newTotalQuestions,
               total_correct_answers: newTotalCorrect
             }).eq('id', currentUser.id).then();
          }
        });
    }

    setTimeout(async () => {
      if (!isMountedRef.current) return;
      
      const nextIdx = currentQuestionIdx + 1;

      if (nextIdx >= questions.length) {
        // Game finished for me - mark as finished (is_ready = true means finished) and set final score
        isFinishedRef.current = true;
        
        if (room && currentUser) {
          await (supabase.from('battle_participants') as any)
            .update({ score: newEncodedScore, is_ready: true })
            .eq('room_id', room.id)
            .eq('user_id', currentUser.id);

          // Increment total matches played
          const { data: profileData } = await (supabase.from('profiles') as any).select('total_matches_played').eq('id', currentUser.id).single();
          if (profileData) {
            await (supabase.from('profiles') as any).update({ total_matches_played: (profileData.total_matches_played || 0) + 1 }).eq('id', currentUser.id);
          }
        }
        setGameState('finished');
      } else {
        setCurrentQuestionIdx(nextIdx);
        setSelectedOption(null);
        setShowFeedback(null);
        setIsAnswering(false);
      }
    }, 1500);
  };

  const handleReturn = async (destination: 'dashboard' | 'room') => {
    if (!currentUser || !room) { router.replace('/arena'); return; }

    try {
      if (room.host_id === currentUser.id) {
        if (destination === 'room') {
          // Reset room for another round
          await (supabase.from('battle_rooms') as any).update({ status: 'waiting' }).eq('id', room.id);
          // Only reset MY score so the scoreboard doesn't break for others
          await (supabase.from('battle_participants') as any).update({ score: 0, is_ready: false })
             .eq('room_id', room.id).eq('user_id', currentUser.id);
        } else {
          // Host leaves entirely -> Warn first via custom modal
          setShowDisbandWarning(true);
          return; // Stop here, wait for modal confirmation
        }
      } else {
        // Guest user returning to room or dashboard
        if (destination === 'room') {
          const { data: checkRoom } = await (supabase.from('battle_rooms') as any)
            .select('id')
            .eq('id', room.id)
            .maybeSingle();
            
          if (!checkRoom) {
            alert("Maaf, room ini sudah dibubarkan oleh Host.");
            router.replace('/arena');
            return;
          }
          // Reset MY score so I'm ready in the lobby
          await (supabase.from('battle_participants') as any).update({ score: 0, is_ready: false })
             .eq('room_id', room.id).eq('user_id', currentUser.id);
        } else {
          // Guest leaves to dashboard - clean up participant row
          await (supabase.from('battle_participants') as any)
             .delete()
             .eq('room_id', room.id)
             .eq('user_id', currentUser.id);
        }
      }
    } catch (err) {
      console.error('Error handling return:', err);
    }

    if (destination === 'room') {
      router.replace(`/arena/battle/${roomCode}`);
    } else {
      router.replace('/arena');
    }
  };

  const confirmDisband = async () => {
    if (!room) return;
    try {
      await (supabase.from('battle_rooms') as any).delete().eq('id', room.id);
    } catch (err) {
      console.error('Error disbanding room:', err);
    }
    setShowDisbandWarning(false);
    router.replace('/arena');
  };

  // ---- LOADING SCREEN ----
  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-500 mb-4" />
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Menyiapkan Arena...</p>
      </div>
    );
  }

  // ---- DISQUALIFIED SCREEN ----
  if (gameState === 'disqualified') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 p-8 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-900 blur-[60px] opacity-20 rounded-full"></div>
          <AlertTriangle className="w-24 h-24 text-red-600 relative z-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-red-500 uppercase tracking-[0.15em] mb-4">
          Diskualifikasi
        </h1>
        <p className="text-zinc-400 text-sm max-w-sm leading-relaxed mb-10">
          Anda telah meninggalkan arena saat pertandingan berlangsung. Anda tidak dapat kembali ke pertandingan ini.
        </p>
        <button
          onClick={() => router.replace('/')}
          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-xl px-8 py-3 text-xs font-black uppercase tracking-widest transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  // ---- OBSERVER DASHBOARD ----
  if (gameState === 'observing') {
    const activePlayers = playerScores.filter(p => !p.is_observer);
    const totalQuestions = room?.questions?.length || 0;
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
        {/* Header */}
        <div className="w-full bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800 px-3 py-1.5 rounded-lg">
              <Eye size={14} className="text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-widest text-indigo-300">Mode Admin</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Room: {roomCode}</span>
          </div>
          <VoiceChat channelName={roomCode} />
        </div>

        {/* Observer Content */}
        <div className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-black text-white uppercase tracking-widest mb-1">Papan Progres Live</h1>
            <p className="text-xs text-zinc-500">Anda mengawasi {activePlayers.length} pemain · {totalQuestions} soal</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activePlayers.map((p, i) => {
              const isForfeited = p.score === -1;
              const isFinished = p.is_ready;
              const answered = isForfeited ? 0 : (p.score % 1000);
              const correct = isForfeited ? 0 : Math.floor(p.score / 1000);
              const progressPct = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;

              return (
                <div key={p.user_id} className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col gap-3 transition-colors ${
                  isForfeited ? 'border-red-900/50 bg-red-950/10' :
                  isFinished ? 'border-green-800/60 bg-green-950/10' :
                  'border-zinc-800'
                }`}>
                  {/* Player header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 shrink-0">
                          {p.avatar_url
                            ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-sm">👤</div>}
                        </div>
                        <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-zinc-700 text-[10px] font-black flex items-center justify-center text-zinc-300">
                          {i + 1}
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{p.username}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          {isForfeited ? '❌ Diskualifikasi' : isFinished ? '✓ Selesai' : `Soal ${answered}/${totalQuestions}`}
                        </p>
                      </div>
                    </div>
                    {/* Status badge */}
                    {isForfeited ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-950/50 border border-red-900/50 px-2 py-1 rounded-lg">DQ</span>
                    ) : isFinished ? (
                      <span className="text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-950/50 border border-green-900/50 px-2 py-1 rounded-lg">SELESAI</span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg animate-pulse">LIVE</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1.5">
                      <span>Progress</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isForfeited ? 'bg-red-600' : isFinished ? 'bg-green-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Score stats */}
                  {!isForfeited && (
                    <div className="flex gap-3">
                      <div className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-center">
                        <p className="text-lg font-black text-white">{correct}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Benar</p>
                      </div>
                      <div className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-center">
                        <p className="text-lg font-black text-zinc-400">{answered - correct}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Salah</p>
                      </div>
                      <div className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-center">
                        <p className="text-lg font-black text-zinc-300">{totalQuestions - answered}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sisa</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {activePlayers.length === 0 && (
            <div className="text-center py-20 text-zinc-600 text-sm">Menunggu pemain bergabung...</div>
          )}
        </div>

        {/* Battle Chat */}
        {room && (
          <BattleChat
            roomCode={roomCode}
            currentUser={currentUser ? {
              id: currentUser.id,
              username: playerScores.find(p => p.user_id === currentUser.id)?.username || currentUser.email?.split('@')[0] || 'Admin',
              avatar_url: playerScores.find(p => p.user_id === currentUser.id)?.avatar_url || ''
            } : null}
          />
        )}
      </div>
    );
  }

  // ---- FINISHED SCREEN ----
  if (gameState === 'finished') {

    if (!finalScores) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center">
            <Loader2 className="w-12 h-12 animate-spin text-zinc-500 mb-6" />
            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Selesai!</h2>
            <p className="text-zinc-400 text-sm mb-8">Menunggu pemain lain menyelesaikan pertarungan...</p>
            
            <div className="w-full space-y-3">
              {playerScores.filter(p => !p.is_observer).map(p => (
                <div key={p.user_id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                    </div>
                    <span className="text-xs font-bold text-white">{p.username}</span>
                  </div>
                  <div className="text-xs font-bold">
                    {p.score === -1 ? (
                      <span className="text-red-500">DISKUALIFIKASI</span>
                    ) : p.is_ready ? (
                      <span className="text-green-500">SELESAI</span>
                    ) : (
                      <span className="text-zinc-400">{p.score % 1000}/{questions.length}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // All done - Show final scoreboard
    const sortedPlayers = [...finalScores].filter(p => !p.is_observer).sort((a, b) => {
      if (a.score === -1) return 1;
      if (b.score === -1) return -1;
      const aCorrect = Math.floor(a.score / 1000);
      const bCorrect = Math.floor(b.score / 1000);
      return bCorrect - aCorrect;
    });
    const validSorted = sortedPlayers.filter(p => p.score !== -1);
    
    // Determine winner based on correct answers
    const amIObserverNow = isObserverRef.current;
    const myScoreObj = finalScores.find(p => p.user_id === currentUser?.id);
    const myCorrect = myScoreObj && myScoreObj.score !== -1 ? Math.floor(myScoreObj.score / 1000) : -1;
    const topCorrect = validSorted.length > 0 ? Math.floor(validSorted[0].score / 1000) : 0;
    const topScorersCount = validSorted.filter(p => Math.floor(p.score / 1000) === topCorrect).length;

    const isWinner = !amIObserverNow && topScorersCount === 1 && myCorrect === topCorrect;
    const isDraw = !amIObserverNow && topScorersCount > 1 && myCorrect === topCorrect;
    const totalQuestionsCount = room?.questions?.length || questions.length;

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center py-12 px-4 text-zinc-100">
        <div className="text-center mb-10 mt-8">
          {amIObserverNow ? (
            <div className="inline-block relative">
              <div className="absolute inset-0 bg-indigo-500 blur-[40px] opacity-10 rounded-full"></div>
              <Eye className="w-20 h-20 text-indigo-400 relative z-10 mx-auto mb-4" />
              <h1 className="text-3xl font-black text-white uppercase tracking-[0.2em]">Pertandingan</h1>
              <p className="text-indigo-400 font-bold tracking-widest uppercase text-sm mt-1">Selesai</p>
            </div>
          ) : isWinner ? (
            <div className="inline-block relative">
              <div className="absolute inset-0 bg-yellow-500 blur-[40px] opacity-20 rounded-full"></div>
              <Trophy className="w-24 h-24 text-yellow-500 relative z-10 mx-auto mb-4" />
              <h1 className="text-4xl font-black text-white uppercase tracking-[0.2em]">Victory</h1>
            </div>
          ) : isDraw ? (
            <div className="inline-block relative">
              <Swords className="w-20 h-20 text-zinc-400 mx-auto mb-4" />
              <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-[0.2em]">Equal <span className="text-lg sm:text-xl text-zinc-500 block mt-2">(Seri)</span></h1>
            </div>
          ) : (
            <div className="inline-block relative">
              <XCircle className="w-20 h-20 text-zinc-600 mx-auto mb-4" />
              <h1 className="text-4xl font-black text-zinc-400 uppercase tracking-[0.2em]">Defeat</h1>
            </div>
          )}
        </div>


        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center mb-6">Papan Skor Akhir</h3>
          
          <div className="space-y-4">
            {sortedPlayers.map((p, i) => {
              const isForfeited = p.score === -1;
              const isMe = p.user_id === currentUser?.id;
              return (
                <div key={p.user_id} className={`flex items-center justify-between p-4 rounded-2xl border ${
                  isForfeited ? 'bg-red-950/30 border-red-900/50 opacity-60' :
                  i === 0 && !isDraw ? 'bg-yellow-500/10 border-yellow-500/30' : 
                  'bg-zinc-800/30 border-zinc-800'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="w-6 font-black text-zinc-500 text-lg">
                      {isForfeited ? '❌' : `#${i + 1}`}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                      {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-xs">👤</div>}
                    </div>
                    <div>
                      <div className="font-bold text-white">{p.username} {isMe && <span className="text-zinc-500 text-xs font-normal">(Anda)</span>}</div>
                      {isForfeited && <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Diskualifikasi</div>}
                    </div>
                  </div>
                  <div className="text-xl font-black text-white">
                    {isForfeited ? (
                      <span className="text-red-600 text-sm">—</span>
                    ) : (
                      <>{Math.floor(p.score / 1000)} / {totalQuestionsCount} <span className="text-xs text-zinc-500 font-normal">Benar</span></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center text-[10px] sm:text-xs text-zinc-500 font-medium">
            Pertandingan Persahabatan: XP Profil tidak terpengaruh (+0 XP)
          </div>

          <div className="flex gap-3 w-full mt-6">
            <button 
              onClick={() => handleReturn('dashboard')}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-xl py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors shadow-lg"
            >
              Kembali ke Dashboard
            </button>
            <button 
              onClick={() => handleReturn('room')}
              className="flex-1 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors shadow-lg"
            >
              Main Lagi (Lobi)
            </button>
          </div>
        </div>

        {/* Disband Warning Modal */}
        {showDisbandWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 p-6 sm:p-8 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-500 w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest">Bubarkan Room?</h2>
              <p className="text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed">
                Karena Anda adalah Host, kembali ke Dashboard akan <span className="text-red-400 font-bold">MEMBUBARKAN</span> room ini secara permanen. Pemain lain tidak akan bisa bermain lagi di room ini.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowDisbandWarning(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-3 text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDisband}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-colors shadow-lg"
                >
                  Ya, Bubarkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- PLAYING STATE ----
  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100 font-sans">
      
      {/* Sticky Live Score Header */}
      <div className="w-full bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5">
            <span>Room: {roomCode}</span>
            <div className="flex items-center gap-3">
              <span>Soal {currentQuestionIdx + 1} / {questions.length}</span>
              <VoiceChat channelName={roomCode} />
            </div>
          </div>
          
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {playerScores.map(p => {
              const isMe = p.user_id === currentUser?.id;
              const isForfeited = p.score === -1;
              const progressCount = isForfeited ? 0 : (p.score % 1000);
              
              let cardClass = isMe ? 'bg-zinc-100/5 border-zinc-700' : 'bg-zinc-950/50 border-zinc-800/50';
              if (isForfeited) cardClass = 'bg-red-950/30 border-red-900/50 opacity-80';

              return (
                <div key={p.user_id} className={`flex flex-col items-center p-2 rounded-xl border min-w-[60px] shrink-0 transition-colors ${cardClass}`}>
                  <div className={`w-6 h-6 rounded-full bg-zinc-800 overflow-hidden mb-1 shrink-0 ${isForfeited ? 'border border-red-500/50 grayscale' : ''}`}>
                    {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px]">👤</div>}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider truncate w-full text-center ${isForfeited ? 'text-red-500 line-through' : isMe ? 'text-white' : 'text-zinc-400'}`}>{p.username}</span>
                  <span className={`text-sm font-black ${isForfeited ? 'text-red-600' : isMe ? 'text-white' : 'text-zinc-500'}`}>{isForfeited ? 'X' : progressCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Gameplay Area */}
      <div className="flex-1 w-full max-w-3xl mx-auto p-4 flex flex-col justify-center">
        
        {/* Question Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] aspect-square bg-zinc-100/5 rounded-full blur-[100px] pointer-events-none"></div>
          
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight relative z-10 mb-8">
            {currentQuestion?.question}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative z-10">
            {['a', 'b', 'c', 'd'].map((letter, idx) => {
              const opt = currentQuestion?.[`option_${letter}` as keyof QuizQuestion] as string;
              if (!opt) return null;
              const optionLetter = letter.toUpperCase();
              const isSelected = selectedOption === idx;
              
              let btnClass = 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800';
              
              if (isAnswering) {
                if (isSelected) {
                  btnClass = showFeedback 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'bg-red-500/20 border-red-500 text-red-400';
                } else if (letter === currentQuestion?.correct_answer?.toLowerCase() && showFeedback === false) {
                  btnClass = 'bg-green-500/10 border-green-500/50 text-green-500/50';
                } else {
                  btnClass = 'bg-zinc-950/50 border-zinc-800/50 text-zinc-600 cursor-not-allowed';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx, optionLetter)}
                  disabled={isAnswering}
                  className={`relative w-full p-4 rounded-2xl border-2 text-left font-bold transition-all duration-300 flex items-center gap-4 group ${btnClass}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-colors
                    ${isSelected ? (showFeedback ? 'bg-green-500 text-zinc-950' : 'bg-red-500 text-white') : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}`}>
                    {optionLetter}
                  </div>
                  <span className="flex-1 text-sm sm:text-base">{opt}</span>
                  
                  {isSelected && showFeedback === true && <CheckCircle2 className="text-green-500 w-5 h-5 absolute right-4" />}
                  {isSelected && showFeedback === false && <XCircle className="text-red-500 w-5 h-5 absolute right-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Kicked by Host Modal */}
      {showKickedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 sm:p-8 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest">Room Dibubarkan</h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed">
              Maaf, Host telah membubarkan room ini secara permanen. Pertandingan telah berakhir.
            </p>
            <button
              onClick={() => router.replace('/arena')}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-colors shadow-lg"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      )}

    {/* Battle Chat */}
    {room && (
      <BattleChat 
        roomCode={roomCode} 
        currentUser={currentUser ? {
          id: currentUser.id,
          username: playerScores.find(p => p.user_id === currentUser.id)?.username || currentUser.email?.split('@')[0] || 'Player',
          avatar_url: playerScores.find(p => p.user_id === currentUser.id)?.avatar_url || ''
        } : null} 
      />
    )}

    </div>
  );
}
