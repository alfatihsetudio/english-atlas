'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Users, MessageCircle, Check, X as XIcon, Send, UserIcon, Clock, ChevronDown, UserPlus, Trash2 } from 'lucide-react';
import { getRankInfo } from '@/utils/rankSystem';

interface FriendsSidebarProps {
  currentUserId: string;
  onlineUserIds: string[];
  activeBattleRoom?: { id: string; room_code: string; status: string } | null;
}

export default function FriendsSidebar({ currentUserId, onlineUserIds, activeBattleRoom }: FriendsSidebarProps) {
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Unread messages tracking
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`chat_last_read_${currentUserId}`);
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  const [latestMessages, setLatestMessages] = useState<Record<string, { sender_id: string; created_at: string }>>({});
  
  const router = useRouter();

  // Invite State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedInviteFriend, setSelectedInviteFriend] = useState<any | null>(null);
  const [invitePlayerCount, setInvitePlayerCount] = useState<number>(1);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Delete Friend Confirmation Modal State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [friendToDelete, setFriendToDelete] = useState<any | null>(null);

  const openInviteModal = (e: React.MouseEvent, friend: any) => {
    e.stopPropagation();
    setSelectedInviteFriend(friend);
    setInviteModalOpen(true);
  };

  const handleCreateRoomForInvite = async () => {
    if (!selectedInviteFriend || !currentUserId) return;
    setIsCreatingRoom(true);
    try {
      // === Jika sudah ada room aktif, cukup kirim invite ke room tersebut ===
      if (activeBattleRoom && activeBattleRoom.status === 'waiting') {
        const { error: inviteError } = await (supabase.from('battle_invites') as any)
          .insert({
            room_id: activeBattleRoom.id,
            sender_id: currentUserId,
            receiver_id: selectedInviteFriend.id,
            status: 'pending'
          });
        if (inviteError) throw inviteError;
        setInviteModalOpen(false);
        router.push(`/arena/battle/${activeBattleRoom.room_code}`);
        return;
      }

      // === Tidak ada room aktif: buat room baru seperti biasa ===
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      
      const { data: room, error: roomError } = await (supabase.from('battle_rooms') as any)
        .insert({
          host_id: currentUserId,
          room_code: code,
          question_count: 5,
          status: 'waiting',
          max_players: invitePlayerCount + 1
        })
        .select()
        .single();
        
      if (roomError) throw roomError;
      
      const { error: partError } = await (supabase.from('battle_participants') as any)
        .upsert({
          room_id: room.id,
          user_id: currentUserId,
          is_ready: false
        }, { onConflict: 'room_id,user_id' });
        
      if (partError) throw partError;
      
      const { error: inviteError } = await (supabase.from('battle_invites') as any)
        .insert({
          room_id: room.id,
          sender_id: currentUserId,
          receiver_id: selectedInviteFriend.id,
          status: 'pending'
        });
        
      if (inviteError) throw inviteError;
      
      setInviteModalOpen(false);
      router.push(`/arena/battle/${code}`);
      
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat room undangan: ' + err.message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleRemoveFriendClick = (e: React.MouseEvent, friend: any) => {
    e.stopPropagation();
    setFriendToDelete(friend);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteFriend = async () => {
    if (!friendToDelete) return;
    try {
      // 1. Hapus semua pesan chat antara kedua pengguna ini (dua arah)
      const { error: msgError1 } = await (supabase.from('friend_messages') as any)
        .delete()
        .eq('sender_id', currentUserId)
        .eq('receiver_id', friendToDelete.id);

      const { error: msgError2 } = await (supabase.from('friend_messages') as any)
        .delete()
        .eq('sender_id', friendToDelete.id)
        .eq('receiver_id', currentUserId);

      if (msgError1 || msgError2) {
        console.warn("Gagal menghapus riwayat chat (mungkin SQL policy belum dijalankan):", msgError1 || msgError2);
      }

      // 2. Hapus relasi pertemanan
      const { error } = await (supabase.from('friends') as any)
        .delete()
        .eq('id', friendToDelete.relation_id);
        
      if (error) {
        alert("Gagal menghapus pertemanan: " + error.message);
        return;
      }

      // 3. Tutup chat jika sedang aktif dengan teman yang dihapus
      if (activeChatUserId === friendToDelete.id) {
        setActiveChatUserId(null);
        setActiveChatUser(null);
      }

      setDeleteConfirmOpen(false);
      setFriendToDelete(null);
      
      // 4. Paksa refresh daftar teman secara lokal
      await fetchFriends();
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    }
  };

  useEffect(() => {
    fetchFriends();
    
    // Subscribe to friends table changes
    const friendSub = supabase
      .channel('friends_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, (payload) => {
        // RLS filters the realtime broadcast at the database level, 
        // so any payload received is guaranteed to be related to currentUserId.
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendSub);
    };
  }, [currentUserId]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      // Fetch friends where I am sender or receiver and status is accepted
      const { data: acceptedData } = await (supabase.from('friends') as any)
        .select(`
          id, sender_id, receiver_id, status,
          sender:profiles!friends_sender_id_fkey(id, username, avatar_url, rank_points, last_seen_atlas),
          receiver:profiles!friends_receiver_id_fkey(id, username, avatar_url, rank_points, last_seen_atlas)
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      // Fetch friend requests where I am the receiver
      const { data: requestsData } = await (supabase.from('friends') as any)
        .select(`
          id, sender_id, receiver_id, status,
          sender:profiles!friends_sender_id_fkey(id, username, avatar_url, rank_points)
        `)
        .eq('status', 'pending')
        .eq('receiver_id', currentUserId);

      if (acceptedData) {
        // Format friends list to only extract the "other" user
        const formattedFriends = acceptedData.map((f: any) => {
          const isSender = f.sender_id === currentUserId;
          const friendProfile = isSender ? f.receiver : f.sender;
          return {
            relation_id: f.id,
            ...friendProfile
          };
        });
        
        // Sort: online first, then by rank_points
        formattedFriends.sort((a: any, b: any) => {
          const aOnline = onlineUserIds.includes(a.id);
          const bOnline = onlineUserIds.includes(b.id);
          if (aOnline && !bOnline) return -1;
          if (!aOnline && bOnline) return 1;
          return (b.rank_points || 0) - (a.rank_points || 0);
        });
        
        setFriends(formattedFriends);

        // Close chat if active friend is removed from list
        if (activeChatUserId && !formattedFriends.some((f: any) => f.id === activeChatUserId)) {
          setActiveChatUserId(null);
          setActiveChatUser(null);
        }

        // Fetch latest messages for these friends to check for unread
        const { data: latestMsgs } = await (supabase.from('friend_messages') as any)
          .select('sender_id, receiver_id, created_at')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('created_at', { ascending: false });

        if (latestMsgs) {
          const latestMap: Record<string, { sender_id: string; created_at: string }> = {};
          latestMsgs.forEach((msg: any) => {
            const friendId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
            if (!latestMap[friendId]) {
              latestMap[friendId] = {
                sender_id: msg.sender_id,
                created_at: msg.created_at
              };
            }
          });
          setLatestMessages(latestMap);
        }
      }
      
      if (requestsData) {
        setFriendRequests(requestsData);
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (relationId: string) => {
    await (supabase.from('friends') as any).update({ status: 'accepted' }).eq('id', relationId);
  };

  const rejectRequest = async (relationId: string) => {
    await (supabase.from('friends') as any).delete().eq('id', relationId);
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Belum pernah online';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Kemarin';
    return `${diffDays} hari lalu`;
  };

  // ================= CHAT SYSTEM =================

  // Global message listener for unread badges
  useEffect(() => {
    if (!currentUserId) return;

    const globalMsgSub = supabase
      .channel('global_friend_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_messages',
      }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.receiver_id === currentUserId) {
          // Update latest message info
          setLatestMessages(prev => ({
            ...prev,
            [newMsg.sender_id]: {
              sender_id: newMsg.sender_id,
              created_at: newMsg.created_at
            }
          }));

          // If the chat with this user is open, mark as read immediately
          if (activeChatUserId === newMsg.sender_id) {
            const now = new Date().toISOString();
            setLastReadTimestamps(prev => {
              const updated = { ...prev, [newMsg.sender_id]: now };
              if (typeof window !== 'undefined') {
                localStorage.setItem(`chat_last_read_${currentUserId}`, JSON.stringify(updated));
              }
              return updated;
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(globalMsgSub);
    };
  }, [currentUserId, activeChatUserId]);

  useEffect(() => {
    if (!activeChatUserId) return;
    
    fetchMessages();

    // Mark as read immediately when chat opens
    const now = new Date().toISOString();
    setLastReadTimestamps(prev => {
      const updated = { ...prev, [activeChatUserId]: now };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`chat_last_read_${currentUserId}`, JSON.stringify(updated));
      }
      return updated;
    });
    
    const msgSub = supabase
      .channel(`chat_${currentUserId}_${activeChatUserId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'friend_messages',
      }, (payload) => {
        const newMsg = payload.new as any;
        if (
          (newMsg.sender_id === currentUserId && newMsg.receiver_id === activeChatUserId) ||
          (newMsg.sender_id === activeChatUserId && newMsg.receiver_id === currentUserId)
        ) {
          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();

          // Mark as read if the chat is open
          const nowMsg = new Date().toISOString();
          setLastReadTimestamps(prev => {
            const updated = { ...prev, [activeChatUserId]: nowMsg };
            if (typeof window !== 'undefined') {
              localStorage.setItem(`chat_last_read_${currentUserId}`, JSON.stringify(updated));
            }
            return updated;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
    };
  }, [activeChatUserId]);

  const fetchMessages = async () => {
    if (!activeChatUserId) return;
    
    // Calculate 7 days ago to only fetch recent messages (temporary chat)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateFilter = sevenDaysAgo.toISOString();

    const { data } = await (supabase.from('friend_messages') as any)
      .select('*')
      .gte('created_at', dateFilter)
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${activeChatUserId}),and(sender_id.eq.${activeChatUserId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });
      
    if (data) {
      setMessages(data);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatUserId) return;
    
    const msgText = newMessage.trim();
    setNewMessage('');
    
    // Optimistic UI update could go here, but let's just wait for realtime to bounce back
    await (supabase.from('friend_messages') as any).insert({
      sender_id: currentUserId,
      receiver_id: activeChatUserId,
      content: msgText
    });
  };

  const openChat = (friend: any) => {
    setActiveChatUser(friend);
    setActiveChatUserId(friend.id);
    
    // Mark as read
    const now = new Date().toISOString();
    setLastReadTimestamps(prev => {
      const updated = { ...prev, [friend.id]: now };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`chat_last_read_${currentUserId}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl overflow-hidden relative shadow-2xl">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-zinc-800/60 flex items-center justify-between shrink-0 bg-zinc-950/20">
        <div className="flex items-center gap-2">
          <Users className="text-indigo-400" size={16} />
          <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">Daftar Teman</h2>
        </div>
        <div className="text-[10px] font-bold text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
          {friends.length}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3 relative">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Friend Requests Section */}
            {friendRequests.length > 0 && (
              <div className="mb-4 bg-zinc-950/40 rounded-xl p-2 border border-indigo-500/20">
                <div className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest mb-2 px-1">
                  Permintaan Masuk ({friendRequests.length})
                </div>
                <div className="space-y-2">
                  {friendRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                          {req.sender?.avatar_url ? (
                            <img src={req.sender.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-[8px]">👤</div>
                          )}
                        </div>
                        <div className="truncate text-[10px] font-bold text-zinc-200">
                          {req.sender?.username}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => acceptRequest(req.id)} className="p-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-colors">
                          <Check size={12} />
                        </button>
                        <button onClick={() => rejectRequest(req.id)} className="p-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors">
                          <XIcon size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends List Section */}
            <div>
              {friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-center px-4">
                  <Users className="opacity-20 mb-3" size={32} />
                  <p className="text-[11px] font-bold">Belum ada teman</p>
                  <p className="text-[9px] mt-1 opacity-70 leading-relaxed">Cari pemain di kolom pencarian atau klik nama mereka saat bertanding.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {friends.map(friend => {
                    const isOnline = onlineUserIds.includes(friend.id);
                    const rankInfo = getRankInfo(friend.rank_points || 0);
                    
                    const latestMsg = latestMessages[friend.id];
                    const lastRead = lastReadTimestamps[friend.id];
                    const hasUnread = latestMsg && 
                      latestMsg.sender_id !== currentUserId && 
                      (!lastRead || new Date(latestMsg.created_at) > new Date(lastRead));
                    
                    return (
                      <div 
                        key={friend.id} 
                        className="group flex items-center justify-between p-2 sm:p-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-800/80 cursor-pointer"
                        onClick={() => openChat(friend)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">👤</div>
                              )}
                            </div>
                            {/* Online Indicator */}
                            {isOnline && (
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                            )}
                          </div>
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white truncate max-w-[80px] sm:max-w-[100px]">{friend.username}</span>
                            </div>
                            <div className="text-[9px] text-zinc-500 truncate flex items-center gap-1">
                              <span>{rankInfo.tier}</span>
                              <span>•</span>
                              {isOnline ? (
                                <span className="text-green-500 font-medium">Sedang Online</span>
                              ) : (
                                <span>{formatLastSeen(friend.last_seen_atlas)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="shrink-0 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => openInviteModal(e, friend)}
                            className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                            title="Undang ke Room"
                          >
                            <UserPlus size={14} />
                          </button>
                          <button 
                            className="p-1.5 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors relative"
                            title="Kirim Pesan"
                          >
                            <MessageCircle size={14} />
                            {hasUnread && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                            )}
                          </button>
                          <button 
                            onClick={(e) => handleRemoveFriendClick(e, friend)}
                            className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                            title="Hapus Pertemanan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>

      {/* Floating Chat Modal (Inside Sidebar, Absolute position) */}
      {activeChatUserId && activeChatUser && (
        <div className="absolute inset-0 bg-zinc-950 z-10 flex flex-col animate-in slide-in-from-right-4 duration-200">
          {/* Chat Header */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                {activeChatUser.avatar_url ? (
                  <img src={activeChatUser.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">👤</div>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{activeChatUser.username}</div>
                <div className="text-[9px] text-zinc-500">Chat akan terhapus otomatis setelah 7 hari</div>
              </div>
            </div>
            <button 
              onClick={() => setActiveChatUserId(null)}
              className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          
          {/* Chat Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-zinc-950/50 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 opacity-50">
                <MessageCircle size={32} className="mb-2" />
                <p className="text-[10px]">Mulai obrolan baru</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-200 rounded-bl-sm border border-zinc-700/50'}`}>
                      {msg.content}
                    </div>
                    <div className="text-[8px] text-zinc-600 font-mono mt-1 px-1">
                      {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Chat Input */}
          <div className="p-3 bg-zinc-900 border-t border-zinc-800">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ketik pesan..."
                className="flex-1 bg-zinc-950 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-colors shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && selectedInviteFriend && (
        <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-[290px] sm:max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3 sm:p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
              <h3 className="font-bold text-white text-xs sm:text-sm">Undang ke Room</h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-zinc-500 hover:text-white"><XIcon size={14}/></button>
            </div>
            
            <div className="p-4 sm:p-5 flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0">
                   {selectedInviteFriend.avatar_url ? <img src={selectedInviteFriend.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs">👤</div>}
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-xs text-zinc-400">Mengundang:</div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate">{selectedInviteFriend.username}</div>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center py-1 sm:py-2">
                <label className="text-[9px] sm:text-[10px] font-black text-zinc-500 mb-2 sm:mb-3 uppercase tracking-widest">Jumlah Lawan (1 - 30)</label>
                <div className="flex items-center gap-3 sm:gap-4 justify-center">
                  <button
                    type="button"
                    onClick={() => setInvitePlayerCount(prev => Math.max(1, prev - 1))}
                    disabled={invitePlayerCount <= 1}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-bold flex items-center justify-center transition-colors text-sm sm:text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={invitePlayerCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setInvitePlayerCount(Math.min(30, Math.max(1, val)));
                      } else {
                        setInvitePlayerCount(0);
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val) || val < 1) {
                        setInvitePlayerCount(1);
                      }
                    }}
                    className="w-12 h-10 sm:w-16 sm:h-12 bg-zinc-950 border border-zinc-800 rounded-xl text-center text-white font-extrabold text-sm sm:text-lg focus:outline-none focus:border-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setInvitePlayerCount(prev => Math.min(30, prev + 1))}
                    disabled={invitePlayerCount >= 30}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-bold flex items-center justify-center transition-colors text-sm sm:text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
              <button
                onClick={handleCreateRoomForInvite}
                disabled={isCreatingRoom}
                className="w-full py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isCreatingRoom ? 'Membuat Room...' : 'Buat Room & Undang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Friend Confirmation Modal */}
      {deleteConfirmOpen && friendToDelete && (
        <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-[280px] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-zinc-800/60 bg-zinc-950/20 text-center">
              <h3 className="font-extrabold text-white text-xs uppercase tracking-widest text-red-500">Hapus Pertemanan</h3>
            </div>
            
            <div className="p-4 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-red-500/30">
                {friendToDelete.avatar_url ? (
                  <img src={friendToDelete.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-sm">👤</div>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Apakah Anda yakin ingin menghapus pertemanan dengan <span className="font-bold text-white">{friendToDelete.username}</span>?
              </p>
            </div>
            
            <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setFriendToDelete(null);
                }}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold rounded-xl transition-colors border border-zinc-700/50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteFriend}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-xl transition-colors shadow-lg shadow-red-600/10"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
