'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Send, ChevronDown } from 'lucide-react';

interface BattleChatProps {
  roomCode: string;
  currentUser: {
    id: string;
    username: string;
    avatar_url: string;
  } | null;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar_url: string;
  text: string;
  timestamp: number;
}

export default function BattleChat({ roomCode, currentUser }: BattleChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`battle_chat_${roomCode}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Persist messages to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && roomCode) {
      sessionStorage.setItem(`battle_chat_${roomCode}`, JSON.stringify(messages));
    }
  }, [messages, roomCode]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (!roomCode) return;

    // Use Broadcast feature in Supabase Realtime
    const channelName = `room_chat_${roomCode}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMessage = payload.payload as ChatMessage;
        setMessages((prev) => [...prev, newMessage]);

        if (!isOpen) {
          setUnreadCount((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, isOpen]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim() || !currentUser || !channelRef.current) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      username: currentUser.username || 'Player',
      avatar_url: currentUser.avatar_url || '',
      text: inputValue.trim(),
      timestamp: Date.now()
    };

    // Optimistic update
    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');

    // Broadcast
    channelRef.current.send({
      type: 'broadcast',
      event: 'new_message',
      payload: newMessage
    });
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-[100] w-12 h-12 bg-zinc-100 text-zinc-950 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform"
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[100] w-[320px] max-w-[calc(100vw-2rem)] h-[400px] max-h-[calc(100vh-6rem)] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="w-full bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-100">Room Chat</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-zinc-700">
            {messages.length === 0 ? (
              <div className="m-auto text-xs text-zinc-600 font-bold uppercase tracking-widest text-center">
                Belum ada pesan.<br />Sapa lawanmu!
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.userId === currentUser?.id;
                const showAvatar = i === 0 || messages[i - 1].userId !== msg.userId;

                return (
                  <div key={msg.id} className={`flex gap-2 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {showAvatar ? (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                        {msg.avatar_url ? (
                          <img src={msg.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>
                        )}
                      </div>
                    ) : (
                      <div className="w-6 shrink-0" />
                    )}

                    <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {showAvatar && (
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5 px-1">
                          {isMe ? 'You' : msg.username}
                        </span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${isMe
                          ? 'bg-zinc-100 text-zinc-950 rounded-tr-sm'
                          : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                        }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ketik pesan..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-950 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all"
            >
              <Send size={14} />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
