'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRankInfo } from '@/utils/rankSystem';
import { X, Award, Shield, Target, Play, BarChart2, Star, Loader2 } from 'lucide-react';

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
  actionButton?: React.ReactNode;
}

export default function UserProfileModal({ userId, onClose, actionButton }: UserProfileModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // Friendship states
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'loading'>('loading');
  const [relationId, setRelationId] = useState<string | null>(null);

  useEffect(() => {
    const uId = userId;
    if (!uId) return;
    
    async function fetchUserProfile() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const me = session?.user?.id || null;
        setCurrentUserId(me);

        if (me && me === uId) {
          setFriendStatus('self');
        } else if (me) {
          const { data: friendData } = await (supabase.from('friends') as any)
            .select('*')
            .or(`and(sender_id.eq.${me},receiver_id.eq.${uId}),and(sender_id.eq.${uId},receiver_id.eq.${me})`)
            .maybeSingle();

          if (friendData) {
            setRelationId(friendData.id);
            if (friendData.status === 'accepted') {
              setFriendStatus('accepted');
            } else if (friendData.sender_id === me) {
              setFriendStatus('pending_sent');
            } else {
              setFriendStatus('pending_received');
            }
          } else {
            setFriendStatus('none');
          }
        } else {
          setFriendStatus('none');
        }

        const { data: profileData, error: profileErr } = await (supabase.from('profiles') as any)
          .select('id, username, avatar_url, rank_points, highest_rank_points, total_questions_answered, total_correct_answers, total_matches_played')
          .eq('id', uId)
          .single();

        if (profileErr) throw profileErr;
        setProfile(profileData);

        // Fetch history from season_history
        try {
          const { data: historyData, error: historyErr } = await (supabase.from('season_history') as any)
            .select('*')
            .eq('user_id', uId)
            .order('season_id', { ascending: false });

          if (!historyErr && historyData) {
            setHistory(historyData);
          } else {
            setHistory([]);
          }
        } catch (hErr) {
          console.error('Error fetching season history:', hErr);
          setHistory([]);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [userId]);

  const handleAddFriend = async () => {
    if (!currentUserId || !userId) return;
    setFriendStatus('loading');
    const { data } = await (supabase.from('friends') as any).insert({
      sender_id: currentUserId,
      receiver_id: userId,
      status: 'pending'
    }).select().single();
    if (data) {
      setRelationId(data.id);
      setFriendStatus('pending_sent');
    } else {
      setFriendStatus('none');
    }
  };

  const handleAcceptFriend = async () => {
    if (!relationId) return;
    setFriendStatus('loading');
    await (supabase.from('friends') as any).update({ status: 'accepted' }).eq('id', relationId);
    setFriendStatus('accepted');
  };

  const handleRemoveFriend = async () => {
    if (!relationId) return;
    setFriendStatus('loading');
    await (supabase.from('friends') as any).delete().eq('id', relationId);
    setRelationId(null);
    setFriendStatus('none');
  };

  if (!userId) return null;

  const displayName = profile?.username || 'Pemain';
  const displayAvatar = profile?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  const rankPoints = profile?.rank_points || 0;
  const rankInfo = getRankInfo(rankPoints);
  const highestPoints = profile?.highest_rank_points || 0;
  const highestRankInfo = getRankInfo(highestPoints);

  const totalQuestions = profile?.total_questions_answered || 0;
  const totalCorrect = profile?.total_correct_answers || 0;
  const totalMatches = profile?.total_matches_played || 0;

  const accuracy = totalQuestions > 0 
    ? Math.round((totalCorrect / totalQuestions) * 100) 
    : 0;

  // Custom Tier UI configurations for premium aesthetic
  const tierConfigs: Record<string, {
    label: string;
    gradient: string;
    border: string;
    text: string;
    bg: string;
    shadow: string;
    glowDot: string;
  }> = {
    Rookie: {
      label: 'ROOKIE',
      gradient: 'from-slate-400 to-zinc-500',
      border: 'border-slate-800',
      text: 'text-slate-300',
      bg: 'from-zinc-950 via-zinc-900 to-zinc-950',
      shadow: 'shadow-[0_0_15px_rgba(148,163,184,0.05)]',
      glowDot: 'bg-slate-400',
    },
    Elementary: {
      label: 'ELEMENTARY',
      gradient: 'from-emerald-400 to-teal-500',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      bg: 'from-zinc-950 via-emerald-950/15 to-zinc-950',
      shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
      glowDot: 'bg-emerald-400',
    },
    Intermediate: {
      label: 'INTERMEDIATE',
      gradient: 'from-blue-400 to-indigo-500',
      border: 'border-indigo-500/20',
      text: 'text-indigo-400',
      bg: 'from-zinc-950 via-indigo-950/15 to-zinc-950',
      shadow: 'shadow-[0_0_20px_rgba(99,102,241,0.08)]',
      glowDot: 'bg-indigo-400',
    },
    Advanced: {
      label: 'ADVANCED',
      gradient: 'from-amber-400 to-orange-500',
      border: 'border-amber-500/25',
      text: 'text-amber-400',
      bg: 'from-zinc-950 via-amber-950/20 to-zinc-950',
      shadow: 'shadow-[0_0_25px_rgba(245,158,11,0.12)]',
      glowDot: 'bg-amber-400',
    },
    Immortal: {
      label: 'IMMORTAL',
      gradient: 'from-purple-400 via-fuchsia-500 to-pink-500',
      border: 'border-fuchsia-500/30',
      text: 'text-fuchsia-400',
      bg: 'from-zinc-950 via-fuchsia-950/25 to-zinc-950',
      shadow: 'shadow-[0_0_30px_rgba(217,70,239,0.18)]',
      glowDot: 'bg-fuchsia-500 animate-ping',
    },
  };

  const currentTier = rankInfo.tier;
  const config = tierConfigs[currentTier] || tierConfigs.Rookie;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className={`relative w-full max-w-sm rounded-2xl border ${config.border} bg-gradient-to-b ${config.bg} p-6 text-white overflow-hidden ${config.shadow}`}
        style={{ animation: 'profileCardShow 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        {/* Glow effect in background */}
        <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-10 ${config.glowDot}`} />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors z-10"
        >
          <X size={15} />
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={36} className="animate-spin text-indigo-500" />
            <p className="text-xs text-zinc-500 font-medium">Memuat profil...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center mt-2">
            {/* Profile Picture */}
            <div className="relative group mb-4">
              {/* Glowing ring */}
              <div className={`absolute -inset-1.5 rounded-full bg-gradient-to-tr ${config.gradient} blur-[4px] opacity-40`} />
              
              <div className="relative w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-zinc-800 text-white font-bold text-3xl border-2 border-zinc-950 shadow-lg shrink-0">
                {displayAvatar ? (
                  <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </div>

            {/* Username */}
            <h4 className="font-extrabold text-xl tracking-tight text-white mb-1.5">
              {displayName}
            </h4>

            {/* Rank Badge Tag */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-4 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${config.glowDot}`} />
              <span className={`text-[10px] font-black tracking-widest bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>
                {config.label}
              </span>
            </div>

            {/* Tabs (Swapped positions: Riwayat Season on Left, Season Aktif on Right) */}
            <div className="flex w-full gap-1 p-0.5 bg-zinc-950/60 border border-white/5 rounded-xl mb-4 shrink-0">
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold tracking-widest uppercase transition-all ${
                  activeTab === 'history'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Riwayat Season
              </button>
              <button
                onClick={() => setActiveTab('current')}
                className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold tracking-widest uppercase transition-all ${
                  activeTab === 'current'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Season Aktif
              </button>
            </div>

            {activeTab === 'current' ? (
              /* Stats Metrics Grid */
              <div className="w-full h-[205px] flex flex-col gap-3 mb-2">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Current XP */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                    <Award size={16} className={`${config.text} mb-1`} />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Poin Saat Ini</span>
                    <span className="font-black text-sm text-zinc-100 mt-0.5">{rankPoints} XP</span>
                    <span className={`text-[9px] font-black tracking-widest uppercase mt-0.5 ${config.text}`}>
                      {rankInfo.tier}
                    </span>
                  </div>
                  {/* Highest XP */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                    <Star size={16} className="text-yellow-400 mb-1" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rekor Tertinggi</span>
                    <span className="font-black text-sm text-zinc-100 mt-0.5">{highestPoints} XP</span>
                    <span className={`text-[9px] font-black tracking-widest uppercase mt-0.5 ${tierConfigs[highestRankInfo.tier]?.text || 'text-slate-300'}`}>
                      {highestRankInfo.tier}
                    </span>
                  </div>
                </div>

                {/* Detail Stats */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3.5 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <Play size={12} className="text-zinc-500" />
                      Matches Dimainkan
                    </span>
                    <span className="font-extrabold text-zinc-100">{totalMatches} Game</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <BarChart2 size={12} className="text-zinc-500" />
                      Total Soal Dijawab
                    </span>
                    <span className="font-extrabold text-zinc-100">{totalQuestions} Soal</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <Target size={12} className="text-zinc-500" />
                      Akurasi Jawaban
                    </span>
                    <span className={`font-extrabold ${
                      accuracy >= 80 ? 'text-emerald-400' : accuracy >= 50 ? 'text-indigo-400' : 'text-zinc-300'
                    }`}>{accuracy}%</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Previous Seasons History List (Scrollable, h-[205px]) */
              <div className="w-full h-[205px] overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 mb-2">
                {history.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-4 text-center">
                    <Shield size={20} className="text-zinc-600 mb-1.5" />
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Riwayat Kosong</p>
                    <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed max-w-[200px]">
                      Pemain ini belum memiliki catatan kompetisi pada season sebelumnya.
                    </p>
                  </div>
                ) : (
                  history.map((h) => {
                    const hConfig = tierConfigs[h.tier] || tierConfigs.Rookie;
                    const monthNames = [
                      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                    ];
                    // Format season label e.g., "2026-05" -> "Season Mei 2026"
                    let seasonLabel = h.season_id;
                    if (h.season_id && h.season_id.includes('-')) {
                      const [year, monthStr] = h.season_id.split('-');
                      const monthIdx = parseInt(monthStr) - 1;
                      if (monthIdx >= 0 && monthIdx < 12) {
                        seasonLabel = `Season ${monthNames[monthIdx]} ${year}`;
                      }
                    }
                    return (
                      <div key={h.id || h.season_id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between transition-colors hover:bg-white/[0.04] shrink-0">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{seasonLabel}</div>
                          <div className={`text-xs font-black bg-gradient-to-r ${hConfig.gradient} bg-clip-text text-transparent mt-0.5`}>
                            {h.tier}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-zinc-100">{h.rank_points} XP</div>
                          <div className="text-[9px] text-zinc-500 font-medium mt-0.5">
                            {h.total_matches} Match • {h.accuracy}% Acc
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            
            <div className="w-full mt-4 border-t border-white/5 pt-4 flex flex-col gap-2 justify-center items-center">
              {actionButton}
              
              {friendStatus !== 'self' && currentUserId && (
                <div className="flex justify-center w-full mt-1">
                  {friendStatus === 'loading' ? (
                    <button disabled className="w-full sm:w-auto px-6 py-2 bg-zinc-800/50 text-zinc-500 rounded-xl text-[10px] font-bold flex justify-center items-center cursor-not-allowed border border-white/5">
                      <Loader2 className="animate-spin mr-2" size={14} /> Memuat...
                    </button>
                  ) : friendStatus === 'none' ? (
                    <button onClick={handleAddFriend} className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-lg hover:shadow-indigo-500/25 border border-white/10 flex justify-center items-center gap-1.5">
                      Tambah Teman
                    </button>
                  ) : friendStatus === 'pending_sent' ? (
                    <button onClick={handleRemoveFriend} className="w-full sm:w-auto px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-bold transition-all border border-zinc-700 flex justify-center items-center">
                      Batalkan Permintaan
                    </button>
                  ) : friendStatus === 'pending_received' ? (
                    <button onClick={handleAcceptFriend} className="w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-lg hover:shadow-green-500/25 border border-white/10 flex justify-center items-center gap-1.5">
                      Terima Pertemanan
                    </button>
                  ) : friendStatus === 'accepted' ? (
                    <button onClick={handleRemoveFriend} className="w-full sm:w-auto px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-bold transition-all border border-red-500/20 flex justify-center items-center">
                      Hapus Pertemanan
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes profileCardShow {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
