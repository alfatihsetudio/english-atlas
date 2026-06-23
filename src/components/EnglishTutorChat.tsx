'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2, Maximize2, Trash2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface EnglishTutorChatProps {
  username?: string | null;
}

export default function EnglishTutorChat({ username }: EnglishTutorChatProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Halo! Saya **Atlas**, tutor bahasa Inggris Anda. 👋\n\nSaya siap membantu Anda memahami grammar, kosa kata, dan tata bahasa Inggris. Silakan tanyakan apa saja!',
      timestamp: new Date(),
    },
  ]);

  // Local username: prefer prop, otherwise fetch from Supabase profile
  const [localUsername, setLocalUsername] = useState<string | null>(username ?? null);

  useEffect(() => {
    // If parent passes username prop, prefer it and keep in sync.
    if (username) {
      setLocalUsername(username);
      return;
    }

    let mounted = true;

    const fetchProfile = async (userId?: string) => {
      if (!userId) {
        if (mounted) setLocalUsername(null);
        return;
      }
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single() as any;
        if (mounted) setLocalUsername(profile?.username ?? null);
      } catch (err) {
        if (mounted) setLocalUsername(null);
      }
    };

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetchProfile(session?.user?.id);
      } catch (err) {
        if (mounted) setLocalUsername(null);
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await fetchProfile(session?.user?.id);
    });

    return () => {
      mounted = false;
      try { authListener.subscription.unsubscribe(); } catch (e) { /* ignore */ }
    };
  }, [username]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build history for context (exclude welcome message, max last 10 exchanges)
      const chatHistory = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: trimmed, 
            history: chatHistory,
            username: localUsername || 'Siswa'
          }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menghubungi AI.');
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        text: `❌ Maaf, terjadi kesalahan: ${err.message || 'Error tidak diketahui'}. Silakan coba lagi.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Chat telah direset. Saya siap membantu Anda kembali! 😊',
        timestamp: new Date(),
      },
    ]);
  };

  // Format text with basic markdown-like bold support
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  const hasUnread = !isOpen && messages.length > 1;

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className={`fixed z-[9999] right-4 bottom-20 md:right-6 md:bottom-24 w-[calc(100vw-2rem)] max-w-sm shadow-2xl rounded-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 ease-out ${
            isMinimized ? 'h-14' : 'h-[480px] md:h-[520px]'
          }`}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Atlas Tutor</div>
                <div className="text-indigo-200 text-[10px]">English Grammar AI</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Reset Chat"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Tutup"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-tl-sm'
                      }`}
                    >
                      {formatText(msg.text)}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <Bot size={13} className="text-slate-500" />
                    </div>
                    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-slate-100 bg-white shrink-0">
                <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tanya seputar grammar, kosa kata..."
                    rows={1}
                    disabled={isLoading}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400 resize-none max-h-28 leading-relaxed disabled:opacity-50"
                    style={{ minHeight: '24px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg flex items-center justify-center transition-all shrink-0 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                  Enter untuk kirim · Shift+Enter untuk baris baru
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className={`fixed z-[9999] right-4 bottom-4 md:right-6 md:bottom-6 h-14 rounded-full shadow-xl flex items-center justify-center gap-2 px-3 transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800 rotate-0'
            : 'bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800'
        }`}
        title={isOpen ? 'Tutup Atlas AI' : 'Buka Atlas AI'}
        aria-label="Atlas AI Chat"
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}

        <span className="hidden md:inline-block text-white font-semibold select-none">Atlas AI</span>

        {/* Unread badge */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            !
          </span>
        )}

        {/* Pulse ring */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-25 pointer-events-none" />
        )}
      </button>
    </>
  );
}
