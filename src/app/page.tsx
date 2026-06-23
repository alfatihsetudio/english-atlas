'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, Node as RfNode, Edge as RfEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { X, Languages, Sparkles, Loader2, ArrowRightLeft, ChevronDown, BookOpen, Clock, Info, Volume2, LogIn } from 'lucide-react';
import { Node as DbNode, Edge as DbEdge } from '@/types/database';
import CustomNode from '@/components/CustomNode';
import QuizPanel from '@/components/QuizPanel';
import AuthModal from '@/components/AuthModal';
import UsernameModal from '@/components/UsernameModal';
import UserMenu from '@/components/UserMenu';
import DictionarySearch from '@/components/DictionarySearch';
import { useRouter } from 'next/navigation';

import { useMemo } from 'react';

export default function HomeAtlas() {
  const router = useRouter();
  const POPULAR_LANGUAGES = [
    'Indonesia', 'Inggris', 'Spanyol', 'Prancis', 
    'Jerman', 'Jepang', 'Korea', 'Arab', 'Mandarin', 'Rusia', 'Hindi'
  ];

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const edgeTypes = useMemo(() => ({}), []);

  const [nodes, setNodes] = useState<RfNode[]>([]);
  const [edges, setEdges] = useState<RfEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  const [highlightedTitles, setHighlightedTitles] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [analyzeQuery, setAnalyzeQuery] = useState('');
  
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    formula?: string | null;
    example?: string | null;
    verbal_formula?: string | null;
    nominal_formula?: string | null;
    pos_form?: string | null;
    neg_form?: string | null;
    int_form?: string | null;
    time_signals?: string | null;
    usage_context?: string | null;
  } | null>(null);

  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Translation & Grammar check assistant states
  const [translateText, setTranslateText] = useState('');
  const [translateDirection, setTranslateDirection] = useState<'id-en' | 'en-id'>('id-en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<{ translation: string; grammar_feedback: string } | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Reset translation assistant on node change
  useEffect(() => {
    setTranslateText('');
    setTranslationResult(null);
    setTranslateError(null);
  }, [selectedNode?.id]);

  const handleTranslateAndCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!translateText.trim()) return;

    setIsTranslating(true);
    setTranslateError(null);
    setTranslationResult(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translateText, direction: translateDirection }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menerjemahkan teks.');
      }

      const data = await res.json();
      setTranslationResult({
        translation: data.translation || '',
        grammar_feedback: data.grammar_feedback || '',
      });

      const englishSentence = translateDirection === 'id-en' ? data.translation : translateText;
      if (englishSentence) {
        try {
          const resAnalyze = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: englishSentence }),
          });
          if (resAnalyze.ok) {
            const dataAnalyze = await resAnalyze.json();
            if (dataAnalyze.highlightedTitles) {
              const activePaths = [...new Set([...dataAnalyze.highlightedTitles, 'English Grammar', 'Time (Waktu)', 'Form (Bentuk)'])];
              setHighlightedTitles(activePaths);
            }
          }
        } catch (err) {
          console.error('Failed to trigger grammar analysis on translation:', err);
        }
      }
    } catch (err: any) {
      console.error('Error in handleTranslateAndCheck:', err);
      setTranslateError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Global Translation & Grammar check assistant states
  const [globalTranslateText, setGlobalTranslateText] = useState('');
  const [globalSourceLang, setGlobalSourceLang] = useState('Indonesia');
  const [globalTargetLang, setGlobalTargetLang] = useState('Inggris');
  const [isGlobalTranslating, setIsGlobalTranslating] = useState(false);
  const [globalTranslationResult, setTranslationResultGlobal] = useState<{ translation: string; grammar_feedback: string; phonetics?: string } | null>(null);
  const [globalTranslateError, setGlobalTranslateError] = useState<string | null>(null);
  const [globalCurrentWordIndex, setGlobalCurrentWordIndex] = useState<number | null>(null);

  const handleSwapGlobalLanguages = () => {
    const prevSource = globalSourceLang;
    setGlobalSourceLang(globalTargetLang);
    setGlobalTargetLang(prevSource);
    setGlobalTranslateText('');
    setTranslationResultGlobal(null);
    setGlobalTranslateError(null);
    setGlobalCurrentWordIndex(null);
  };

  const playAudio = (text: string, langCode: string) => {
    if (!window.speechSynthesis) return;
    
    // Bugfix for Chrome/Safari/Edge: resume first in case it's in a paused state,
    // then cancel any ongoing speech to prevent overlapping or sticking.
    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    } catch (err) {
      console.error('SpeechSynthesis cancel error:', err);
    }
    
    setGlobalCurrentWordIndex(null);

    // Use a small timeout to let the cancel operation resolve
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 0.7; // Slower playback for pronunciation learning

        const words = text.split(' ');

        utterance.onstart = () => {
          setGlobalCurrentWordIndex(null);
        };

        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            const charIndex = event.charIndex;
            // Find which word index corresponds to the charIndex
            let currentPos = 0;
            let foundIndex = null;
            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              if (charIndex >= currentPos && charIndex < currentPos + word.length + 1) {
                foundIndex = i;
                break;
              }
              currentPos += word.length + 1;
            }
            if (foundIndex !== null) {
              setGlobalCurrentWordIndex(foundIndex);
            }
          }
        };

        utterance.onend = () => {
          setGlobalCurrentWordIndex(null);
        };

        utterance.onerror = (e) => {
          // 'canceled' and 'interrupted' are benign — they fire when cancel() is
          // called before a previous utterance finishes. Ignore them silently.
          if (e.error === 'canceled' || e.error === 'interrupted') return;
          console.error('SpeechSynthesisUtterance error:', e.error);
          setGlobalCurrentWordIndex(null);
        };

        const speakWithVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.lang === langCode || v.lang.startsWith(langCode.split('-')[0]));
          if (voice) {
            utterance.voice = voice;
          }
          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = speakWithVoice;
        } else {
          speakWithVoice();
        }
      } catch (speakErr) {
        console.error('SpeechSynthesis speak error:', speakErr);
        setGlobalCurrentWordIndex(null);
      }
    }, 200);
  };

  const handleGlobalTranslateAndCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalTranslateText.trim()) return;

    setIsGlobalTranslating(true);
    setGlobalTranslateError(null);
    setTranslationResultGlobal(null);

    // Determine direction for the existing API
    // If source=Indonesia or target=Inggris, treat as id→en; otherwise en→id for the grammar logic
    const isSourceIndo = globalSourceLang === 'Indonesia';
    const isTargetIndo = globalTargetLang === 'Indonesia';
    const direction = isSourceIndo ? 'id-en' : isTargetIndo ? 'en-id' : 'id-en';

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: globalTranslateText, direction, sourceLang: globalSourceLang, targetLang: globalTargetLang }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menerjemahkan teks.');
      }

      const data = await res.json();
      setTranslationResultGlobal({
        translation: data.translation || '',
        grammar_feedback: data.grammar_feedback || '',
        phonetics: data.phonetics || '',
      });

      // Trigger grammar analysis on the translated result only if English is involved
      const involvesEnglish = globalSourceLang === 'Inggris' || globalTargetLang === 'Inggris';
      if (involvesEnglish) {
        const englishSentence = globalSourceLang === 'Inggris' ? globalTranslateText : data.translation;
        if (englishSentence) {
          try {
            const resAnalyze = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sentence: englishSentence }),
            });
            if (resAnalyze.ok) {
              const dataAnalyze = await resAnalyze.json();
              if (dataAnalyze.highlightedTitles) {
                const activePaths = [...new Set([...dataAnalyze.highlightedTitles, 'English Grammar', 'Time (Waktu)', 'Form (Bentuk)'])];
                setHighlightedTitles(activePaths);
              }
            }
          } catch (err) {
            console.error('Failed to trigger grammar analysis on global translation:', err);
          }
        }
      } else {
        // Clear highlighted titles if translation doesn't involve English
        setHighlightedTitles([]);
      }
    } catch (err: any) {
      console.error('Error in handleGlobalTranslateAndCheck:', err);
      setGlobalTranslateError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsGlobalTranslating(false);
    }
  };


  const fetchUserProfile = async (userId: string) => {
    try {
      setCheckingProfile(true);
      const { data: profileData, error } = await (supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single() as any);

      // Separate query for role to avoid column not found error in profiles
      const { data: roleData } = await (supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .maybeSingle() as any);

      if (roleData?.role === 'admin') setIsAdmin(true);
      
      if (profileData?.username) {
        setUsername(profileData.username);
        setShowUsernameModal(false);
      } else {
        setShowUsernameModal(true);
      }

      if (profileData?.avatar_url) setAvatarUrl(profileData.avatar_url);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setCheckingProfile(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchUserProfile(session.user.id);
      }
    }
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserProfile(session.user.id);
        // Close auth modal on successful login
        if (event === 'SIGNED_IN') setShowAuthModal(false);
      } else {
        setUser(null);
        setIsAdmin(false);
        setUsername(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchAtlasData() {
      setLoading(true);
      try {
        const [nodesRes, edgesRes] = await Promise.all([
          supabase.from('nodes').select('*'),
          supabase.from('edges').select('*')
        ]);

        if (nodesRes.error || edgesRes.error) {
          throw nodesRes.error || edgesRes.error;
        }

        const formattedNodes: RfNode[] = (nodesRes.data as DbNode[]).map((node) => ({
          id: node.id,
          type: 'custom',
          position: { x: node.position_x, y: node.position_y },
          data: { 
            label: node.title,
            description: node.description,
            category: node.category,
            formula: node.formula,
            example: node.example,
            verbal_formula: node.verbal_formula,
            nominal_formula: node.nominal_formula,
            pos_form: node.pos_form,
            neg_form: node.neg_form,
            int_form: node.int_form,
            time_signals: node.time_signals,
            usage_context: node.usage_context
          },
        }));

        const formattedEdges: RfEdge[] = (edgesRes.data as DbEdge[]).map((edge) => ({
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          animated: true,
          style: { strokeWidth: 2, stroke: '#64748b' }
        }));

        setNodes(formattedNodes);
        setEdges(formattedEdges);
      } catch (error) {
        console.error('Error fetching atlas data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAtlasData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setUsername(null);
    setAvatarUrl(null);
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: RfNode) => {
    setSelectedNode({
      id: node.id,
      title: node.data.label,
      description: node.data.description,
      category: node.data.category,
      formula: node.data.formula,
      example: node.data.example,
      verbal_formula: node.data.verbal_formula,
      nominal_formula: node.data.nominal_formula,
      pos_form: node.data.pos_form,
      neg_form: node.data.neg_form,
      int_form: node.data.int_form,
      time_signals: node.data.time_signals,
      usage_context: node.data.usage_context,
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const closePanel = () => {
    setSelectedNode(null);
  };

  useEffect(() => {
    if (analyzeQuery.trim() === '') {
      setHighlightedTitles([]);
    }
  }, [analyzeQuery]);

  useEffect(() => {
    if (translateText.trim() === '') {
      setHighlightedTitles([]);
    }
  }, [translateText]);

  useEffect(() => {
    if (globalTranslateText.trim() === '') {
      setHighlightedTitles([]);
    }
  }, [globalTranslateText]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setGlobalCurrentWordIndex(null);
    };
  }, [globalTranslationResult]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzeQuery.trim()) {
      setHighlightedTitles([]);
      return;
    }

    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: analyzeQuery }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error('API Error: ' + errorText);
      }

      const data = await res.json();

      if (data.highlightedTitles) {
        // Force root path nodes so the path is never disconnected
        const activePaths = [...new Set([...data.highlightedTitles, 'English Grammar', 'Time (Waktu)', 'Form (Bentuk)'])];
        setHighlightedTitles(activePaths);
      } else {
        setHighlightedTitles([]);
      }
    } catch (error: any) {
      console.error('Error analyzing sentence:', error);
      alert('Gagal menganalisis kalimat: ' + (error.message || 'Error tidak diketahui'));
    } finally {
      setIsLoadingAi(false);
    }
  };

  const displayNodes = nodes.map((node) => {
    if (highlightedTitles.length === 0) {
      return { ...node, style: { ...node.style, opacity: 1, boxShadow: 'none' } };
    }
    const isHighlighted = highlightedTitles.includes(node.data.label);
    return {
      ...node,
      style: {
        ...node.style,
        opacity: isHighlighted ? 1 : 0.15,
        boxShadow: isHighlighted ? '0 0 0 4px rgba(59, 130, 246, 0.6), 0 4px 20px rgba(59, 130, 246, 0.3)' : 'none',
        borderRadius: '12px',
        transition: 'opacity 0.3s ease, box-shadow 0.3s ease',
      }
    };
  });

  // Pre-compute active node IDs for AND logic on edges
  const activeNodeIds = highlightedTitles.length > 0
    ? nodes.filter(n => highlightedTitles.includes(n.data?.label)).map(n => n.id)
    : [];

  const displayEdges = edges.map((edge) => {
    if (highlightedTitles.length === 0) {
      return { 
        ...edge, 
        animated: true, 
        style: { strokeWidth: 2, stroke: '#64748b' } 
      };
    }
    // AND logic: BOTH source AND target must be active for the edge to light up
    const isPath = activeNodeIds.includes(edge.source) && activeNodeIds.includes(edge.target);
    return {
      ...edge,
      animated: isPath,
      style: {
        strokeWidth: isPath ? 4 : 1,
        stroke: isPath ? '#3b82f6' : '#e2e8f0',
        opacity: isPath ? 1 : 0.4,
        transition: 'opacity 0.3s ease, stroke 0.3s ease',
      }
    };
  });

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <p className="text-xl font-semibold text-slate-500 animate-pulse">Memuat Peta...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-50 font-sans">
      {/* Auth Modals */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {!checkingProfile && showUsernameModal && user && (
        <UsernameModal
          userId={user.id}
          onComplete={(uname) => {
            setUsername(uname);
            setShowUsernameModal(false);
          }}
        />
      )}

      {showAboutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm border border-slate-100"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUpFade 0.25s ease-out' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">About English Atlas</h2>
              <button onClick={() => setShowAboutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              English Atlas adalah platform pembelajaran bahasa Inggris interaktif yang memetakan rumus-rumus grammar ke dalam bentuk visual yang intuitif. Dilengkapi dengan asisten AI personal, analisis tata bahasa otomatis, dan fitur kamus komprehensif, aplikasi ini dirancang untuk membuat pengalaman belajar bahasa Inggris menjadi lebih mudah dan terstruktur.
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Dibuat oleh alfatih ahmad 22 juni 2026
            </p>
          </div>
        </div>
      )}

      {/* ===== NAVBAR (Mobile-First Fixed Header) ===== */}
      <div className="fixed top-0 left-0 w-full h-14 px-4 flex justify-between items-center z-[60] bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        {/* Left: Logo + About */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-indigo-600 tracking-tight">english atlas</span>
          <span
            className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer hidden sm:block"
            onClick={() => setShowAboutModal(true)}
          >
            About
          </span>
          <button
            className="sm:hidden text-slate-400 hover:text-slate-700"
            onClick={() => setShowAboutModal(true)}
            title="About"
          >
            <Info size={16} />
          </button>
        </div>

        {/* Right: Auth / Avatar */}
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu
              user={user}
              username={username}
              avatarUrl={avatarUrl}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              onAdminClick={() => router.push('/admin')}
              onAvatarUpdate={(url) => setAvatarUrl(url)}
            />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-full font-semibold transition-colors shadow-sm text-xs"
            >
              <LogIn size={13} />
              Login
            </button>
          )}
        </div>
      </div>

      {/* Center-top: Search/Translation Container — sits below the navbar */}
      <div className="fixed z-30 top-14 left-0 right-0 px-3 md:left-1/2 md:-translate-x-1/2 md:w-auto md:right-auto md:max-w-xl pointer-events-none pt-3">
        <div className="flex flex-col gap-2 w-full pointer-events-auto">


          {/* Grammar Analysis Form */}
          <form onSubmit={handleAnalyze} className="relative flex items-center shadow-md rounded-xl md:rounded-full bg-white/95 backdrop-blur-md border border-indigo-100 p-1">
            <input
              type="text"
              value={analyzeQuery}
              onChange={(e) => setAnalyzeQuery(e.target.value)}
              placeholder="Ketik kalimat Inggris..."
              className="flex-grow bg-transparent border-none outline-none px-3 py-1.5 md:px-5 md:py-2.5 text-slate-800 placeholder-slate-400 text-xs md:text-base w-full min-w-0"
            />
            <button
              type="submit"
              disabled={isLoadingAi}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-6 md:py-2.5 min-w-[70px] md:min-w-[120px] rounded-lg md:rounded-full text-white font-semibold transition-all text-[11px] md:text-base shrink-0 ${
                isLoadingAi ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md'
              }`}
            >
              {isLoadingAi ? <span className="animate-pulse">...</span> : 'Analisis'}
            </button>
          </form>

          {/* Language Assistant — Always visible */}
          <div className="flex bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-indigo-50 p-2.5 flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-indigo-100 text-indigo-600 rounded">
                  <Languages size={12} />
                </div>
                <span className="text-xs font-bold text-slate-700">Language Assistant</span>
              </div>
              {(globalTranslateText || globalTranslationResult || globalTranslateError) && (
                <button
                  onClick={() => {
                    setGlobalTranslateText('');
                    setTranslationResultGlobal(null);
                    setGlobalTranslateError(null);
                    setHighlightedTitles([]);
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Language Selector Row */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              {/* Source Language Select */}
              <div className="relative flex-1">
                <select
                  value={globalSourceLang}
                  onChange={(e) => {
                    setGlobalSourceLang(e.target.value);
                    setGlobalTranslateText('');
                    setTranslationResultGlobal(null);
                    setGlobalTranslateError(null);
                  }}
                  className="w-full appearance-none cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px] md:text-xs rounded-md py-1.5 px-2 pr-6 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-center"
                >
                  {POPULAR_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronDown size={10} />
                </div>
              </div>

              {/* Swap Button */}
              <button
                type="button"
                onClick={handleSwapGlobalLanguages}
                className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Tukar bahasa"
              >
                <ArrowRightLeft size={12} />
              </button>

              {/* Target Language Select */}
              <div className="relative flex-1">
                <select
                  value={globalTargetLang}
                  onChange={(e) => {
                    setGlobalTargetLang(e.target.value);
                    setTranslationResultGlobal(null);
                    setGlobalTranslateError(null);
                  }}
                  className="w-full appearance-none cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px] md:text-xs rounded-md py-1.5 px-2 pr-6 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-center"
                >
                  {POPULAR_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronDown size={10} />
                </div>
              </div>
            </div>

            {/* Input + Go Row */}
            <form onSubmit={handleGlobalTranslateAndCheck} className="flex gap-2">
              <input
                type="text"
                value={globalTranslateText}
                onChange={(e) => setGlobalTranslateText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (globalTranslateText.trim() && !isGlobalTranslating) {
                      handleGlobalTranslateAndCheck(e as any);
                    }
                  }
                }}
                placeholder={`Ketik dalam bahasa ${globalSourceLang}...`}
                className="flex-grow bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all w-full min-w-0"
              />
              {globalTranslateText && (
                <button
                  type="button"
                  onClick={() => playAudio(globalTranslateText, globalSourceLang === 'Indonesia' ? 'id-ID' : 'en-US')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
                  title="Dengarkan teks sumber"
                >
                  <Volume2 size={14} />
                </button>
              )}
              <button
                type="submit"
                disabled={isGlobalTranslating || !globalTranslateText.trim()}
                className="flex items-center justify-center px-4 py-1.5 rounded-lg text-white font-semibold text-[11px] transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shrink-0"
              >
                {isGlobalTranslating ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
              </button>
            </form>

            {globalTranslateError && (
              <div className="p-2 bg-red-50 text-red-600 text-[10px] rounded-lg border border-red-100">
                {globalTranslateError}
              </div>
            )}

            {globalTranslationResult && (
              <div className="space-y-2 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 max-h-[220px] overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider">
                      Terjemahan ke {globalTargetLang}:
                    </h4>
                    <button
                      type="button"
                      onClick={() => playAudio(globalTranslationResult.translation, globalTargetLang === 'Indonesia' ? 'id-ID' : 'en-US')}
                      className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded transition-colors"
                      title="Dengarkan terjemahan"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  <div className="bg-white rounded border border-indigo-100/50 shadow-sm overflow-hidden">
                    <p className="text-[11px] md:text-sm font-medium text-slate-800 px-2 py-1.5 leading-relaxed flex flex-wrap gap-x-1 gap-y-0.5">
                      {globalTranslationResult.translation.split(' ').map((word, idx) => {
                        const isActive = idx === globalCurrentWordIndex;
                        return (
                          <span
                            key={idx}
                            className={`transition-colors duration-150 rounded px-0.5 ${
                              isActive ? 'bg-yellow-200 text-blue-600 font-bold' : ''
                            }`}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </p>
                    {globalTranslationResult.phonetics && (
                      <div className="px-2 pb-1.5 pt-0 border-t border-slate-50 mt-1">
                        <span className="font-mono text-[10px] md:text-xs text-slate-500 italic">
                          {globalTranslationResult.phonetics}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Grammar Analysis Feedback - only show if involves English */}
                {(globalSourceLang === 'Inggris' || globalTargetLang === 'Inggris') && globalTranslationResult.grammar_feedback && (
                  <div>
                    <h4 className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider mb-0.5">
                      Analisis Grammar:
                    </h4>
                    <p className="text-[10px] md:text-xs text-slate-600 bg-white/70 px-2 py-1.5 rounded border border-indigo-100/20 leading-relaxed">
                      {globalTranslationResult.grammar_feedback}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rumus Dasar (Legend) Widget — bottom-left, above bottom bar */}
      <div className="fixed z-50 bottom-20 left-4 md:bottom-8 md:left-8 flex flex-col items-start gap-2 pointer-events-none">
        <button
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-full shadow-lg transition-all border border-slate-600 pointer-events-auto"
        >
          <BookOpen size={18} />
          <span className="font-semibold text-sm">Rumus Dasar</span>
          <ChevronDown size={16} className={`transform transition-transform ${isLegendOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isLegendOpen && (
          <div className="relative bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl w-[calc(100vw-2rem)] md:w-[350px] max-h-[60vh] overflow-y-auto pointer-events-auto">
            <button
              onClick={() => setIsLegendOpen(false)}
              className="md:hidden absolute top-3 right-3 p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
              aria-label="Tutup Rumus Dasar"
            >
              <X size={16} />
            </button>

            <h3 className="font-bold text-slate-800 text-base md:text-lg border-b pb-2 mb-3">Rumus Dasar (Legend)</h3>
            
            <div className="space-y-4 text-sm text-slate-700">
              <section>
                <h4 className="font-semibold text-indigo-600 mb-1">Subject & Auxiliary</h4>
                <div className="bg-slate-50 p-2 rounded-lg text-xs space-y-1.5 border border-slate-100">
                  <p><span className="font-bold">Present:</span></p>
                  <ul className="list-disc pl-4 text-slate-600">
                    <li>I &rarr; am / do / have</li>
                    <li>You/They/We &rarr; are / do / have</li>
                    <li>He/She/It &rarr; is / does / has</li>
                  </ul>
                  <p className="mt-2"><span className="font-bold">Past:</span></p>
                  <ul className="list-disc pl-4 text-slate-600">
                    <li>I/He/She/It &rarr; was / did / had</li>
                    <li>You/They/We &rarr; were / did / had</li>
                  </ul>
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-indigo-600 mb-1">Verb Definition</h4>
                <div className="bg-slate-50 p-2 rounded-lg text-xs space-y-2 border border-slate-100">
                  <p><span className="font-bold text-slate-800">V1 (Infinitive):</span> Kata kerja dasar (e.g., go, eat).</p>
                  <p><span className="font-bold text-slate-800">V2 (Past):</span> Kata kerja masa lalu (e.g., went, ate).</p>
                  <p><span className="font-bold text-slate-800">V3 (Past Participle):</span> Kata kerja bentuk ketiga, dipakai di Perfect Tense/Pasif (e.g., gone, eaten).</p>
                  <p><span className="font-bold text-slate-800">V-ing (Present Participle):</span> Kata kerja + ing, untuk kejadian yang sedang berlangsung (e.g., going, eating).</p>
                  
                  <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                    <span className="font-bold text-amber-800">Regular vs Irregular:</span>
                    <ul className="list-disc pl-4 mt-1 text-amber-900">
                      <li><span className="font-medium">Regular:</span> V2 & V3 ditambah -ed (play &rarr; played).</li>
                      <li><span className="font-medium">Irregular:</span> V2 & V3 berubah bentuk (go &rarr; went &rarr; gone).</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={Number.MIN_VALUE}
        maxZoom={Number.MAX_VALUE}
        className="z-0"
      >
        <Background gap={16} size={1} />
        <Controls style={{ bottom: '120px', left: '12px', top: 'auto' }} />
      </ReactFlow>

      {/* Smart Dictionary */}
      <DictionarySearch />

      {/* Panel Materi: Bottom Sheet on mobile, Side Panel on desktop */}
      {selectedNode && (
        <div className="
          fixed z-30
          bottom-0 left-0 w-full rounded-t-2xl max-h-[70vh]
          md:bottom-auto md:top-0 md:right-0 md:left-auto md:w-96 md:h-full md:rounded-none md:max-h-full
          bg-white shadow-2xl
          border-t border-slate-200 md:border-t-0 md:border-l
          flex flex-col
          transform transition-all duration-300 ease-in-out
        ">
          {/* Drag handle — mobile only */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header Panel */}
          <div className="flex items-start justify-between px-5 py-4 md:p-6 border-b border-slate-100 bg-slate-50 md:rounded-none rounded-t-2xl">
            <div className="flex flex-col gap-1.5 pr-4">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                {selectedNode.title}
              </h2>
              {selectedNode.category && (
                <span className="inline-block px-2 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded w-max">
                  {selectedNode.category}
                </span>
              )}
            </div>
            <button
              onClick={closePanel}
              className="p-2.5 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Tutup panel"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Konten Panel */}
          <div className="px-5 py-4 md:p-6 flex-grow overflow-y-auto">
            {selectedNode.description ? (
              <div className="text-slate-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap mb-4">
                {selectedNode.description}
              </div>
            ) : (
              <div className="flex items-center justify-center mb-4">
                <p className="text-slate-400 italic text-sm text-center">
                  Belum ada deskripsi untuk materi ini.
                </p>
              </div>
            )}

            {selectedNode.usage_context && (
              <div className="mb-5 bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Info size={14} /> Usage Context</h3>
                <p className="text-sm text-amber-900">{selectedNode.usage_context}</p>
              </div>
            )}

            {(selectedNode.verbal_formula || selectedNode.nominal_formula) && (
              <div className="mb-5">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-3 border-b pb-1">Verbal vs Nominal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedNode.verbal_formula && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <h4 className="text-xs font-bold text-indigo-600 uppercase mb-2">Verbal</h4>
                      <div className="font-mono text-sm text-slate-800 bg-slate-50 p-2 rounded whitespace-pre-wrap">
                        {selectedNode.verbal_formula}
                      </div>
                    </div>
                  )}
                  {selectedNode.nominal_formula && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <h4 className="text-xs font-bold text-teal-600 uppercase mb-2">Nominal</h4>
                      <div className="font-mono text-sm text-slate-800 bg-slate-50 p-2 rounded whitespace-pre-wrap">
                        {selectedNode.nominal_formula}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(selectedNode.pos_form || selectedNode.neg_form || selectedNode.int_form) && (
              <div className="mb-5">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-3 border-b pb-1">Forms (+), (-), (?)</h3>
                <div className="space-y-2">
                  {selectedNode.pos_form && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-green-600">(+) Positive</span>
                      <div className="bg-slate-800 text-green-400 font-mono p-2.5 rounded-md whitespace-pre-wrap text-xs md:text-sm">
                        {selectedNode.pos_form}
                      </div>
                    </div>
                  )}
                  {selectedNode.neg_form && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-red-500">(-) Negative</span>
                      <div className="bg-slate-800 text-red-400 font-mono p-2.5 rounded-md whitespace-pre-wrap text-xs md:text-sm">
                        {selectedNode.neg_form}
                      </div>
                    </div>
                  )}
                  {selectedNode.int_form && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-blue-500">(?) Interrogative</span>
                      <div className="bg-slate-800 text-blue-400 font-mono p-2.5 rounded-md whitespace-pre-wrap text-xs md:text-sm">
                        {selectedNode.int_form}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedNode.time_signals && (
              <div className="mb-5 bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Clock size={14} /> Time Signals</h3>
                <p className="text-sm font-medium text-slate-700 italic">
                  {selectedNode.time_signals}
                </p>
              </div>
            )}

            {/* Fallback for legacy formula/example if they exist but new fields don't */}
            {!selectedNode.verbal_formula && !selectedNode.nominal_formula && selectedNode.formula && (
              <div className="mb-5">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2">Formula</h3>
                <div className="bg-slate-800 text-green-400 font-mono p-3 rounded-md whitespace-pre-wrap text-xs md:text-sm">
                  {selectedNode.formula}
                </div>
              </div>
            )}

            {!selectedNode.verbal_formula && !selectedNode.nominal_formula && selectedNode.example && (
              <div className="mb-5">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2">Examples</h3>
                <div className="border-l-4 border-blue-500 bg-blue-50 p-3 italic whitespace-pre-wrap text-xs md:text-sm text-slate-700">
                  {selectedNode.example}
                </div>
              </div>
            )}

            {/* AI Quiz Panel */}
            <QuizPanel
              nodeTitle={selectedNode.title}
              nodeContent={[
                selectedNode.title,
                selectedNode.description,
                selectedNode.usage_context,
                selectedNode.verbal_formula ? `Verbal: ${selectedNode.verbal_formula}` : '',
                selectedNode.nominal_formula ? `Nominal: ${selectedNode.nominal_formula}` : '',
                selectedNode.pos_form ? `Positive form: ${selectedNode.pos_form}` : '',
                selectedNode.neg_form ? `Negative form: ${selectedNode.neg_form}` : '',
                selectedNode.int_form ? `Interrogative form: ${selectedNode.int_form}` : '',
                selectedNode.time_signals ? `Time signals: ${selectedNode.time_signals}` : '',
                selectedNode.formula,
                selectedNode.example,
              ].filter(Boolean).join('\n')}
            />

            {/* Divider */}
            <div className="my-5 border-t border-slate-200" />

            {/* Translation & Grammar Checker Assistant */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Languages size={18} />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-slate-800">
                    Asisten Penerjemah & Grammar
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTranslateDirection(prev => prev === 'id-en' ? 'en-id' : 'id-en')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors text-xs font-semibold"
                >
                  <ArrowRightLeft size={14} />
                  {translateDirection === 'id-en' ? 'ID → EN' : 'EN → ID'}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {translateDirection === 'id-en' 
                  ? `Ketik kalimat bahasa Indonesia di bawah ini untuk diterjemahkan ke bahasa Inggris dan diperiksa tata bahasanya sesuai kaidah ${selectedNode.title}.`
                  : `Ketik kalimat bahasa Inggris di bawah ini untuk diterjemahkan ke bahasa Indonesia dan diperiksa tata bahasanya sesuai kaidah ${selectedNode.title}.`}
              </p>

              <form onSubmit={handleTranslateAndCheck} className="space-y-3">
                <textarea
                  value={translateText}
                  onChange={(e) => setTranslateText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (translateText.trim() && !isTranslating) {
                        handleTranslateAndCheck(e);
                      }
                    }
                  }}
                  placeholder={translateDirection === 'id-en' ? "Contoh: Saya sedang belajar bahasa Inggris..." : "Contoh: I am learning English..."}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-slate-50 focus:bg-white transition-all shadow-inner"
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isTranslating || !translateText.trim()}
                    className="flex-grow flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Translate & Check
                      </>
                    )}
                  </button>

                  {translateText && (
                    <button
                      type="button"
                      onClick={() => playAudio(translateText, translateDirection === 'id-en' ? 'id-ID' : 'en-US')}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all shadow-sm shrink-0"
                      title="Dengarkan teks sumber"
                    >
                      <Volume2 size={16} />
                    </button>
                  )}

                  {(translateText || translationResult || translateError) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTranslateText('');
                        setTranslationResult(null);
                        setTranslateError(null);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-all shadow-sm shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>

              {translateError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                  {translateError}
                </div>
              )}

              {translationResult && (
                <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 max-h-[180px] overflow-y-auto">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                        {translateDirection === 'id-en' ? 'Terjemahan Inggris:' : 'Terjemahan Indonesia:'}
                      </h4>
                      <button
                        type="button"
                        onClick={() => playAudio(translationResult.translation, translateDirection === 'id-en' ? 'en-US' : 'id-ID')}
                        className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded transition-colors"
                        title="Dengarkan terjemahan"
                      >
                        <Volume2 size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-medium text-slate-800 bg-white px-3 py-2 rounded-lg border border-indigo-100/50 shadow-sm leading-relaxed">
                      {translationResult.translation}
                    </p>
                  </div>
                  {translationResult.grammar_feedback && (
                    <div>
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">
                        Catatan Grammar:
                      </h4>
                      <p className="text-xs text-slate-600 bg-white/70 px-3 py-2 rounded-lg border border-indigo-100/20 leading-relaxed">
                        {translationResult.grammar_feedback}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
