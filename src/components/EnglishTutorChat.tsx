'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, X, Send, Loader2, Bot, User, Minimize2, Maximize2, Trash2, ChevronLeft, Plus, Menu } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface EnglishTutorChatProps {
  username?: string | null;
}

export default function EnglishTutorChat({ username }: EnglishTutorChatProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // State for sessions and active session
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Custom notification state
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [lastDeletedSession, setLastDeletedSession] = useState<ChatSession | null>(null);

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

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification({ message, type });
  };

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // 5 seconds is perfect to read and click Undo
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle mobile back button to close chat
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ chatOpen: true }, '');

    const handlePopState = () => {
      setIsOpen(false);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.chatOpen) {
        window.history.back();
      }
    };
  }, [isOpen]);

  // Monitor Auth Session
  useEffect(() => {
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
        if (session?.user && mounted) {
          setSessionUser(session.user);
        }
        await fetchProfile(session?.user?.id);
      } catch (err) {
        if (mounted) setLocalUsername(null);
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        if (mounted) setSessionUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        if (mounted) {
          setSessionUser(null);
          setLocalUsername(null);
          setSessions([]);
          setActiveSessionId(null);
          setIsSidebarOpen(false);
          // Reset to default welcome message
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              text: 'Halo! Saya **Atlas**, tutor bahasa Inggris Anda. 👋\n\nSaya siap membantu Anda memahami grammar, kosa kata, dan tata bahasa Inggris. Silakan tanyakan apa saja!',
              timestamp: new Date(),
            },
          ]);
        }
      }
    });

    return () => {
      mounted = false;
      try { authListener.subscription.unsubscribe(); } catch (e) { /* ignore */ }
    };
  }, [username]);

  // Load chat sessions from localStorage when user changes
  useEffect(() => {
    if (!sessionUser) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }

    const saved = localStorage.getItem(`chats_${sessionUser.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const parsedWithDates = parsed.map((s: any) => ({
          ...s,
          messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
        setSessions(parsedWithDates);
        if (parsedWithDates.length > 0) {
          setActiveSessionId(parsedWithDates[0].id);
          setMessages(parsedWithDates[0].messages);
        }
      } catch (e) {
        console.error('Failed to parse saved chats:', e);
      }
    } else {
      // Create a default initial session for the logged in user
      const initialId = `session-${Date.now()}`;
      const defaultWelcome = {
        id: 'welcome',
        role: 'assistant' as const,
        text: 'Halo! Saya **Atlas**, tutor bahasa Inggris Anda. 👋\n\nSaya siap membantu Anda memahami grammar, kosa kata, dan tata bahasa Inggris. Silakan tanyakan apa saja!',
        timestamp: new Date(),
      };
      const initialSession: ChatSession = {
        id: initialId,
        title: 'Sesi Belajar Pertama',
        messages: [defaultWelcome],
        createdAt: new Date().toISOString()
      };
      setSessions([initialSession]);
      setActiveSessionId(initialId);
      setMessages([defaultWelcome]);
    }
  }, [sessionUser]);

  // Save active session messages back to sessions list & localStorage
  useEffect(() => {
    if (!sessionUser || !activeSessionId) return;

    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === activeSessionId) {
          // Auto-generate title from the first user question if the title is still default
          let title = s.title;
          if (s.title.startsWith('Sesi Belajar') || s.title.startsWith('Chat Baru')) {
            const firstUserMessage = messages.find(m => m.role === 'user');
            if (firstUserMessage) {
              title = firstUserMessage.text.length > 22 
                ? firstUserMessage.text.substring(0, 20) + '...'
                : firstUserMessage.text;
            }
          }
          return { ...s, title, messages };
        }
        return s;
      });

      localStorage.setItem(`chats_${sessionUser.id}`, JSON.stringify(updated));
      return updated;
    });
  }, [messages, activeSessionId, sessionUser]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized && !isSidebarOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, isSidebarOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !isMinimized && !isSidebarOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized, isSidebarOpen]);

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
    showToast('Obrolan saat ini telah direset', 'success');
  };

  // Start new chat session
  const startNewChat = () => {
    if (!sessionUser) {
      showToast('Silakan login terlebih dahulu untuk membuat chat baru!', 'error');
      return;
    }
    const newId = `session-${Date.now()}`;
    const defaultWelcome = {
      id: 'welcome',
      role: 'assistant' as const,
      text: 'Sesi chat baru dimulai! Tulis apa saja untuk memulai belajar bahasa Inggris. 🚀',
      timestamp: new Date(),
    };
    const newSession: ChatSession = {
      id: newId,
      title: `Chat Baru ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      messages: [defaultWelcome],
      createdAt: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([defaultWelcome]);
    setIsSidebarOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setIsSidebarOpen(false);
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionUser) return;
    
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    if (!sessionToDelete) return;

    setLastDeletedSession(sessionToDelete);

    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem(`chats_${sessionUser.id}`, JSON.stringify(updated));

    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
        setMessages(updated[0].messages);
      } else {
        // Create a default session
        const initialId = `session-${Date.now()}`;
        const defaultWelcome = {
          id: 'welcome',
          role: 'assistant' as const,
          text: 'Halo! Saya **Atlas**, tutor bahasa Inggris Anda. 👋\n\nSaya siap membantu Anda memahami grammar, kosa kata, dan tata bahasa Inggris. Silakan tanyakan apa saja!',
          timestamp: new Date(),
        };
        const initialSession: ChatSession = {
          id: initialId,
          title: 'Sesi Belajar',
          messages: [defaultWelcome],
          createdAt: new Date().toISOString()
        };
        setSessions([initialSession]);
        setActiveSessionId(initialId);
        setMessages([defaultWelcome]);
      }
    }

    // Show undo toast instead of blocking dialog
    showToast('Sesi chat berhasil dihapus', 'info');
  };

  const handleUndoDelete = () => {
    if (!sessionUser || !lastDeletedSession) return;
    
    setSessions(prev => {
      const restored = [lastDeletedSession, ...prev];
      localStorage.setItem(`chats_${sessionUser.id}`, JSON.stringify(restored));
      return restored;
    });
    setActiveSessionId(lastDeletedSession.id);
    setMessages(lastDeletedSession.messages);
    setLastDeletedSession(null);
    setNotification(null);
  };

  // Click handler with login warning
  const handleHistoryClick = () => {
    if (!sessionUser) {
      showToast('Silakan login terlebih dahulu untuk melihat riwayat chat!', 'error');
      return;
    }
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNewChatClick = () => {
    if (!sessionUser) {
      showToast('Silakan login terlebih dahulu untuk membuka halaman chat baru!', 'error');
      return;
    }
    startNewChat();
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
          className={`fixed z-[9999] inset-0 md:inset-auto md:right-6 md:bottom-24 w-full h-full max-h-screen md:w-[420px] md:h-[650px] md:max-h-[85vh] shadow-2xl md:rounded-2xl border-0 md:border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 ease-out ${
            isMinimized ? 'h-14 md:h-14 w-full md:w-[420px] inset-x-0 bottom-0 top-auto' : ''
          }`}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shrink-0 shadow-sm relative">
            <div className="flex items-center gap-1 min-w-0">
              {/* Back Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 transition-colors mr-0.5 shrink-0"
                title="Tutup Chat"
              >
                <ChevronLeft size={22} className="text-white" />
              </button>
              
              {/* Menu/Sidebar Trigger */}
              <button
                onClick={handleHistoryClick}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0"
                title="Buka Menu Riwayat"
              >
                <Menu size={18} className="text-white" />
              </button>

              <div className="flex items-center gap-2 min-w-0 ml-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="truncate">
                  <div className="font-extrabold text-sm leading-tight truncate">Atlas Tutor</div>
                  <div className="text-indigo-200 text-[10px] truncate">English Grammar AI</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Quick New Chat Button */}
              <button
                onClick={handleNewChatClick}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Chat Baru"
              >
                <Plus size={16} />
              </button>
              {/* Reset current chat */}
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Reset Chat"
              >
                <Trash2 size={15} />
              </button>

            </div>
          </div>

          {/* Custom Notification Toast (Simple and non-intrusive on top) */}
          {notification && !isMinimized && (
            <div 
              className="absolute top-14 inset-x-4 mx-auto z-[10000] w-auto max-w-[320px] bg-white/95 border border-slate-200/80 backdrop-blur shadow-lg text-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs transition-all duration-300"
              style={{
                animation: 'slideDownFade 0.2s ease-out',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">
                  {notification.type === 'error' ? '⚠️' : notification.type === 'success' ? '✅' : 'ℹ️'}
                </span>
                <span className="truncate pr-2 font-medium">{notification.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {notification.message.includes('dihapus') && lastDeletedSession && (
                  <button 
                    onClick={handleUndoDelete}
                    className="text-indigo-600 hover:text-indigo-800 font-extrabold select-none hover:underline"
                  >
                    Urungkan
                  </button>
                )}
                <button 
                  onClick={() => setNotification(null)}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Sidebar Drawer (Gemini/ChatGPT Light style) */}
          <div 
            className={`absolute inset-y-0 left-0 z-50 w-[240px] bg-white text-slate-700 border-r border-slate-200/80 flex flex-col transition-transform duration-300 transform ${
              isSidebarOpen && !isMinimized ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {/* Sidebar Header */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-indigo-600 animate-pulse" />
                <span className="text-xs font-black tracking-widest text-slate-800">ATLAS HISTORY</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Sidebar New Chat Button */}
            <div className="p-3 shrink-0">
              <button
                onClick={handleNewChatClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-indigo-50/30 hover:border-indigo-200 hover:text-indigo-700 transition-all transform active:scale-95 shadow-sm"
              >
                <Plus size={14} className="text-indigo-600" />
                Sesi Chat Baru
              </button>
            </div>

            {/* Sidebar Chat List */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-thin">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1">
                Obrolan Sebelumnya
              </div>
              {sessions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[11px] text-slate-400 italic">Belum ada riwayat.</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => loadSession(s)}
                      className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-100/50 shadow-sm shadow-indigo-100/10' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs shrink-0 opacity-75">💬</span>
                        <span className="truncate pr-1">{s.title}</span>
                      </div>
                      <button
                        onClick={(e) => deleteSession(s.id, e)}
                        className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-slate-400 hover:text-slate-600 transition-colors shrink-0 ml-1.5"
                        title="Hapus riwayat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Bottom Profile/Info */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 text-center">
              <p className="text-[10px] text-slate-500 truncate">{sessionUser ? sessionUser.email : 'Tamu (Guest)'}</p>
            </div>
          </div>

          {/* Sidebar Backdrop Overlay */}
          {isSidebarOpen && !isMinimized && (
            <div 
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
            />
          )}

          {/* Messages Area */}
          {!isMinimized && !isSidebarOpen && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                    >
                      {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs md:text-sm leading-relaxed ${msg.role === 'user'
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
                    className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm text-slate-800 placeholder-slate-400 resize-none max-h-28 leading-relaxed disabled:opacity-50"
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
        className={`fixed z-20 right-4 bottom-4 md:right-6 md:bottom-6 h-10 sm:h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${isOpen
            ? 'bg-slate-700 hover:bg-slate-800 rotate-0 w-10 sm:w-14 hidden md:flex'
            : 'bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 px-3 sm:px-5 gap-1.5 sm:gap-2 flex'
          }`}
        title={isOpen ? 'Tutup Atlas AI' : 'Buka Atlas AI'}
        aria-label="Atlas AI Chat"
      >
        {isOpen ? (
          <X size={16} className="text-white sm:w-[20px] sm:h-[20px]" />
        ) : (
          <>
            <MessageCircle size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
            <span className="text-white font-black text-xs sm:hidden tracking-wider select-none">AI</span>
            <span className="hidden sm:inline-block text-white font-bold text-sm select-none">Tanya AI</span>
          </>
        )}


        {/* Pulse ring */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-25 pointer-events-none" />
        )}
      </button>

      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
