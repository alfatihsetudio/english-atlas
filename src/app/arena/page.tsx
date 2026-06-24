'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import AuthModal from '@/components/AuthModal';
import { Trophy, ArrowLeft, LayoutGrid, User as UserIcon, Loader2, Sparkles, Settings, Search, Swords, BookOpen, ChevronRight, GraduationCap, Info, X } from 'lucide-react';
import { getRankInfo, RANKS } from '@/utils/rankSystem';
import QuizBoard from '@/components/QuizBoard';
import ClassicBoard from '@/components/ClassicBoard';
import Leaderboard from '@/components/Leaderboard';

export default function ArenaPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string; rank_points: number; highest_rank_points: number; global_rank: number | null; season_id?: string | null } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [quizState, setQuizState] = useState<'lobby' | 'loading_quiz' | 'playing'>('lobby');
  const [quizMode, setQuizMode] = useState<'ranked' | 'classic' | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedMode, setSelectedMode] = useState<'ranked' | 'classic'>('ranked');
  const [showClassicDifficultyModal, setShowClassicDifficultyModal] = useState(false);
  
  // Classic mode states
  const [classicTier, setClassicTier] = useState<number>(1);
  const [classicQuestions, setClassicQuestions] = useState<any[]>([]);
  const [classicCurrentIdx, setClassicCurrentIdx] = useState(0);
  const [isClassicLoading, setIsClassicLoading] = useState(false);
  const [isPrefetchingClassic, setIsPrefetchingClassic] = useState(false);

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Multiplayer states
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<any | null>(null);
  const [activeBattleRoom, setActiveBattleRoom] = useState<{ id: string; room_code: string; status: string } | null>(null);
  const [showOpponentPrompt, setShowOpponentPrompt] = useState(false);
  const [opponentCount, setOpponentCount] = useState<number>(1);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Fetch profile
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar_url, rank_points, highest_rank_points, season_id')
          .eq('id', currentUser.id)
          .single();
        
        let globalRank = null;
        try {
          const { data: rankPos } = await (supabase.rpc as any)('get_user_rank_position', { user_id: currentUser.id });
          globalRank = rankPos;
        } catch (e) {
          console.error("Error fetching global rank:", e);
        }
        
        if (data) {
          const profileData = data as any;
          
          // Seasonal Reset Logic
          const date = new Date();
          const currentSeasonId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          let currentRankPoints = profileData.rank_points || 0;
          let currentSeason = profileData.season_id;
          
          if (currentSeason !== currentSeasonId) {
            // New season detected, trigger reset!
            currentRankPoints = Math.floor(currentRankPoints / 2) + 100;
            currentSeason = currentSeasonId;
            
            // Update database silently
            await (supabase.from('profiles') as any)
              .update({ 
                rank_points: currentRankPoints,
                season_id: currentSeasonId 
              })
              .eq('id', currentUser.id);
          }

          setProfile({
            username: profileData.username || currentUser.email?.split('@')[0] || 'Player',
            avatar_url: profileData.avatar_url || '',
            rank_points: currentRankPoints,
            highest_rank_points: profileData.highest_rank_points || 0,
            global_rank: globalRank,
            season_id: currentSeason
          });
        } else {
          setProfile({ username: currentUser.email?.split('@')[0] || 'Player', avatar_url: '', rank_points: 0, highest_rank_points: 0, global_rank: null, season_id: null });
        }

        // Fetch active battle room
        try {
          const { data: participations } = await (supabase.from('battle_participants') as any)
            .select(`
              room_id,
              battle_rooms:room_id (id, room_code, status)
            `)
            .eq('user_id', currentUser.id);

          if (participations) {
            const active = (participations as any[]).find((p: any) => 
              p.battle_rooms && p.battle_rooms.status === 'waiting'
            );
            if (active) {
              setActiveBattleRoom(active.battle_rooms);
            } else {
              setActiveBattleRoom(null);
            }
          }
        } catch (e) {
          console.error("Error fetching active battle room:", e);
        }
      }
      setLoading(false);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        init(); // re-fetch on login
      } else {
        setProfile(null);
        setActiveBattleRoom(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen to battle_invites
  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    // Fetch any existing pending invites first (only within the last 5 minutes to avoid stale ones)
    async function checkExistingInvites() {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: existingInvites } = await (supabase.from('battle_invites') as any)
          .select('*')
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .gt('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (existingInvites && existingInvites.length > 0) {
          const invite = existingInvites[0];
          const { data: sender } = await supabase.from('profiles').select('username, avatar_url').eq('id', invite.sender_id).single();
          setPendingInvite({ ...invite, sender });
        }
      } catch (err) {
        console.error('Error fetching existing invites:', err);
      }
    }
    checkExistingInvites();
    
    const uniqueChannelName = `invites_${user.id}_${Math.random().toString(36).substring(2, 15)}`;
    const inviteChannel = supabase.channel(uniqueChannelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_invites',
        filter: `receiver_id=eq.${user.id}`
      }, async (payload) => {
        if (payload.new.status === 'pending') {
          // Fetch sender details
          const { data: sender } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.sender_id).single();
          setPendingInvite({ ...payload.new, sender });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_invites',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.status !== 'pending') {
          setPendingInvite(null);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(inviteChannel);
    };
  }, [user]);

  // Search debounce effect
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, rank_points, highest_rank_points')
          .ilike('username', `%${searchTerm}%`)
          .limit(5);

        if (data) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const handleStartGame = async (mode: 'ranked' | 'classic') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    if (mode === 'classic') {
      setShowClassicDifficultyModal(true);
      return;
    }

    setQuizMode(mode);
    setQuizState('loading_quiz');

    try {
      const currentPoints = profile ? profile.rank_points : 0;
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPoints: currentPoints, t: Date.now() })
      });

      const result = await response.json();
      if (!response.ok || !result.questions) {
        throw new Error(result.error || 'Failed to generate quiz');
      }

      setQuestions(result.questions);
      setQuizState('playing');
    } catch (error) {
      console.error(error);
      alert('Gagal menyiapkan soal dari AI. Silakan coba lagi.');
      setQuizState('lobby');
    }
  };

  const fetchClassicBatch = async (tier: number) => {
    const response = await fetch('/api/generate-classic-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, count: 5, t: Date.now() })
    });
    const result = await response.json();
    if (!response.ok || !result.questions) {
      throw new Error(result.error || 'Failed to generate classic quiz');
    }
    return result.questions;
  };

  const handleStartClassic = async (tier: number) => {
    setShowClassicDifficultyModal(false);
    setQuizMode('classic');
    setQuizState('playing');

    // If tier changed, reset questions. If same tier, resume where we left off.
    if (tier !== classicTier || classicQuestions.length === 0) {
      setClassicTier(tier);
      setClassicQuestions([]);
      setClassicCurrentIdx(0);
      setIsClassicLoading(true);

      try {
        const newQs = await fetchClassicBatch(tier);
        setClassicQuestions(newQs);
      } catch (error) {
        console.error(error);
        alert('Gagal menyiapkan soal edukasi dari AI. Silakan coba lagi.');
        setQuizState('lobby');
      } finally {
        setIsClassicLoading(false);
      }
    }
  };

  const handleNextClassicQuestion = async () => {
    const nextIdx = classicCurrentIdx + 1;
    setClassicCurrentIdx(nextIdx);

    // If we have 3 or fewer questions left, prefetch more in the background (avoiding API rate limits)
    if (classicQuestions.length - nextIdx <= 3 && !isPrefetchingClassic) {
      setIsPrefetchingClassic(true);
      try {
        const moreQs = await fetchClassicBatch(classicTier);
        setClassicQuestions(prev => [...prev, ...moreQs]);
      } catch (error) {
        console.error('Prefetch failed:', error);
      } finally {
        setIsPrefetchingClassic(false);
      }
    }
  };

  const handleExitClassic = () => {
    setQuizState('lobby');
    setQuizMode(null);
    // Note: We do NOT reset classicQuestions or classicCurrentIdx here
    // so the user can resume if they re-enter the same tier.
  };

  const handleCreateRoom = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setIsCreatingRoom(true);
    try {
      // Generate 6 random alphanumeric characters
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      
      const { data, error } = await (supabase.from('battle_rooms') as any)
        .insert({
          host_id: user.id,
          room_code: code,
          question_count: 5,
          status: 'waiting',
          max_players: opponentCount + 1
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // TAMBAHKAN HOST KE battle_participants!
      const { error: partError } = await (supabase.from('battle_participants') as any)
        .upsert({
          room_id: data.id,
          user_id: user.id,
          is_ready: false
        }, { onConflict: 'room_id,user_id' });
        
      if (partError) throw partError;
      
      router.push(`/arena/battle/${code}`);
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat room: ' + err.message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      alert('Kode room harus 6 karakter.');
      return;
    }
    setIsJoiningRoom(true);
    try {
      const { data: room, error: roomError } = await (supabase.from('battle_rooms') as any)
        .select('*')
        .eq('room_code', code)
        .single();
        
      if (roomError || !room) {
        throw new Error('Room tidak ditemukan.');
      }
      
      if (room.status !== 'waiting') {
        throw new Error('Game sudah dimulai atau selesai.');
      }
      
      const { data: participants, error: participantsError } = await (supabase.from('battle_participants') as any)
        .select('user_id')
        .eq('room_id', room.id);
        
      if (participantsError) throw participantsError;
      
      if (participants.length >= (room.max_players || 4) && !participants.some((p: any) => p.user_id === user.id)) {
        throw new Error(`Room sudah penuh (maksimal ${room.max_players || 4} orang).`);
      }
      
      // Upsert participant
      const { error: joinError } = await (supabase.from('battle_participants') as any)
        .upsert({
          room_id: room.id,
          user_id: user.id,
          is_ready: false
        }, { onConflict: 'room_id,user_id' });
        
      if (joinError) throw joinError;
      
      router.push(`/arena/battle/${code}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleInviteUser = async () => {
    if (!user || !selectedUser) return;
    setIsInviting(true);
    try {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      
      const { data: room, error: roomError } = await (supabase.from('battle_rooms') as any)
        .insert({
          host_id: user.id,
          room_code: code,
          question_count: 5,
          status: 'waiting'
        })
        .select()
        .single();
        
      if (roomError) throw roomError;
      
      const { error: partError } = await (supabase.from('battle_participants') as any)
        .upsert({
          room_id: room.id,
          user_id: user.id,
          is_ready: false
        }, { onConflict: 'room_id,user_id' });
        
      if (partError) throw partError;

      const { error: invError } = await (supabase.from('battle_invites') as any)
        .insert({
          sender_id: user.id,
          receiver_id: selectedUser.id,
          room_id: room.id,
          status: 'pending'
        });
        
      if (invError) throw invError;
      
      setSelectedUser(null);
      router.push(`/arena/battle/${code}`);
    } catch (err: any) {
      alert('Gagal mengundang: ' + err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!pendingInvite || !user) return;
    try {
      const { error: updateError } = await (supabase.from('battle_invites') as any)
        .update({ status: 'accepted' })
        .eq('id', pendingInvite.id);

      if (updateError) throw updateError;

      const { data: room } = await (supabase.from('battle_rooms') as any)
        .select('room_code')
        .eq('id', pendingInvite.room_id)
        .single();

      if (!room) throw new Error('Room tidak ditemukan');

      const { error: partError } = await (supabase.from('battle_participants') as any)
        .upsert({
          room_id: pendingInvite.room_id,
          user_id: user.id,
          is_ready: false
        }, { onConflict: 'room_id,user_id' });

      if (partError) throw partError;

      router.push(`/arena/battle/${room.room_code}`);
    } catch (err: any) {
      alert('Gagal menerima undangan: ' + err.message);
    } finally {
      setPendingInvite(null);
    }
  };

  const handleRejectInvite = async () => {
    if (!pendingInvite) return;
    try {
      const { error: rejectError } = await (supabase.from('battle_invites') as any)
        .update({ status: 'rejected' })
        .eq('id', pendingInvite.id);
      if (rejectError) throw rejectError;
    } catch (err) {
      console.error(err);
    } finally {
      setPendingInvite(null);
    }
  };

  const handleQuizComplete = async () => {
    setQuizState('lobby');
    setQuizMode(null);
    setQuestions([]);
    
    // Refresh profile to get updated points
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar_url, rank_points, highest_rank_points, season_id')
          .eq('id', user.id)
          .single();
        
        let globalRank = null;
        try {
          const { data: rankPos } = await (supabase.rpc as any)('get_user_rank_position', { user_id: user.id });
          globalRank = rankPos;
        } catch (e) {
          console.error("Error fetching global rank:", e);
        }
        
        if (data) {
          const profileData = data as any;
          setProfile({
            username: profileData.username || user.email?.split('@')[0] || 'Player',
            avatar_url: profileData.avatar_url || '',
            rank_points: profileData.rank_points || 0,
            highest_rank_points: profileData.highest_rank_points || 0,
            global_rank: globalRank,
            season_id: profileData.season_id
          });
        }
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (quizState === 'loading_quiz') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-30 rounded-full animate-pulse"></div>
          <Loader2 size={64} className="text-indigo-400 animate-spin relative z-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-100 flex items-center justify-center gap-2">
            <Sparkles className="text-yellow-400" /> AI Generating Quiz...
          </h2>
          <p className="text-gray-400">Menganalisis rank Anda dan menyiapkan arena pertarungan...</p>
        </div>
      </div>
    );
  }

  if (quizState === 'playing' && quizMode) {
    return (
      <div className="min-h-screen bg-gray-950 text-white pt-8 pb-24 px-4">
        <div className="max-w-3xl mx-auto mb-8 flex items-center justify-between">
          <button onClick={() => quizMode === 'classic' ? handleExitClassic() : handleQuizComplete()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1">
              {quizMode === 'ranked' ? 'Ranked Match' : 'Mode Latihan Edukasi'}
            </div>
            {quizMode === 'ranked' && (
              <div className="text-sm font-medium text-gray-400 flex items-center gap-2 justify-center">
                Target Rank: <span className="text-white font-bold">{profile ? getRankInfo(profile.rank_points).tier : 'Rookie'}</span>
              </div>
            )}
          </div>
          <div className="w-10"></div>
        </div>

        {quizMode === 'classic' ? (
          <ClassicBoard 
            questions={classicQuestions}
            currentIdx={classicCurrentIdx}
            isLoading={isClassicLoading}
            isPrefetching={isPrefetchingClassic}
            onNext={handleNextClassicQuestion}
            onExit={handleExitClassic}
          />
        ) : (
          <QuizBoard 
            questions={questions} 
            mode={quizMode} 
            currentPoints={profile?.rank_points || 0} 
            onComplete={handleQuizComplete} 
          />
        )}
      </div>
    );
  }

  // LOBBY STATE
  const rankInfo = profile ? getRankInfo(profile.rank_points) : null;
  const progressPercent = rankInfo 
    ? Math.min(100, Math.max(0, ((profile!.rank_points - rankInfo.minPoints) / (rankInfo.maxPoints - rankInfo.minPoints)) * 100))
    : 0;

  // Helper to get Rank emoji representation
  const getRankEmoji = (tier?: string) => {
    if (!tier) return '🔰';
    switch (tier) {
      case 'Immortal': return '👑';
      case 'Mythic': return '🐉';
      case 'Epic': return '🔮';
      case 'Grandmaster': return '⚔️';
      case 'Master': return '🛡️';
      case 'Elite': return '🎖️';
      default: return '🔰'; // Rookie
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 font-sans flex flex-col overflow-hidden relative">
      {/* Navbar Minimalis - Monochrome */}
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md h-12 px-4 flex items-center justify-between shrink-0 z-50">
        <Link href="/" className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors border border-zinc-800">
          <ArrowLeft size={14} />
        </Link>
        <h1 className="text-xs sm:text-sm font-bold text-white tracking-widest uppercase">
          Atlas Rank
        </h1>
        <div className="w-8"></div>
      </div>

      {/* Search Bar - Paling Atas */}
      <div className="max-w-6xl w-full mx-auto px-3 sm:px-4 pt-3 shrink-0">
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari Pemain untuk Mabar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors pl-9"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          {/* List Hasil Pencarian Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-50 flex flex-col divide-y divide-zinc-800 max-h-48 overflow-y-auto">
              {searchResults.map((p) => {
                const pRankInfo = getRankInfo(p.rank_points || 0);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedUser(p);
                      setSearchTerm('');
                      setSearchResults([]);
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.username} className="w-8 h-8 rounded-full border border-zinc-700 object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-850 border border-zinc-700 flex items-center justify-center text-zinc-500 text-[10px] shrink-0">
                        {getRankEmoji(pRankInfo.tier)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{p.username}</div>
                      <div className="text-[9px] text-zinc-500 truncate">{pRankInfo.tier} • {p.rank_points || 0} XP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-6xl w-full mx-auto px-3 sm:px-4 pt-2 pb-24 md:pb-24 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-6 flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
        
        {/* Kolom Kiri: Profil Pribadi & Rank Poster (Span 4 col) */}
        <div className="md:col-span-4 flex flex-col gap-3 min-h-0 md:overflow-y-auto pb-2 md:pb-0 shrink-0">
          
          {/* Profil Pribadi Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl p-3 shadow-2xl flex flex-col relative overflow-hidden shrink-0">
            {/* Header Profil (Horizontal Layout) */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center text-lg overflow-hidden shrink-0 shadow-inner">
                {user && profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{getRankEmoji(rankInfo?.tier)}</span>
                )}
              </div>
              
              <div className="flex flex-col min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  {user ? profile?.username : 'Guest Player'}
                </h2>
                <div className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase mt-0.5 w-fit">
                  {user ? (rankInfo?.tier || 'Rookie') : 'Not Ranked'}
                </div>
              </div>
            </div>

            {/* Progress Bar & Seasonal Info */}
            {user && rankInfo && (
              <div className="mt-2.5 w-full">
                <div className="flex justify-between text-[8px] font-bold text-zinc-400 mb-0.5">
                  <span>{profile?.rank_points || 0} XP</span>
                  <span>{rankInfo.maxPoints === Infinity ? 'MAX' : `${rankInfo.maxPoints + 1} XP`}</span>
                </div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, (((profile?.rank_points || 0) - rankInfo.minPoints) / (rankInfo.maxPoints - rankInfo.minPoints)) * 100))}%` }}
                  ></div>
                </div>
                <div className="text-center mt-1 text-[8px] text-zinc-500 font-medium">
                  Sisa {Math.ceil((new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} hari reset
                </div>
              </div>
            )}

            {/* Statistik Grid (Compact 4-column) */}
            {user ? (
              <div className="grid grid-cols-4 gap-1 mt-2.5 border-t border-zinc-850 pt-2 text-center">
                <div>
                  <div className="text-[7px] text-zinc-500 uppercase tracking-wider">Total XP</div>
                  <div className="text-[10px] font-bold text-white mt-0.5">{profile?.rank_points || 0}</div>
                </div>
                <div className="border-l border-zinc-850">
                  <div className="text-[7px] text-zinc-500 uppercase tracking-wider">Global</div>
                  <div className="text-[10px] font-bold text-white mt-0.5">
                    {profile?.global_rank ? `#${profile.global_rank}` : '#--'}
                  </div>
                </div>
                <div className="border-l border-zinc-850">
                  <div className="text-[7px] text-zinc-500 uppercase tracking-wider">Rank</div>
                  <div className="text-[9px] font-bold text-white mt-0.5 truncate">
                    {rankInfo?.tier || 'Rookie'}
                  </div>
                </div>
                <div className="border-l border-zinc-850">
                  <div className="text-[7px] text-zinc-500 uppercase tracking-wider">Top</div>
                  <div className="text-[9px] font-bold text-white mt-0.5 truncate">
                    {profile ? getRankInfo(profile.highest_rank_points).tier : 'Rookie'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 border-t border-zinc-850 pt-2 text-center">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-[9px] font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  LOGIN TO SAVE
                </button>
              </div>
            )}
          </div>

          {/* Rank Poster Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl p-3 shadow-2xl flex flex-col relative overflow-hidden shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="text-indigo-400" size={14} />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Sistem Rank Atlas</h3>
            </div>
            
            {/* Desktop View: Vertical List */}
            <div className="hidden md:block divide-y divide-zinc-850 text-[11px]">
              {RANKS.map((r) => (
                <div key={r.tier} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-1.5 min-w-[90px]">
                    <span className="text-sm">{getRankEmoji(r.tier)}</span>
                    <span className="font-bold text-white text-[10px]">{r.tier}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-bold tracking-wider">
                    {r.maxPoints === Infinity ? `${r.minPoints}+ XP` : `${r.minPoints}-${r.maxPoints}`}
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-[9px]">
                    <span className="text-green-400">+{r.winPoints} W</span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-red-400">{r.losePoints} L</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile View: Horizontal Scroll (Ultra Minimalist) */}
            <div className="md:hidden flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
              {RANKS.map((r) => (
                <div key={r.tier} className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-zinc-800/40 border border-zinc-800/60 min-w-[75px] text-center shrink-0">
                  <span className="text-xs">{getRankEmoji(r.tier)}</span>
                  <span className="font-bold text-white text-[8px] leading-tight mt-0.5">{r.tier}</span>
                  <span className="text-[7px] text-zinc-500 font-mono mt-0.5">
                    {r.maxPoints === Infinity ? `${r.minPoints}+` : `${r.minPoints}-${r.maxPoints}`}
                  </span>
                  <div className="flex items-center gap-0.5 text-[7px] font-bold mt-0.5">
                    <span className="text-green-400">+{r.winPoints}</span>
                    <span className="text-zinc-700">/</span>
                    <span className="text-red-400">{r.losePoints}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-center text-[8px] text-zinc-500 border-t border-zinc-800/60 pt-2 leading-relaxed">
              *Tanpa Safe Zone: Turun poin = Derank otomatis.
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Leaderboard Monokrom (Span 8 col) */}
        <div className="md:col-span-8 flex flex-col h-[380px] md:h-full flex-1 md:min-h-0 md:overflow-hidden shrink-0 pb-20 md:pb-0">
          {/* Kontainer Leaderboard */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
            <Leaderboard />
            
            {/* Sticky Status Bawah */}
            <div className="bg-zinc-950 border-t border-zinc-800 p-2 sm:p-3 text-center text-zinc-400 text-[10px] sm:text-xs font-medium mt-auto">
              {user ? (
                <>Posisi Anda: <span className="font-bold text-white">{profile?.global_rank ? `#${profile.global_rank}` : '#--'}</span> | Poin: <span className="font-bold text-white">{profile?.rank_points || 0}</span></>
              ) : (
                <>Login untuk melihat posisi Anda</>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Kontrol Game - 3 Tombol Utama di Tengah Bawah - Fixed / Paten */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pt-4 pb-3 z-40 border-t border-zinc-900/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
          <div className="grid grid-cols-3 gap-2">
            {/* Tombol Kiri: Latihan */}
            <button
              onClick={() => handleStartGame('classic')}
              className="w-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 rounded-lg sm:rounded-xl py-2.5 sm:py-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 transition-all text-center truncate"
            >
              Latihan
            </button>

            {/* Tombol Tengah: Ranked (Paling Menonjol) */}
            <button
              onClick={() => handleStartGame('ranked')}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg sm:rounded-xl py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider border-b-[2px] border-zinc-400 active:border-b-0 active:translate-y-[2px] transition-all shadow-lg text-center truncate"
            >
              Ranked
            </button>

            {/* Tombol Kanan: Battle */}
            <button
              onClick={() => setShowMultiplayerModal(true)}
              className="w-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 rounded-lg sm:rounded-xl py-2.5 sm:py-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 transition-all text-center truncate flex flex-col justify-center items-center"
            >
              <span className="truncate">BATTLE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail User Pencarian */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl max-w-xs w-full text-center shadow-2xl relative overflow-hidden flex flex-col items-center">
            
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-3 right-3 text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest"
            >
              Tutup
            </button>

            <div className="w-14 h-14 rounded-full border-2 border-zinc-700 bg-zinc-800 flex items-center justify-center text-xl overflow-hidden shrink-0 shadow-inner mb-2.5 mt-2">
              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{getRankEmoji(getRankInfo(selectedUser.rank_points || 0).tier)}</span>
              )}
            </div>

            <h3 className="text-sm font-bold text-white">{selectedUser.username}</h3>
            
            <div className="inline-block bg-zinc-850 text-zinc-300 px-3 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase mt-1">
              {getRankInfo(selectedUser.rank_points || 0).tier}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 border-t border-zinc-800 pt-4 w-full">
              <div className="text-center">
                <div className="text-[8px] text-zinc-500 uppercase tracking-widest">Total XP</div>
                <div className="text-xs font-bold text-white mt-0.5">{selectedUser.rank_points || 0}</div>
              </div>
              <div className="text-center border-l border-zinc-800">
                <div className="text-[8px] text-zinc-500 uppercase tracking-widest">Best Rank</div>
                <div className="text-xs font-bold text-white mt-0.5 truncate">
                  {getRankInfo(selectedUser.highest_rank_points || 0).tier}
                </div>
              </div>
            </div>

            <button
              onClick={handleInviteUser}
              disabled={isInviting || !user}
              className="w-full mt-5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              {isInviting && <div className="animate-spin w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full" />}
              {user ? 'Tantang Battle' : 'Login untuk Tantang'}
            </button>

          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}



      {/* Multiplayer Modal */}
      {showMultiplayerModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col">
            <button
              onClick={() => setShowMultiplayerModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest"
            >
              Tutup
            </button>
            <h2 className="text-base font-black text-white mb-2 uppercase tracking-wider">Battle Arena</h2>
            <div className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800 mb-5">
              <p className="text-[10px] text-zinc-400 leading-relaxed text-center font-medium">
                Sistem pertarungan real-time (Mabar) mulai dari <span className="text-white font-bold">1 VS 1</span> hingga <span className="text-white font-bold">4 Pemain</span>. Buat room dan bagikan kodenya, atau masukkan kode teman Anda.
              </p>
            </div>
            
            {activeBattleRoom ? (
              /* User is already in a room - show rejoin banner */
              <div className="flex flex-col gap-3">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-yellow-500/70 font-bold uppercase tracking-widest mb-1">Room Aktif</p>
                  <p className="text-white font-black text-xl font-mono tracking-widest mb-3">{activeBattleRoom.room_code}</p>
                  <p className="text-[10px] text-zinc-400 mb-4">Anda masih terdaftar di room ini. Kembali ke lobi atau keluar terlebih dahulu.</p>
                  <button
                    onClick={() => {
                      setShowMultiplayerModal(false);
                      router.push(`/arena/battle/${activeBattleRoom.room_code}`);
                    }}
                    className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-400 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <Swords size={14} /> Kembali ke Lobi
                  </button>
                </div>
              </div>
            ) : (
              /* Normal Create/Join UI */
              <div className="flex flex-col gap-3">
                {!showOpponentPrompt ? (
                  <button
                    onClick={() => setShowOpponentPrompt(true)}
                    disabled={isCreatingRoom}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-2.5 text-xs font-bold border border-zinc-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                  >
                    CREATE BATTLE ROOM
                  </button>
                ) : (
                  <div className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-xl flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center">
                      Jumlah Lawan (1 - 30)
                    </label>
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setOpponentCount(Math.max(1, opponentCount - 1))}
                        className="w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-black flex items-center justify-center transition-colors"
                      >-</button>
                      <input 
                        type="number" 
                        min="1" 
                        max="30"
                        value={opponentCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) setOpponentCount(Math.min(30, Math.max(1, val)));
                        }}
                        className="w-16 bg-zinc-950 border border-zinc-700 text-white rounded-lg py-1.5 text-center font-bold outline-none focus:border-zinc-500"
                      />
                      <button 
                        onClick={() => setOpponentCount(Math.min(30, opponentCount + 1))}
                        className="w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-black flex items-center justify-center transition-colors"
                      >+</button>
                    </div>
                    <button
                      onClick={handleCreateRoom}
                      disabled={isCreatingRoom}
                      className="w-full bg-white hover:bg-zinc-200 text-zinc-950 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors shadow-lg mt-1 flex justify-center items-center gap-2"
                    >
                      {isCreatingRoom && <div className="animate-spin w-3 h-3 border-2 border-zinc-900 border-t-transparent rounded-full" />}
                      LANJUT BUAT ROOM
                    </button>
                  </div>
                )}

                <div className="flex items-center my-1.5">
                  <hr className="flex-1 border-zinc-800" />
                  <span className="px-3 text-[9px] text-zinc-600 font-bold tracking-widest uppercase">Atau</span>
                  <hr className="flex-1 border-zinc-800" />
                </div>

                <div className="flex shadow-lg rounded-xl">
                  <input
                    type="text"
                    placeholder="CODE"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 rounded-l-xl px-4 py-2.5 outline-none focus:border-zinc-700 font-mono text-center uppercase text-xs"
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={isJoiningRoom || joinCode.length !== 6}
                    className="bg-zinc-200 hover:bg-white text-zinc-900 font-black px-5 rounded-r-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px] text-[10px]"
                  >
                    {isJoiningRoom ? <div className="animate-spin w-3 h-3 border-2 border-zinc-900 border-t-transparent rounded-full" /> : 'JOIN'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Invite Modal/Toast */}
      {pendingInvite && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-white mb-4">
              {pendingInvite.sender?.avatar_url ? (
                <img src={pendingInvite.sender.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
              )}
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              <span className="text-zinc-400">Tantangan dari</span><br/>
              {pendingInvite.sender?.username || 'Pemain'}
            </h2>
            <p className="text-xs text-zinc-500 mb-6 uppercase tracking-widest font-bold">Battle Mode 1 VS 1</p>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={handleRejectInvite}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-3 text-xs font-bold transition-colors"
              >
                TOLAK
              </button>
              <button
                onClick={handleAcceptInvite}
                className="flex-1 bg-white hover:bg-zinc-200 text-zinc-900 rounded-xl py-3 text-xs font-black transition-colors"
              >
                TERIMA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Latihan Mode Difficulty Modal */}
      {showClassicDifficultyModal && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-zinc-900 border-t sm:border border-zinc-800 p-0 sm:p-2 sm:rounded-3xl max-w-lg w-full shadow-2xl relative flex flex-col h-[85vh] sm:h-auto max-h-screen animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
            
            {/* Header */}
            <div className="p-6 pb-4 border-b border-zinc-800 relative shrink-0">
              <div className="flex items-center gap-3 text-indigo-400 mb-2">
                <BookOpen className="w-5 h-5" />
                <h2 className="text-base font-black text-white uppercase tracking-widest">Mode Latihan</h2>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Pilih tingkat kesulitan materi. Mode ini didesain khusus sebagai mesin edukasi (Instant Feedback) dan tidak memengaruhi poin XP/Rank Anda.
              </p>
              <button
                onClick={() => setShowClassicDifficultyModal(false)}
                className="absolute top-6 right-6 w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Content (Scrollable list of tiers) */}
            <div className="overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar flex-1 min-h-0">
              
              {[
                { tier: 1, name: 'Beginner', title: 'Tier 1', desc: 'Materi dasar & vocabulary sehari-hari. Cocok untuk pemula.', color: 'text-emerald-400', border: 'hover:border-emerald-500/50', bg: 'hover:bg-emerald-500/5' },
                { tier: 2, name: 'Elementary', title: 'Tier 2', desc: 'Simple Tenses, Prepositions, & struktur kalimat dasar.', color: 'text-cyan-400', border: 'hover:border-cyan-500/50', bg: 'hover:bg-cyan-500/5' },
                { tier: 3, name: 'Intermediate', title: 'Tier 3', desc: 'Conditionals, Passive Voice, & Perfect Tenses.', color: 'text-amber-400', border: 'hover:border-amber-500/50', bg: 'hover:bg-amber-500/5' },
                { tier: 4, name: 'Advanced', title: 'Tier 4', desc: 'Subjunctive, Relative Clauses, & Grammar Lanjutan.', color: 'text-purple-400', border: 'hover:border-purple-500/50', bg: 'hover:bg-purple-500/5' },
                { tier: 5, name: 'Immortal Mastery', title: 'Tier 5', desc: 'Pola kalimat Inversion, struktur kompleks & jebakan tingkat dewa.', color: 'text-rose-500', border: 'hover:border-rose-500/50', bg: 'hover:bg-rose-500/5', icon: <Trophy className="w-4 h-4 inline-block ml-1" /> }
              ].map((t) => (
                <button
                  key={t.tier}
                  onClick={() => handleStartClassic(t.tier)}
                  className={`w-full text-left p-5 rounded-2xl border border-zinc-800 bg-zinc-950/50 ${t.border} ${t.bg} transition-all duration-300 group relative overflow-hidden flex items-center justify-between gap-4`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${t.color}`}>{t.title}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                      <span className="text-sm font-bold text-white uppercase tracking-wider">{t.name} {t.icon}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium line-clamp-2">
                      {t.desc}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-zinc-800 transition-all">
                    <ChevronRight className={`w-5 h-5 ${t.color}`} />
                  </div>
                </button>
              ))}

            </div>
          </div>
        </div>
      )}

      {/* Floating Active Room Indicator / Rejoin Button */}
      {activeBattleRoom && (
        <button
          onClick={() => {
            router.push(`/arena/battle/${activeBattleRoom.room_code}`);
          }}
          className="fixed bottom-6 right-6 z-50 bg-zinc-900 border-2 border-yellow-500/50 hover:border-yellow-500 text-white rounded-full p-4 sm:px-5 sm:py-3 transition-all duration-300 flex items-center gap-2.5 shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_25px_rgba(234,179,8,0.4)] group overflow-hidden animate-bounce"
        >
          {/* Glowing pulse indicator */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          </span>
          
          <Swords size={16} className="text-yellow-500 animate-pulse shrink-0" />
          
          <span className="text-xs font-black uppercase tracking-widest text-zinc-100 hidden sm:inline-block">
            Battle Aktif: {activeBattleRoom.room_code}
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-zinc-100 sm:hidden">
            {activeBattleRoom.room_code}
          </span>
        </button>
      )}
    </div>
  );
}
