'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRankInfo } from '@/utils/rankSystem';
import { Trophy, Medal, Search, User as UserIcon, Settings } from 'lucide-react';

interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  rank_points: number;
}

export default function Leaderboard() {
  const [filter, setFilter] = useState<'100' | '500' | '1000'>('100');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      const limit = parseInt(filter);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, rank_points')
        .order('rank_points', { ascending: false })
        .limit(limit);

      let fetchedPlayers: PlayerProfile[] = data || [];

      // If we don't have enough data (less than 3), let's append dummy data for UI testing
      if (fetchedPlayers.length < 3) {
        const dummyPlayers: PlayerProfile[] = [
          { id: 'd1', username: 'AtlasChampion', avatar_url: null, rank_points: 6200 },
          { id: 'd2', username: 'GrammarMaster', avatar_url: null, rank_points: 4100 },
          { id: 'd3', username: 'EnglishPro', avatar_url: null, rank_points: 3050 },
          { id: 'd4', username: 'NewbieLearner', avatar_url: null, rank_points: 800 },
        ];
        
        const existingIds = new Set(fetchedPlayers.map(p => p.id));
        for (const dp of dummyPlayers) {
          if (!existingIds.has(dp.id)) {
            fetchedPlayers.push(dp);
          }
        }
        
        // Re-sort after adding dummy
        fetchedPlayers.sort((a, b) => b.rank_points - a.rank_points);
      }

      setPlayers(fetchedPlayers.slice(0, limit));
      setLoading(false);
    }

    fetchLeaderboard();
  }, [filter]);

  return (
    <div className="flex flex-col flex-1 w-full min-h-0">
      {/* Header & Tabs */}
      <div className="p-3 sm:p-6 border-b border-zinc-800 flex flex-row items-center justify-between gap-2">
        <h3 className="font-bold text-sm sm:text-lg text-white flex items-center gap-1.5 shrink-0">
          <Trophy className="text-zinc-400" size={16} />
          <span className="hidden xs:inline">Global </span>Leaderboard
        </h3>
        
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5 p-0.5 bg-zinc-950 rounded-full border border-zinc-800">
            {(['100', '500', '1000'] as const).map((tab) => (
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
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="flex flex-col">
            {players.map((player, index) => {
              const rankInfo = getRankInfo(player.rank_points);
              const rankPos = index + 1;
              
              let rowStyle = "border-b border-zinc-800/50 hover:bg-zinc-800/20";
              let numberContent = <span className="text-zinc-500 font-bold text-sm sm:text-base">{rankPos}</span>;
              
              if (rankPos === 1) {
                rowStyle = "bg-zinc-800/50 border-b border-zinc-700/50";
                numberContent = (
                  <div className="flex flex-col items-center">
                    <Trophy size={12} className="text-white mb-0.5" />
                    <span className="text-white font-black text-lg sm:text-xl leading-none">1</span>
                  </div>
                );
              } else if (rankPos === 2 || rankPos === 3) {
                rowStyle = "bg-transparent border-b border-zinc-800/50";
                numberContent = <span className="text-zinc-300 font-black text-base sm:text-lg">{rankPos}</span>;
              }

              return (
                <div key={player.id} className={`flex items-center justify-between py-3 px-4 sm:py-4 sm:px-6 transition-colors ${rowStyle}`}>
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
                        <div className="font-bold text-xs sm:text-sm text-white">{player.username || 'Unknown'}</div>
                        <div className="text-[10px] sm:text-xs font-medium text-zinc-500 mt-0.5">{rankInfo.tier}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-black text-xs sm:text-sm text-white">{player.rank_points}</div>
                    <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">PTS</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
