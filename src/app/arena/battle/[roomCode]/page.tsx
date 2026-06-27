'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, Play, CheckCircle2, Clock, Search, Loader2, X } from 'lucide-react';
import { getRankInfo } from '@/utils/rankSystem';
import dynamic from 'next/dynamic';

const VoiceChat = dynamic(() => import('@/components/VoiceChat'), { ssr: false });
const BattleChat = dynamic(() => import('@/components/BattleChat'), { ssr: false });

export default function BattleLobbyPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const roomCode = resolvedParams.roomCode.toUpperCase();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Search/Invite states
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);

  useEffect(() => {
    let lobbyChannel: any = null;
    let active = true;

    async function initLobby() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) {
        router.replace('/arena');
        return;
      }
      setCurrentUser(session.user);

      // Fetch Room
      const { data: roomData, error: roomError } = await (supabase.from('battle_rooms') as any)
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (!active) return;
      if (roomError || !roomData) {
        alert('Room tidak ditemukan!');
        router.replace('/arena');
        return;
      }
      setRoom(roomData);

      // Fetch Participants
      await fetchParticipants(roomData.id);
      if (!active) return;
      setLoading(false);
      
      // Single channel for all realtime events
      const uniqueChannelName = `lobby_${roomData.id}_${Math.random().toString(36).substring(2, 15)}`;
      lobbyChannel = supabase.channel(uniqueChannelName)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_rooms',
          filter: `id=eq.${roomData.id}`
        }, (payload) => {
          if (!active) return;
          const newRoom = payload.new as any;
          setRoom(newRoom);
          if (newRoom.status === 'playing') {
            // Room is now playing - redirect to game
            router.push(`/arena/battle/${roomCode}/play`);
          }
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'battle_rooms',
          filter: `id=eq.${roomData.id}`
        }, () => {
          if (!active) return;
          alert('Room telah dibatalkan oleh Host.');
          router.replace('/arena');
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'battle_participants',
          filter: `room_id=eq.${roomData.id}`
        }, () => {
          fetchParticipants(roomData.id);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_invites',
          filter: `room_id=eq.${roomData.id}`
        }, (payload) => {
          if ((payload.new as any).status === 'rejected') {
            alert('Undangan Anda telah ditolak oleh pemain.');
          }
        })
        .subscribe();
    }
    
    initLobby();

    return () => {
      active = false;
      if (lobbyChannel) {
        supabase.removeChannel(lobbyChannel);
      }
    };
  }, [roomCode, router]);

  const fetchParticipants = async (roomId: string) => {
    const { data } = await (supabase.from('battle_participants') as any)
      .select(`
        is_ready,
        score,
        user_id,
        profiles:user_id (username, avatar_url, rank_points)
      `)
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
      
    if (data) {
      setParticipants(data);
    }
  };

  // Search debounce effect
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        let query = supabase.from('profiles')
          .select('id, username, avatar_url, rank_points, highest_rank_points')
          .ilike('username', `%${searchTerm}%`);
          
        if (currentUser?.id) {
          query = query.neq('id', currentUser.id);
        }
        
        const { data } = await (query as any).limit(5);

        if (data) setSearchResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const handleInviteUser = async (userToInvite: any) => {
    if (!currentUser || !room) return;
    setIsInviting(true);
    try {
      const { error: invError } = await (supabase.from('battle_invites') as any)
        .insert({
          sender_id: currentUser.id,
          receiver_id: userToInvite.id,
          room_id: room.id,
          status: 'pending'
        });
        
      if (invError) throw invError;
      setInvitedUserIds(prev => [...prev, userToInvite.id]);
      
      // Auto close modal after showing 'Terkirim' feedback
      setTimeout(() => {
        setShowSearchModal(false);
      }, 800);
    } catch (err: any) {
      alert('Gagal mengundang: ' + err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleToggleReady = async () => {
    if (!room || !currentUser) return;
    const me = participants.find(p => p.user_id === currentUser.id);
    if (!me) return;
    
    await (supabase.from('battle_participants') as any)
      .update({ is_ready: !me.is_ready })
      .eq('room_id', room.id)
      .eq('user_id', currentUser.id);
  };

  const handleQuestionCountChange = async (count: number) => {
    if (!room || !currentUser || room.host_id !== currentUser.id) return;
    await (supabase.from('battle_rooms') as any)
      .update({ question_count: count })
      .eq('id', room.id);
  };

  const difficulties = [
    { id: 'Tier 1: Foundation (Easy)', label: 'Foundation', tier: 'Tier 1', desc: 'Materi dasar: Tenses dasar (Present/Past), Artikel, & Kosakata sehari-hari.' },
    { id: 'Tier 2: Intermediate (Medium)', label: 'Intermediate', tier: 'Tier 2', desc: 'Materi menengah: Conditional Sentences, Passive Voice, & Perfect Tenses.' },
    { id: 'Tier 3: Advanced (Hard)', label: 'Advanced', tier: 'Tier 3', desc: 'Materi kompleks: Inversion, Subjunctive, & Advanced Relative Clauses.' },
  ];

  const handleChangeDifficulty = async (tierId: string) => {
    if (!room || !currentUser || room.host_id !== currentUser.id) return;
    await (supabase.from('battle_rooms') as any)
      .update({ difficulty: tierId })
      .eq('id', room.id);
  };

  // HOST: Generate questions from AI, save to DB, then set status='playing'
  const handleStartBattle = async () => {
    if (!room || !currentUser || room.host_id !== currentUser.id) return;
    const others = participants.filter(p => p.user_id !== currentUser.id);
    // Lawan dianggap benar-benar 'Ready' di lobi jika is_ready = true DAN score = 0
    if (others.length === 0 || others.some(p => !(p.is_ready && p.score === 0))) return;

    setIsStarting(true);
    try {
      // Fetch AI questions
      const { data: profile } = await (supabase.from('profiles') as any)
        .select('rank_points').eq('id', currentUser.id).single();
      const currentPoints = profile ? profile.rank_points || 0 : 0;

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPoints: currentPoints, 
          count: room.question_count || 5,
          difficulty: room.difficulty || 'Tier 1: Foundation (Easy)',
          mode: 'battle'
        })
      });

      const result = await response.json();
      if (!response.ok || !result.questions) {
         throw new Error(`AI API Error: ${result.error || JSON.stringify(result)}`);
      }

      // Save questions to DB and set status='playing' in one update
      const { error: updateError } = await (supabase.from('battle_rooms') as any)
        .update({ 
          status: 'playing',
          questions: result.questions
        })
        .eq('id', room.id);

      if (updateError) {
         console.error("Supabase Update Error Details:", updateError);
         throw new Error(`Supabase Error: ${updateError.message || JSON.stringify(updateError)}`);
      }
      
      // Navigation is handled by the realtime listener above
    } catch (err: any) {
      console.error('Error starting battle stringified:', String(err));
      console.error('Error starting battle object:', err);
      alert('Gagal memulai pertandingan:\n' + (err.message || JSON.stringify(err)));
      setIsStarting(false);
    }
  };

  // HOST: Cancel room - deletes the room (cascade deletes participants)
  const handleCancelRoom = async () => {
    console.log("handleCancelRoom clicked");
    if (!room || !currentUser || room.host_id !== currentUser.id) return;
    
    // confirm() dihilangkan sementara untuk mengecek apakah diblokir browser
    setIsCanceling(true);
    try {
      const { error } = await (supabase.from('battle_rooms') as any)
        .delete()
        .eq('id', room.id);
      
      if (error) {
        console.error('Error canceling room:', error);
        alert('Gagal membatalkan room: ' + error.message + '\n\nPastikan SQL policy DELETE sudah ditambahkan di Supabase.');
        setIsCanceling(false);
        return;
      }
      // Success - navigate away (guests will be kicked via realtime)
      router.replace('/arena');
    } catch (err: any) {
      console.error('Error canceling room:', err);
      alert('Gagal membatalkan room: ' + err.message);
      setIsCanceling(false);
    }
  };

  // GUEST/HOST: Simply leave without deleting room
  const handleLeaveRoom = () => {
    router.push('/arena');
  };

  // GUEST: Quit room completely
  const handleQuitRoom = async () => {
    console.log("handleQuitRoom clicked", { room: !!room, user: !!currentUser, hostId: room?.host_id, myId: currentUser?.id });
    if (!room || !currentUser || room.host_id === currentUser.id) {
       console.log("Returned early!");
       return;
    }
    
    // confirm() dihilangkan sementara untuk mengecek apakah diblokir browser
    try {
      const { error } = await (supabase.from('battle_participants') as any)
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', currentUser.id);
        
      if (error) throw error;
      
      router.replace('/arena');
    } catch (err: any) {
      console.error('Quit room error:', err);
      alert('Gagal keluar room: ' + err.message + '\n(Mungkin RLS di database memblokir)');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const isHost = room?.host_id === currentUser?.id;
  const myParticipant = participants.find(p => p.user_id === currentUser?.id);
  const guests = participants.filter(p => p.user_id !== room?.host_id);
  // Guest dianggap ready untuk next match JIKA is_ready true DAN score sudah ter-reset ke 0 (tanda mereka sudah kembali ke lobi)
  const allReady = guests.length > 0 && guests.every(p => p.is_ready && p.score === 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 flex flex-col items-center pb-28">
      
      {/* Navbar Minimalis */}
      <div className="w-full max-w-5xl flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleLeaveRoom} 
            className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors border border-zinc-800"
            title="Keluar Sementara (Kembali ke Lobi Utama)"
          >
            <ArrowLeft size={16} />
          </button>
          {isHost ? (
            <button
              onClick={handleCancelRoom}
              disabled={isCanceling}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/50 hover:bg-red-900/50 border border-red-900 text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors shrink-0"
            >
              {isCanceling ? <div className="animate-spin w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full" /> : <X size={12} />}
              <span>Batalkan Room</span>
            </button>
          ) : (
            <button
              onClick={handleQuitRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/50 hover:bg-red-900/50 border border-red-900 text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors shrink-0"
              title="Keluar secara permanen dari room ini"
            >
              <X size={12} />
              <span>Keluar Room</span>
            </button>
          )}
        </div>
        <h1 className="hidden md:flex text-sm font-bold text-white tracking-widest uppercase items-center gap-2">
          <Users size={16} /> Battle Arena
        </h1>
        <VoiceChat channelName={roomCode} />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-5xl flex flex-col items-center flex-1">
        
        {/* Header - Digital Plate */}
        <div className="text-center mb-4 flex items-center justify-center gap-4">
          <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase">Room Code:</p>
          <div className="inline-block bg-zinc-900 border border-zinc-700 px-6 py-2 text-2xl font-mono tracking-[0.25em] rounded-xl shadow-xl text-white">
            {roomCode}
          </div>
        </div>

        {/* Room Settings (Host & Guest) */}
        {isHost ? (
          <div className="w-full flex flex-col items-center gap-4 mb-6">
            {/* Difficulty Selector */}
            <div className="w-full flex flex-col gap-2 max-w-4xl">
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider text-center">Pilih Kategori Soal:</span>
              <div className="flex flex-col md:grid md:grid-cols-3 gap-2 w-full">
                {difficulties.map(diff => {
                  const isSelected = room?.difficulty === diff.id || (!room?.difficulty && diff.id === 'Tier 1: Foundation (Easy)');
                  return (
                    <button
                      key={diff.id}
                      onClick={() => handleChangeDifficulty(diff.id)}
                      className={`relative text-left px-4 py-3 md:p-4 rounded-xl border transition-all flex flex-row md:flex-col items-center md:items-start justify-between ${
                        isSelected
                          ? 'bg-zinc-800 border-zinc-500 shadow-md'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex flex-col md:w-full">
                        <div className="flex items-center gap-1.5 mb-0 md:mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{diff.tier}</span>
                          <span className={`md:hidden text-xs font-bold ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>- {diff.label}</span>
                        </div>
                        <h3 className={`hidden md:block text-sm font-bold mb-1.5 ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{diff.label}</h3>
                        <p className="text-xs text-zinc-500 leading-snug hidden md:block">{diff.desc}</p>
                      </div>
                      {isSelected && <CheckCircle2 size={16} className="text-white shrink-0 ml-2 md:absolute md:top-4 md:right-4" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question Count */}
            <div className="flex items-center justify-center gap-3 bg-zinc-900/50 border border-zinc-800 p-2 rounded-xl w-full max-w-[320px]">
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider pl-3">Jumlah Soal:</span>
              <div className="flex gap-1">
                {[5, 10, 15].map(num => (
                  <button
                    key={num}
                    onClick={() => handleQuestionCountChange(num)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      room?.question_count === num 
                        ? 'bg-white text-zinc-900' 
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="text-center bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-xl shadow-md flex items-center justify-center gap-3">
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Kategori:</p>
              <h3 className="text-sm font-black text-white">{room?.difficulty || 'Tier 1: Foundation (Easy)'}</h3>
            </div>
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest bg-zinc-900/50 border border-zinc-800 px-5 py-2 rounded-xl">
              Jumlah Soal: <span className="text-white">{room?.question_count}</span>
            </div>
          </div>
        )}

        {/* Grid Pemain */}
        <div className={`w-full grid gap-2 mt-2 max-w-5xl ${
          (room?.max_players || 4) > 16 ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8' :
          (room?.max_players || 4) > 8 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' :
          'grid-cols-2 md:grid-cols-4'
        }`}>
          {Array.from({ length: room?.max_players || 4 }).map((_, index) => {
            const player = participants[index];
            const isPlayerHost = player && player.user_id === room?.host_id;

            if (player && player.profiles) {
              const rankTier = getRankInfo(player.profiles.rank_points || 0).tier;
              return (
                <div key={player.user_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col items-center relative overflow-hidden group shadow-md min-h-[130px]">
                  {isPlayerHost && (
                    <div className="absolute top-0 left-0 w-full bg-zinc-800 text-[9px] text-zinc-400 font-bold text-center py-0.5 tracking-widest">HOST</div>
                  )}
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 ${player.is_ready ? 'border-green-500/50' : 'border-zinc-700'} bg-zinc-800 flex items-center justify-center text-xl overflow-hidden mt-2 mb-2 shadow-inner transition-colors`}>
                    {player.profiles.avatar_url ? (
                      <img src={player.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-white truncate w-full text-center">{player.profiles.username}</h3>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">{rankTier}</p>
                  
                  {isPlayerHost ? (
                    <div className="flex items-center gap-1 text-zinc-400 text-[10px] md:text-xs font-bold mt-auto">
                      👑 <span className="uppercase tracking-widest">Master</span>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-auto ${player.is_ready && player.score === 0 ? 'text-green-500' : 'text-zinc-500'}`}>
                      {player.is_ready && player.score === 0 ? <><CheckCircle2 size={12}/> READY</> : <><Clock size={12}/> WAITING</>}
                    </div>
                  )}
                </div>
              );
            }

            // Slot Kosong
            return (
              <div key={`empty-${index}`} className={`border-2 border-dashed border-zinc-800/50 rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center min-h-[130px] hover:border-zinc-700 transition-colors group`}>
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center mb-2 group-hover:border-zinc-500 transition-colors">
                  <Users size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
                {isHost ? (
                  <button 
                    onClick={() => {
                      setInvitedUserIds([]);
                      setShowSearchModal(true);
                    }} 
                    className="mt-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-2 sm:px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors"
                  >
                    + Invite Lawan
                  </button>
                ) : (
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center mt-1">Menunggu<br/>Penantang...</p>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent z-40 flex justify-center border-t border-zinc-800/30 backdrop-blur-sm">
        <div className="w-full max-w-5xl">
          {isHost ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleStartBattle}
                disabled={!allReady || isStarting}
                className="w-full max-w-xs flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:shadow-none"
              >
                {isStarting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Memulai...
                  </>
                ) : (
                  <>
                    <Play size={16} /> START BATTLE
                  </>
                )}
              </button>
              {!allReady && participants.length > 1 && (
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Semua pemain harus ready</p>
              )}
              {participants.length <= 1 && (
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Butuh minimal 1 lawan</p>
              )}
            </div>
          ) : (
            <button
              onClick={handleToggleReady}
              className={`w-full max-w-xs mx-auto flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest transition-all shadow-md border ${
                myParticipant?.is_ready && myParticipant?.score === 0
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800' 
                  : 'bg-zinc-100 border-white text-zinc-950 hover:bg-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
              }`}
            >
              {myParticipant?.is_ready && myParticipant?.score === 0 ? 'BATAL READY' : 'READY!'}
            </button>
          )}
        </div>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative flex flex-col">
            <button
              onClick={() => setShowSearchModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest"
            >
              Tutup
            </button>
            <h2 className="text-base font-black text-white mb-4 uppercase tracking-wider">Cari Pemain</h2>
            
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-zinc-500" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari username..."
                className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-zinc-700 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-[300px] flex flex-col gap-2">
              {searching ? (
                <div className="text-center py-4 text-xs text-zinc-500">Mencari...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(res => (
                  <div key={res.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden border-2 border-zinc-600">
                        {res.avatar_url ? (
                          <img src={res.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-sm">👤</span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{res.username}</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase">{getRankInfo(res.rank_points || 0).tier}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleInviteUser(res)}
                      disabled={isInviting || invitedUserIds.includes(res.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                        invitedUserIds.includes(res.id)
                          ? 'bg-zinc-800 text-zinc-400 cursor-default border border-zinc-700/50'
                          : 'bg-white hover:bg-zinc-200 text-zinc-950 disabled:opacity-50'
                      }`}
                    >
                      {invitedUserIds.includes(res.id) ? (
                        <>
                          <CheckCircle2 size={12} className="text-green-500" />
                          Terkirim
                        </>
                      ) : (
                        'Invite'
                      )}
                    </button>
                  </div>
                ))
              ) : searchTerm ? (
                <div className="text-center py-4 text-xs text-zinc-500">Pemain tidak ditemukan</div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Battle Chat */}
      {room && (
        <BattleChat 
          roomCode={roomCode} 
          currentUser={currentUser ? {
            id: currentUser.id,
            username: myParticipant?.profiles?.username || currentUser.email?.split('@')[0] || 'Player',
            avatar_url: myParticipant?.profiles?.avatar_url || ''
          } : null} 
        />
      )}
    </div>
  );
}
