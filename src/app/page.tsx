'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, { Background, Controls, Node as RfNode, Edge as RfEdge, Position, NodeChange, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { X, Languages, Sparkles, Loader2, ArrowRightLeft, ChevronDown, BookOpen, Clock, Info, Volume2, LogIn, Trophy } from 'lucide-react';
import { Node as DbNode, Edge as DbEdge } from '@/types/database';
import CustomNode from '@/components/CustomNode';
import QuizPanel from '@/components/QuizPanel';
import AuthModal from '@/components/AuthModal';
import UsernameModal from '@/components/UsernameModal';
import UserMenu from '@/components/UserMenu';
import DictionarySearch from '@/components/DictionarySearch';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TENSE_EXAMPLES } from '@/lib/examples';
import { GRAMMAR_FORMULAS } from '@/lib/grammarData';

const EnglishTutorChat = dynamic(() => import('@/components/EnglishTutorChat'), { ssr: false });

function routeEdgesEfficiently(nodes: RfNode[], edges: RfEdge[]): RfEdge[] {
  return edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return edge;

    const sourceCenter = {
      x: sourceNode.position.x + 150,
      y: sourceNode.position.y + 75
    };
    const targetCenter = {
      x: targetNode.position.x + 150,
      y: targetNode.position.y + 75
    };

    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;

    let sourceHandle = 's-bottom';
    let targetHandle = 't-top';

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        sourceHandle = 's-right';
        targetHandle = 't-left';
      } else {
        sourceHandle = 's-left';
        targetHandle = 't-right';
      }
    } else {
      if (dy > 0) {
        sourceHandle = 's-bottom';
        targetHandle = 't-top';
      } else {
        sourceHandle = 's-top';
        targetHandle = 't-bottom';
      }
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle
    };
  });
}

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
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
  
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

  // Grammar check states
  const [grammarText, setGrammarText] = useState('');
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [grammarResult, setGrammarResult] = useState<{ is_correct: boolean; explanation: string } | null>(null);
  const [grammarError, setGrammarError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [aiExamples, setAiExamples] = useState<string | null>(null);
  const [isGeneratingExample, setIsGeneratingExample] = useState(false);
  const [generateExampleError, setGenerateExampleError] = useState<string | null>(null);

  const [sheetHeight, setSheetHeight] = useState<number>(350);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const [isMobile, setIsMobile] = useState(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset grammar check states, examples dropdown, and height on node change
  useEffect(() => {
    setGrammarText('');
    setGrammarResult(null);
    setGrammarError(null);
    setShowExamples(false);
    setAiExamples(null);
    setGenerateExampleError(null);
    if (typeof window !== 'undefined') {
      setSheetHeight(window.innerHeight * 0.5);
    }
  }, [selectedNode?.id]);

  // Handle mobile back button to close selected node panel
  useEffect(() => {
    if (!selectedNode) return;

    window.history.pushState({ nodePanelOpen: true }, '');

    const handlePopState = () => {
      setSelectedNode(null);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.nodePanelOpen) {
        window.history.back();
      }
    };
  }, [selectedNode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingSheet(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = sheetHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSheet) return;
    const deltaY = dragStartY.current - e.clientY;
    const newHeight = Math.max(150, Math.min(window.innerHeight - 20, dragStartHeight.current + deltaY));
    setSheetHeight(newHeight);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    const halfScreen = window.innerHeight * 0.5;
    const fullScreen = window.innerHeight * 0.95;
    
    if (sheetHeight < 200) {
      setSelectedNode(null);
    } else if (sheetHeight > window.innerHeight * 0.7) {
      setSheetHeight(fullScreen);
    } else {
      setSheetHeight(halfScreen);
    }
  };

  const handleGrammarCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grammarText.trim()) return;

    setIsCheckingGrammar(true);
    setGrammarError(null);
    setGrammarResult(null);

    try {
      const res = await fetch('/api/check-grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: grammarText, ruleContext: selectedNode?.title }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal memeriksa tata bahasa.');
      }

      const data = await res.json();
      setGrammarResult({
        is_correct: data.is_correct,
        explanation: data.explanation || '',
      });

      if (data.is_correct) {
        try {
          const resAnalyze = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: grammarText }),
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
      console.error('Error in handleGrammarCheck:', err);
      setGrammarError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  const handleGenerateAiExample = async () => {
    if (!selectedNode) return;
    setIsGeneratingExample(true);
    setGenerateExampleError(null);
    try {
      const res = await fetch('/api/generate-example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenseName: selectedNode.title }),
      });
      if (!res.ok) {
        throw new Error('Gagal menghasilkan contoh AI.');
      }
      const data = await res.json();
      setAiExamples(data.examples);
    } catch (err: any) {
      setGenerateExampleError(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsGeneratingExample(false);
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
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);

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
          const targetLang = langCode.toLowerCase().replace('_', '-');
          const targetLangShort = targetLang.split('-')[0];
          
          const langVoices = voices.filter(v => {
            const vLang = v.lang.toLowerCase().replace('_', '-');
            return vLang === targetLang || vLang.startsWith(targetLangShort);
          });

          // Prioritize local offline voices (localService = true) to prevent network delays and 'synthesis-failed' errors
          const localVoices = langVoices.filter(v => v.localService === true);
          const candidateVoices = localVoices.length > 0 ? localVoices : langVoices;

          let selectedVoice = null;

          if (targetLangShort === 'en') {
            // For English, look for popular female voices in local candidates first
            const femaleKeywords = ['zira', 'samantha', 'hazel', 'susan', 'female', 'google us english', 'victoria', 'karen', 'moira', 'tessa', 'helena', 'haruka'];
            selectedVoice = candidateVoices.find(v => {
              const nameLower = v.name.toLowerCase();
              return femaleKeywords.some(keyword => nameLower.includes(keyword));
            });

            // If no local female voice matches, try matching from all voices (including remote ones)
            if (!selectedVoice && localVoices.length > 0) {
              selectedVoice = langVoices.find(v => {
                const nameLower = v.name.toLowerCase();
                return femaleKeywords.some(keyword => nameLower.includes(keyword));
              });
            }
          }

          // Fallback to the first candidate voice (which prioritizes local offline voices)
          if (!selectedVoice && candidateVoices.length > 0) {
            selectedVoice = candidateVoices[0];
          }

          if (selectedVoice) {
            utterance.voice = selectedVoice;
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
      setAnalysisResult(null);
    }
  }, [analyzeQuery]);

  useEffect(() => {
    if (grammarText.trim() === '') {
      setHighlightedTitles([]);
    }
  }, [grammarText]);

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

      if (data.analysis) {
        setAnalysisResult(data.analysis);
        setIsAnalysisOpen(true);
      } else {
        setAnalysisResult(null);
      }
    } catch (error: any) {
      console.error('Error analyzing sentence:', error);
      setAnalysisResult(null);
      alert('Gagal menganalisis kalimat: ' + (error.message || 'Error tidak diketahui'));
    } finally {
      setIsLoadingAi(false);
    }
  };

  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
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
  }, [nodes, highlightedTitles]);

  // Pre-compute active node IDs for AND logic on edges
  const activeNodeIds = highlightedTitles.length > 0
    ? nodes.filter(n => highlightedTitles.includes(n.data?.label)).map(n => n.id)
    : [];

  const displayEdges = useMemo(() => {
    const routed = routeEdgesEfficiently(nodes, edges);
    return routed.map((edge) => {
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
  }, [nodes, edges, activeNodeIds, highlightedTitles]);

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
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="bg-white rounded-xl p-5 shadow-xl max-w-[240px] border border-slate-100"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUpFade 0.2s ease-out' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800">About English Atlas</h2>
              <button onClick={() => setShowAboutModal(false)} className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-50 transition-colors">
                <X size={13} />
              </button>
            </div>
            <p className="text-slate-600 text-[10px] leading-relaxed mb-3">
              English Atlas adalah platform pembelajaran bahasa Inggris interaktif yang memetakan rumus-rumus grammar ke dalam bentuk visual yang intuitif. Dilengkapi dengan asisten AI personal, analisis tata bahasa otomatis, dan fitur kamus komprehensif, aplikasi ini dirancang untuk membuat pengalaman belajar bahasa Inggris menjadi lebih mudah dan terstruktur.
            </p>
            <p className="text-[9px] text-slate-500 font-bold mb-1">
              Versi: English Atlas 0.0.2
            </p>
            <p className="text-[9px] text-slate-400 font-medium">
              Dibuat oleh alfatih ahmad 22 juni 2026
            </p>
          </div>
        </div>
      )}

      {/* ===== NAVBAR (Mobile-First Fixed Header) ===== */}
      <div className="fixed top-0 left-0 w-full h-14 px-4 flex justify-between items-center z-[60] bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        {/* Left: Logo + About */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-indigo-600 tracking-tight">English Atlas</span>

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
              onUsernameUpdate={(name) => setUsername(name)}
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
      <div className="fixed z-30 top-14 left-0 right-0 px-3 md:left-1/2 md:-translate-x-1/2 md:w-auto md:right-auto md:max-w-[400px] pointer-events-none pt-3">
        <div className="flex flex-col gap-1.5 w-full pointer-events-auto">


          {/* Grammar Analysis Form */}
          <form onSubmit={handleAnalyze} className="relative flex items-center shadow-md rounded-xl md:rounded-full bg-white/95 backdrop-blur-md border border-indigo-100 p-0.5">
            <input
              type="text"
              value={analyzeQuery}
              onChange={(e) => setAnalyzeQuery(e.target.value)}
              placeholder="Ketik kalimat Inggris..."
              className="flex-grow bg-transparent border-none outline-none px-3 py-1.5 md:px-5 md:py-2.5 text-slate-800 placeholder-slate-400 text-xs md:text-base w-full min-w-0 pr-1"
            />
            {analyzeQuery && (
              <button
                type="button"
                onClick={() => {
                  setAnalyzeQuery('');
                  setHighlightedTitles([]);
                }}
                className="p-1 md:p-1.5 text-slate-300 hover:text-slate-500 transition-colors shrink-0 mr-1"
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoadingAi}
              className={`flex items-center justify-center gap-1 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-white text-xs font-semibold transition-all duration-200 shrink-0 transform active:scale-[0.97] ${
                isLoadingAi 
                  ? 'bg-slate-400 cursor-wait' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
              }`}
            >
              {isLoadingAi ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={11} className="shrink-0" />
                  <span className="tracking-wide">Analisis</span>
                </>
              )}
            </button>
          </form>

          {/* Grammar Analysis Card Result */}
          {analysisResult && (
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-indigo-50 p-2.5 flex flex-col gap-1 text-[10px] text-left transition-all duration-300 pointer-events-auto overflow-hidden">
              <div 
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
              >
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-indigo-100 text-indigo-600 rounded">
                    <Sparkles size={11} />
                  </div>
                  <span className="font-extrabold text-slate-800 tracking-wide">Hasil Analisis</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-50 border border-indigo-100/50 text-indigo-700 text-[9px] px-2 py-0.5 rounded-full font-bold">
                    {analysisResult.grammar}
                  </span>
                  <ChevronDown 
                    size={12} 
                    className={`text-slate-400 transform transition-transform duration-250 ${isAnalysisOpen ? 'rotate-180' : ''}`} 
                  />
                </div>
              </div>
              
              {isAnalysisOpen && (
                <div className="flex flex-col gap-1 mt-1.5 border-t border-indigo-50/50 pt-1.5 animate-fadeIn">
                  <div className="text-slate-600">
                    <span className="font-bold text-indigo-600">Grammar:</span> {analysisResult.grammar}
                  </div>
                  <div className="text-slate-600">
                    <span className="font-bold text-indigo-600">Arti:</span> &ldquo;{analysisResult.translation || analysisResult.arti}&rdquo;
                  </div>
                  <div className="text-slate-600">
                    <span className="font-bold text-indigo-600">Maksud Kalimat:</span> {analysisResult.meaning || analysisResult.maksud_kalimat}
                  </div>
                  <div className="text-slate-600 leading-relaxed">
                    <span className="font-bold text-indigo-600">Kenapa ({analysisResult.grammar})?:</span> {analysisResult.why || analysisResult.kenapa}
                  </div>
                  <div className="text-slate-600 leading-relaxed">
                    <span className="font-bold text-indigo-600">Apa yang salah:</span> <span className={analysisResult.error !== 'Tidak ada' && analysisResult.error !== '-' ? 'text-red-500 font-semibold' : ''}>{analysisResult.error || analysisResult.apa_yang_salah}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Translate Bahasa — Collapsible */}
          <div className="flex bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-indigo-50 p-2 flex-col gap-1.5 overflow-hidden transition-all duration-300 pointer-events-auto">
            <div 
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsTranslateOpen(!isTranslateOpen)}
            >
              <div className="flex items-center gap-1.5">
                <div className="p-1 bg-indigo-100 text-indigo-600 rounded">
                  <Languages size={11} />
                </div>
                <span className="text-[11px] font-bold text-slate-700">Translate Bahasa</span>
              </div>
              <div className="flex items-center gap-2">
                {(globalTranslateText || globalTranslationResult || globalTranslateError) && isTranslateOpen && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGlobalTranslateText('');
                      setTranslationResultGlobal(null);
                      setGlobalTranslateError(null);
                      setHighlightedTitles([]);
                    }}
                    className="text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Clear
                  </button>
                )}
                <ChevronDown 
                  size={12} 
                  className={`text-slate-400 transform transition-transform duration-250 ${isTranslateOpen ? 'rotate-180' : ''}`} 
                />
              </div>
            </div>

            {isTranslateOpen && (
              <div className="flex flex-col gap-1.5 mt-1 border-t border-indigo-50/50 pt-1.5 animate-fadeIn">
                {/* Language Selector Row */}
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-md border border-slate-200/80">
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
                      className="w-full appearance-none cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px] rounded-md py-1 px-1.5 pr-5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-center"
                    >
                      {POPULAR_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <ChevronDown size={8} />
                    </div>
                  </div>

                  {/* Swap Button */}
                  <button
                    type="button"
                    onClick={handleSwapGlobalLanguages}
                    className="p-0.5 rounded text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Tukar bahasa"
                  >
                    <ArrowRightLeft size={11} />
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
                      className="w-full appearance-none cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px] rounded-md py-1 px-1.5 pr-5 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-center"
                    >
                      {POPULAR_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <ChevronDown size={8} />
                    </div>
                  </div>
                </div>

                {/* Input + Go Row */}
                <form onSubmit={handleGlobalTranslateAndCheck} className="flex gap-1.5">
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
                    className="flex-grow bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all w-full min-w-0"
                  />
                  {globalTranslateText && (
                    <button
                      type="button"
                      onClick={() => playAudio(globalTranslateText, globalSourceLang === 'Indonesia' ? 'id-ID' : 'en-US')}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
                      title="Dengarkan teks sumber"
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isGlobalTranslating || !globalTranslateText.trim()}
                    className="flex items-center justify-center px-3.5 py-1 rounded-md text-white font-bold text-[10px] transition-all shadow-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                  >
                    {isGlobalTranslating ? <Loader2 size={11} className="animate-spin" /> : 'Go'}
                  </button>
                </form>

                {globalTranslateError && (
                  <div className="p-2 bg-red-50 text-red-600 text-[10px] rounded-lg border border-red-100">
                    {globalTranslateError}
                  </div>
                )}

                {globalTranslationResult && (
                  <div className="space-y-2 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/80 overflow-hidden">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <h4 className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider shrink-0">
                            Terjemahan ke {globalTargetLang}:
                          </h4>
                          {(globalSourceLang === 'Inggris' || globalTargetLang === 'Inggris') && globalTranslationResult.grammar_feedback && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-indigo-100/80 text-indigo-700 rounded select-none tracking-wide truncate max-w-[150px]" title={globalTranslationResult.grammar_feedback}>
                              {globalTranslationResult.grammar_feedback}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => playAudio(globalTranslationResult.translation, globalTargetLang === 'Indonesia' ? 'id-ID' : 'en-US')}
                          className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded transition-colors shrink-0"
                          title="Dengarkan terjemahan"
                        >
                          <Volume2 size={13} />
                        </button>
                      </div>
                      <div className="bg-white rounded border border-indigo-100/40 shadow-sm overflow-hidden">
                        <p className="text-[11px] md:text-sm font-semibold text-slate-800 px-2 py-1.5 leading-relaxed flex flex-wrap gap-x-1 gap-y-0.5">
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
                          <div className="px-2 pb-1 pt-0.5 border-t border-slate-50 mt-0.5">
                            <span className="font-mono text-[9px] md:text-[11px] text-slate-400 italic">
                              {globalTranslationResult.phonetics}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Rumus Dasar (Legend) Widget — bottom-left, above bottom bar */}
      {!selectedNode && (
        <div className="fixed z-50 bottom-20 left-4 md:bottom-8 md:left-8 flex flex-col items-start gap-1.5 pointer-events-none">
          <button
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-full shadow-md transition-all border border-slate-600 pointer-events-auto"
          >
            <BookOpen size={14} />
            <span className="font-semibold text-xs">Rumus Dasar</span>
            <ChevronDown size={14} className={`transform transition-transform ${isLegendOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLegendOpen && (
            <div className="relative bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3 shadow-lg w-[calc(100vw-2rem)] md:w-[300px] max-h-[40vh] overflow-y-auto pointer-events-auto">
              <button
                onClick={() => setIsLegendOpen(false)}
                className="md:hidden absolute top-2 right-2 p-1 rounded-md text-slate-600 hover:bg-slate-100"
                aria-label="Tutup Rumus Dasar"
              >
                <X size={14} />
              </button>

              <h3 className="font-bold text-slate-800 text-sm border-b pb-1.5 mb-2 pr-6">Rumus Dasar (Legend)</h3>

              <div className="space-y-2 text-[11px] text-slate-700">
                <section>
                  <h4 className="font-bold text-indigo-600 mb-0.5">Subject & Auxiliary</h4>
                  <div className="bg-slate-50 p-1.5 rounded-lg space-y-1 border border-slate-100">
                    <p><span className="font-bold">Present:</span></p>
                    <ul className="list-disc pl-3.5 text-slate-600 space-y-0.5">
                      <li>I &rarr; am / do / have</li>
                      <li>You/They/We &rarr; are / do / have</li>
                      <li>He/She/It &rarr; is / does / has</li>
                    </ul>
                    <p className="mt-1"><span className="font-bold">Past:</span></p>
                    <ul className="list-disc pl-3.5 text-slate-600 space-y-0.5">
                      <li>I/He/She/It &rarr; was / did / had</li>
                      <li>You/They/We &rarr; were / did / had</li>
                    </ul>
                  </div>
                </section>

                <section>
                  <h4 className="font-bold text-indigo-600 mb-0.5">Verb Definition</h4>
                  <div className="bg-slate-50 p-1.5 rounded-lg space-y-1 border border-slate-100">
                    <p><span className="font-semibold text-slate-800">V1 (Infinitive):</span> Kata kerja dasar (e.g., go, eat).</p>
                    <p><span className="font-semibold text-slate-800">V2 (Past):</span> Kata kerja masa lalu (e.g., went, ate).</p>
                    <p><span className="font-semibold text-slate-800">V3 (Past Participle):</span> Kata kerja V3, untuk Perfect/Pasif (e.g., gone, eaten).</p>
                    <p><span className="font-semibold text-slate-800">V-ing (Present Part:):</span> Kata kerja + ing, untuk Continuous (e.g., going).</p>

                    <div className="mt-1 p-1 bg-amber-50 rounded border border-amber-100 text-[10px]">
                      <span className="font-bold text-amber-800">Regular vs Irregular:</span>
                      <ul className="list-disc pl-3.5 mt-0.5 text-amber-900 space-y-0.5">
                        <li><span className="font-medium">Regular:</span> V2 & V3 +ed (played).</li>
                        <li><span className="font-medium">Irregular:</span> Berubah bentuk (go-went-gone).</li>
                      </ul>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={Number.MIN_VALUE}
        maxZoom={Number.MAX_VALUE}
        proOptions={{ hideAttribution: true }}
        className="z-0"
      >
        <Background gap={16} size={1} />
        <Controls style={{ bottom: '120px', left: '12px', top: 'auto' }} />
      </ReactFlow>

      {/* Smart Dictionary */}
      {!selectedNode && <DictionarySearch />}

      {/* AI Chatbot */}
      {!selectedNode && <EnglishTutorChat username={username} />}

      {/* Panel Materi: Bottom Sheet on mobile, Side Panel on desktop */}
      {selectedNode && (
        <div 
          className={`
            fixed z-30
            bottom-0 left-0 w-full rounded-t-2xl
            md:bottom-auto md:top-0 md:right-0 md:left-auto md:w-96 md:h-full md:rounded-none
            bg-white shadow-2xl
            border-t border-slate-200 md:border-t-0 md:border-l
            flex flex-col
            ${isDraggingSheet ? '' : 'transition-all duration-300 ease-out'}
          `}
          style={isMobile ? { height: `${sheetHeight}px`, maxHeight: '95vh' } : {}}
        >
          {/* Drag handle — mobile only */}
          <div 
            className="flex justify-center pt-2.5 pb-1.5 md:hidden cursor-row-resize select-none touch-none active:bg-slate-50 rounded-t-2xl"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header Panel */}
          <div className="flex items-start justify-between px-4 py-3 md:p-5 border-b border-slate-100 bg-slate-50 md:rounded-none rounded-t-2xl">
            <div className="flex flex-col gap-1 pr-4">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
                {selectedNode.title}
              </h2>
              {selectedNode.category && (
                <span className="inline-block px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-semibold rounded w-max">
                  {selectedNode.category}
                </span>
              )}
            </div>
            <button
              onClick={closePanel}
              className="p-1.5 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Tutup panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Konten Panel */}
          <div className="px-4 py-3.5 md:p-5 flex-grow overflow-y-auto">
            {(() => {
              const standardFormula = GRAMMAR_FORMULAS[selectedNode.title];
              
              if (standardFormula) {
                return (
                  <div className="mb-4">
                    <h3 className="text-xs font-extrabold text-slate-800 mb-2.5 border-b pb-1">Verbal vs Nominal Form</h3>
                    
                    {/* Verbal Block */}
                    <div className="mb-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-2.5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-indigo-700 uppercase mb-2 flex items-center gap-1 border-b border-indigo-100 pb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Verbal
                      </h4>
                      <div className="space-y-1.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-emerald-600">(+) Positive</span>
                          <div className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-indigo-100/50 p-1.5 rounded-md whitespace-pre-wrap">{standardFormula.verbal.positive}</div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-rose-500">(-) Negative</span>
                          <div className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-indigo-100/50 p-1.5 rounded-md whitespace-pre-wrap">{standardFormula.verbal.negative}</div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-sky-500">(?) Interrogative</span>
                          <div className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-indigo-100/50 p-1.5 rounded-md whitespace-pre-wrap">{standardFormula.verbal.interrogative}</div>
                        </div>
                      </div>
                    </div>

                    {/* Nominal Block */}
                    <div className="bg-teal-50/40 border border-teal-100 rounded-xl p-2.5 shadow-sm">
                      <h4 className="text-[10px] font-bold text-teal-700 uppercase mb-2 flex items-center gap-1 border-b border-teal-100 pb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        Nominal
                      </h4>
                      <div className="space-y-1.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-emerald-600">(+) Positive</span>
                          <div className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-teal-100/50 p-1.5 rounded-md whitespace-pre-wrap">{standardFormula.nominal.positive}</div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-rose-500">(-) Negative</span>
                          <div className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-teal-100/50 p-1.5 rounded-md whitespace-pre-wrap">{standardFormula.nominal.negative}</div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-sky-500">(?) Interrogative</span>
                          <div className="font-mono text-[10px] font-bold text-slate-800 bg-white border border-teal-100/50 p-1.5 rounded-md whitespace-pre-wrap">{standardFormula.nominal.interrogative}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  {(selectedNode.verbal_formula || selectedNode.nominal_formula) && (
                    <div className="mb-4">
                      <h3 className="text-xs font-extrabold text-slate-800 mb-2.5 border-b pb-1">Verbal vs Nominal</h3>
                      <div className="grid grid-cols-1 gap-2.5">
                        {selectedNode.verbal_formula && (
                          <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-2.5 shadow-sm">
                            <h4 className="text-[10px] font-bold text-indigo-700 uppercase mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              Verbal Formula
                            </h4>
                            <div className="font-mono text-xs font-bold text-slate-800 bg-white border border-indigo-100/50 p-2 rounded-lg whitespace-pre-wrap">
                              {selectedNode.verbal_formula}
                            </div>
                          </div>
                        )}
                        {selectedNode.nominal_formula && (
                          <div className="bg-teal-50/40 border border-teal-100 rounded-xl p-2.5 shadow-sm">
                            <h4 className="text-[10px] font-bold text-teal-700 uppercase mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                              Nominal Formula
                            </h4>
                            <div className="font-mono text-xs font-bold text-slate-800 bg-white border border-teal-100/50 p-2 rounded-lg whitespace-pre-wrap">
                              {selectedNode.nominal_formula}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(selectedNode.pos_form || selectedNode.neg_form || selectedNode.int_form) && (
                    <div className="mb-4">
                      <h3 className="text-xs font-extrabold text-slate-800 mb-2.5 border-b pb-1">Forms (+), (-), (?)</h3>
                      <div className="space-y-2.5">
                        {selectedNode.pos_form && (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 shadow-sm">
                            <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px] shadow-sm">+</span>
                              Positive Statement
                            </span>
                            <div className="bg-white/80 border border-emerald-200/50 text-emerald-900 font-mono p-2 rounded-lg whitespace-pre-wrap text-xs font-bold">
                              {selectedNode.pos_form}
                            </div>
                          </div>
                        )}
                        {selectedNode.neg_form && (
                          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-2.5 shadow-sm">
                            <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 text-rose-700 font-extrabold text-[10px] shadow-sm">-</span>
                              Negative Statement
                            </span>
                            <div className="bg-white/80 border border-rose-200/50 text-rose-900 font-mono p-2 rounded-lg whitespace-pre-wrap text-xs font-bold">
                              {selectedNode.neg_form}
                            </div>
                          </div>
                        )}
                        {selectedNode.int_form && (
                          <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-2.5 shadow-sm">
                            <span className="text-[10px] font-bold text-sky-800 flex items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-100 text-sky-700 font-extrabold text-[10px] shadow-sm">?</span>
                              Interrogative Question
                            </span>
                            <div className="bg-white/80 border border-sky-200/50 text-sky-900 font-mono p-2 rounded-lg whitespace-pre-wrap text-xs font-bold">
                              {selectedNode.int_form}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Fallback for legacy formula/example if they exist but new fields don't */}
            {!selectedNode.verbal_formula && !selectedNode.nominal_formula && selectedNode.formula && (
              <div className="mb-4 bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 shadow-sm">
                <h3 className="text-xs font-bold text-emerald-800 mb-1.5">Formula</h3>
                <div className="bg-white/80 border border-emerald-200/50 text-emerald-900 font-mono p-2 rounded-lg text-xs font-bold">
                  {selectedNode.formula}
                </div>
              </div>
            )}

            {(() => {
              const activeExamples = TENSE_EXAMPLES[selectedNode.title] || selectedNode.example;
              if (!activeExamples) return null;
              return (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setShowExamples(!showExamples)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100/70 text-indigo-700 rounded-xl transition-colors border border-indigo-100 shadow-sm"
                  >
                    <span className="text-[11px] font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                      <BookOpen size={12} className="text-indigo-600" />
                      Lihat Contoh Kalimat
                    </span>
                    <ChevronDown size={14} className={`transform transition-transform duration-200 text-indigo-600 ${showExamples ? 'rotate-180' : ''}`} />
                  </button>
                  {showExamples && (
                    <div className="mt-2 bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-3 shadow-inner space-y-3">
                      <div className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {activeExamples}
                      </div>

                      <div className="border-t border-indigo-100/50 pt-2.5 flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={isGeneratingExample}
                          onClick={handleGenerateAiExample}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-[10px] font-bold disabled:opacity-50"
                        >
                          {isGeneratingExample ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Membuat contoh...
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              Buatkan Contoh Lain (AI)
                            </>
                          )}
                        </button>
                        
                        {generateExampleError && (
                          <p className="text-[10px] text-red-500">{generateExampleError}</p>
                        )}
                        
                        {aiExamples && (
                          <div className="bg-white border border-indigo-100 p-2.5 rounded-lg text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed relative pr-8 animate-fadeIn">
                            <button
                              type="button"
                              onClick={() => playAudio(aiExamples, 'en-US')}
                              className="absolute top-2 right-2 p-1 hover:bg-indigo-50 rounded text-indigo-600 transition-colors"
                              title="Dengarkan Contoh AI"
                            >
                              <Volume2 size={13} />
                            </button>
                            <div className="text-[9px] font-bold text-indigo-600 uppercase mb-1.5 tracking-wider">Contoh Baru dari AI:</div>
                            {aiExamples}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedNode.usage_context && (
              <div className="mb-4 bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Info size={12} /> Usage Context</h3>
                <p className="text-xs text-amber-950 font-medium leading-relaxed">{selectedNode.usage_context}</p>
              </div>
            )}

            {selectedNode.time_signals && (
              <div className="mb-4 bg-violet-50/60 border border-violet-200/80 rounded-xl p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-violet-800 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock size={12} /> Time Signals</h3>
                <p className="text-xs font-medium text-violet-950 italic leading-relaxed">
                  {selectedNode.time_signals}
                </p>
              </div>
            )}

            {selectedNode.description && (
              <div className="text-slate-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap mb-3.5">
                {selectedNode.description}
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
            <div className="my-4 border-t border-slate-200" />

            {/* Sistem Cek Grammar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Sparkles size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Sistem Cek Grammar
                  </h3>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Ketik kalimat bahasa Inggris di bawah ini untuk diperiksa tata bahasanya sesuai kaidah {selectedNode.title}.
              </p>

              <form onSubmit={handleGrammarCheck} className="space-y-2">
                <textarea
                  value={grammarText}
                  onChange={(e) => setGrammarText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (grammarText.trim() && !isCheckingGrammar) {
                        handleGrammarCheck(e);
                      }
                    }
                  }}
                  placeholder="Contoh: I am studying English now..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none bg-slate-50 focus:bg-white transition-all shadow-inner"
                />

                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={isCheckingGrammar || !grammarText.trim()}
                    className="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white font-semibold text-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                  >
                    {isCheckingGrammar ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Memeriksa...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        Cek Grammar
                      </>
                    )}
                  </button>

                  {grammarText && (
                    <button
                      type="button"
                      onClick={() => playAudio(grammarText, 'en-US')}
                      className="px-2.5 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0"
                      title="Dengarkan teks"
                    >
                      <Volume2 size={13} />
                    </button>
                  )}

                  {(grammarText || grammarResult || grammarError) && (
                    <button
                      type="button"
                      onClick={() => {
                        setGrammarText('');
                        setGrammarResult(null);
                        setGrammarError(null);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-all shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>

              {grammarError && (
                <div className="p-2 bg-red-50 text-red-600 text-[10px] rounded-lg border border-red-100">
                  {grammarError}
                </div>
              )}

              {grammarResult && (
                <div className={`space-y-2 p-3 rounded-lg border max-h-[160px] overflow-y-auto ${
                  grammarResult.is_correct 
                    ? 'bg-green-50 border-green-100 text-green-800' 
                    : 'bg-red-50 border-red-100 text-red-800'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full ${grammarResult.is_correct ? 'bg-green-500' : 'bg-red-500'}`} />
                    {grammarResult.is_correct ? 'Tata Bahasa Benar!' : 'Perlu Koreksi'}
                  </div>
                  <p className="text-[11px] leading-relaxed font-medium bg-white/70 px-2 py-1.5 rounded border border-white/20 shadow-sm">
                    {grammarResult.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Game-Style Arena Button (Visible on both Mobile and Desktop/Dex) */}
      <Link
        href="/arena"
        className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-50 bg-gradient-to-tr from-yellow-500 via-amber-500 to-orange-500 text-white px-4 py-2.5 rounded-full flex items-center justify-center gap-1.5 shadow-[0_4px_20px_rgba(245,158,11,0.5)] border-2 border-white hover:scale-105 active:scale-95 transition-all animate-pulse"
      >
        <Trophy size={14} className="stroke-[2.5] shrink-0" />
        <span className="text-[10px] font-black tracking-wider uppercase leading-none">Atlas Game</span>
      </Link>

    </div>
  );
}
