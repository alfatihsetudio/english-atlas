'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRankInfo } from '@/utils/rankSystem';
import { Trophy, Medal, Search, User as UserIcon, Settings } from 'lucide-react';
import UserProfileModal from './UserProfileModal';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  rank_points: number;
}

export default function Leaderboard() {
  const [filter, setFilter] = useState<'10' | '50' | '100'>('10');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      const limit = parseInt(filter);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, rank_points')
        .gt('rank_points', 0)
        .order('rank_points', { ascending: false })
        .limit(limit);

      let fetchedPlayers: PlayerProfile[] = data || [];

      setPlayers(fetchedPlayers);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [filter]);

  return (
    <div className="flex flex-col h-full flex-1 w-full min-h-0 relative">
      {/* Header & Tabs */}
      <div className="p-3 sm:p-6 border-b border-zinc-800 flex flex-row items-center justify-between gap-2">
        <h3 className="font-bold text-sm sm:text-lg text-white flex items-center gap-1.5 shrink-0">
          <Trophy className="text-zinc-400" size={16} />
          <span className="hidden xs:inline">Global </span>Leaderboard
        </h3>
        
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5 p-0.5 bg-zinc-950 rounded-full border border-zinc-800">
            {(['10', '50', '100'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-full text-[9px] sm:text-xs font-bold transition-all ${
                  filter === tab
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Top {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto h-0 w-full custom-scrollbar bg-transparent -webkit-overflow-scrolling-touch">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full"></div>
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Trophy className="opacity-20 mb-3" size={36} />
            <p className="text-xs font-bold uppercase tracking-wider">Belum ada data peringkat</p>
            <p className="text-[10px] text-zinc-600 mt-1">Mulai mainkan Mode Ranked untuk masuk ke papan skor!</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {players.map((player, index) => {
              const rankInfo = getRankInfo(player.rank_points);
              const rankPos = index + 1;
              const isCurrentUser = player.id === currentUserId;
              
              let rowStyle = "border-b border-zinc-800/50 hover:bg-zinc-800/20";
              let numberContent = <span className="text-zinc-500 font-bold text-sm sm:text-base">{rankPos}</span>;
              
              if (rankPos === 1) {
                rowStyle = isCurrentUser
                  ? "bg-amber-500/25 border-b border-amber-500/40 hover:bg-amber-500/35 border-l-4 border-l-amber-400 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)]"
                  : "bg-amber-500/15 border-b border-amber-500/30 hover:bg-amber-500/25";
                numberContent = (
                  <div className="flex flex-col items-center">
                    <Trophy size={14} className="text-amber-300 mb-0.5 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                    <span className="text-amber-300 font-black text-lg sm:text-xl leading-none drop-shadow-[0_0_4px_rgba(245,158,11,0.3)]">1</span>
                  </div>
                );
              } else if (rankPos === 2) {
                rowStyle = isCurrentUser
                  ? "bg-slate-400/30 border-b border-slate-400/45 hover:bg-slate-400/45 border-l-4 border-l-slate-200 shadow-[inset_0_0_12px_rgba(148,163,184,0.15)]"
                  : "bg-slate-400/20 border-b border-slate-400/30 hover:bg-slate-400/30";
                numberContent = (
                  <div className="flex flex-col items-center">
                    <Medal size={14} className="text-slate-100 mb-0.5 drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
                    <span className="text-slate-100 font-black text-base sm:text-lg leading-none drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">2</span>
                  </div>
                );
              } else if (rankPos === 3) {
                rowStyle = isCurrentUser
                  ? "bg-orange-500/25 border-b border-orange-500/40 hover:bg-orange-500/35 border-l-4 border-l-orange-400 shadow-[inset_0_0_12px_rgba(249,115,22,0.15)]"
                  : "bg-orange-500/15 border-b border-orange-500/30 hover:bg-orange-500/25";
                numberContent = (
                  <div className="flex flex-col items-center">
                    <Medal size={14} className="text-orange-300 mb-0.5 drop-shadow-[0_0_4px_rgba(249,115,22,0.5)]" />
                    <span className="text-orange-300 font-black text-base sm:text-lg leading-none drop-shadow-[0_0_4px_rgba(249,115,22,0.3)]">3</span>
                  </div>
                );
              } else {
                if (isCurrentUser) {
                  rowStyle = "bg-indigo-950/30 border-b border-indigo-900/40 hover:bg-indigo-950/50 border-l-4 border-l-indigo-500 shadow-[inset_0_0_12px_rgba(99,102,241,0.15)]";
                }
              }

              return (
                <div 
                  key={player.id} 
                  onClick={() => setSelectedProfileId(player.id)}
                  className={`flex items-center justify-between py-3 px-4 sm:py-4 sm:px-6 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all ${rowStyle}`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-6 sm:w-8 flex justify-center items-center">
                      {numberContent}
                    </div>
                    
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {player.avatar_url ? (
                        <img src={player.avatar_url} alt={player.username} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-zinc-700 object-cover" />
                      ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                          <UserIcon size={15} />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                          {player.username || 'Unknown'}
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-500 text-white shrink-0">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-xs font-medium text-zinc-500 mt-0.5">{rankInfo.tier}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-black text-xs sm:text-sm text-white">{player.rank_points}</div>
                    <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">XP</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedProfileId && (
        <UserProfileModal 
          userId={selectedProfileId} 
          onClose={() => setSelectedProfileId(null)} 
        />
      )}
    </div>
  );
}
