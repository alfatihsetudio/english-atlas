'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node as RfNode, Edge as RfEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { X, LogIn, LogOut, LayoutDashboard, Languages, Sparkles, Loader2 } from 'lucide-react';
import { Node as DbNode, Edge as DbEdge } from '@/types/database';
import CustomNode from '@/components/CustomNode';
import { useRouter } from 'next/navigation';

const nodeTypes = { custom: CustomNode };
const edgeTypes = {};

export default function HomeAtlas() {
  const router = useRouter();
  const [nodes, setNodes] = useState<RfNode[]>([]);
  const [edges, setEdges] = useState<RfEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
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
  } | null>(null);

  // Translation & Grammar check assistant states
  const [translateText, setTranslateText] = useState('');
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
        body: JSON.stringify({ text: translateText }),
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

      if (data.translation) {
        try {
          const resAnalyze = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: data.translation }),
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
  const [isGlobalTranslating, setIsGlobalTranslating] = useState(false);
  const [globalTranslationResult, setTranslationResultGlobal] = useState<{ translation: string; grammar_feedback: string } | null>(null);
  const [globalTranslateError, setGlobalTranslateError] = useState<string | null>(null);

  const handleGlobalTranslateAndCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalTranslateText.trim()) return;

    setIsGlobalTranslating(true);
    setGlobalTranslateError(null);
    setTranslationResultGlobal(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: globalTranslateText }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menerjemahkan teks.');
      }

      const data = await res.json();
      setTranslationResultGlobal({
        translation: data.translation || '',
        grammar_feedback: data.grammar_feedback || '',
      });

      // Trigger grammar analysis on the translated result
      if (data.translation) {
        try {
          const resAnalyze = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: data.translation }),
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
    } catch (err: any) {
      console.error('Error in handleGlobalTranslateAndCheck:', err);
      setGlobalTranslateError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsGlobalTranslating(false);
    }
  };


  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: roleData } = await (supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single() as any);
        if (roleData?.role === 'admin') {
          setIsAdmin(true);
        }
      }
    }
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data: roleData } = await (supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single() as any);
        setIsAdmin(roleData?.role === 'admin');
      } else {
        setUser(null);
        setIsAdmin(false);
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
            example: node.example
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
    router.refresh();
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: RfNode) => {
    setSelectedNode({
      id: node.id,
      title: node.data.label,
      description: node.data.description,
      category: node.data.category,
      formula: node.data.formula,
      example: node.data.example,
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
      {/* Unified Top Layout: Header + Search/Translate Stack */}
      <div className="fixed z-40 top-2 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-auto md:right-auto max-w-[500px] mx-auto md:max-w-3xl flex flex-col md:flex-row gap-2 pointer-events-none md:top-6">
        
        {/* Floating Header */}
        <div className="flex items-center justify-between bg-white/95 backdrop-blur-md px-3 py-2 md:px-6 md:py-3 rounded-xl md:rounded-full shadow-md border border-slate-200 pointer-events-auto shrink-0 self-start w-full md:w-auto">
          <div className="font-bold text-xs md:text-xl text-indigo-600 mr-2 truncate">
            english atlas by fth demo mode
          </div>
          
          {user ? (
            <div className="flex items-center gap-3 text-sm text-slate-700">
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 md:px-3 md:py-1.5 rounded-full font-medium transition-colors border border-indigo-200"
                >
                  <LayoutDashboard size={14} />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-slate-500 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 md:px-4 md:py-2 rounded-lg md:rounded-full font-medium transition-colors shadow-sm text-[10px] md:text-sm"
            >
              <LogIn size={14} />
              Login
            </button>
          )}
        </div>

        {/* Search & Translation Container */}
        <div className="flex flex-col gap-2 w-full md:w-[420px] pointer-events-auto">
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

          {/* Global Translation Helper Form — Always visible, compact on mobile */}
          <div className="flex bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-indigo-50 p-2.5 flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 bg-indigo-100 text-indigo-600 rounded">
                <Languages size={12} />
              </div>
              <span className="text-[10px] md:text-xs font-bold text-slate-700">Penerjemah Global</span>
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

          <form onSubmit={handleGlobalTranslateAndCheck} className="flex gap-2">
            <input
              type="text"
              value={globalTranslateText}
              onChange={(e) => setGlobalTranslateText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (globalTranslateText.trim() && !isGlobalTranslating) {
                    handleGlobalTranslateAndCheck(e);
                  }
                }
              }}
              placeholder="Indo → Inggris..."
              className="flex-grow bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs md:text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all w-full min-w-0"
            />
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
            <div className="space-y-2 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 max-h-[160px] overflow-y-auto">
              <div>
                <h4 className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider mb-0.5">
                  Terjemahan:
                </h4>
                <p className="text-[11px] md:text-sm font-medium text-slate-800 bg-white px-2 py-1.5 rounded border border-indigo-100/50 shadow-sm leading-relaxed">
                  {globalTranslationResult.translation}
                </p>
              </div>
              {globalTranslationResult.grammar_feedback && (
                <div>
                  <h4 className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider mb-0.5">
                    Catatan:
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
        <Controls style={{ bottom: '100px', left: '12px', top: 'auto' }} />
        {/* MiniMap: hidden on mobile, visible on desktop */}
        <div className="hidden md:block">
          <MiniMap zoomable pannable className="rounded-lg shadow-lg" nodeColor={(n) => {
            if (n.data?.category?.toLowerCase() === 'time') return '#eff6ff';
            if (n.data?.category?.toLowerCase() === 'grammar' || n.data?.category?.toLowerCase() === 'form') return '#dcfce7';
            if (n.data?.category?.toLowerCase() === 'root') return '#1e293b';
            return '#ffffff';
          }} />
        </div>
      </ReactFlow>

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
              <div className="text-slate-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap mb-5">
                {selectedNode.description}
              </div>
            ) : (
              <div className="flex items-center justify-center mb-5">
                <p className="text-slate-400 italic text-sm text-center">
                  Belum ada deskripsi untuk materi ini.
                </p>
              </div>
            )}

            {selectedNode.formula && (
              <div className="mb-5">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2">Formula</h3>
                <div className="bg-slate-800 text-green-400 font-mono p-3 rounded-md whitespace-pre-wrap text-xs md:text-sm">
                  {selectedNode.formula}
                </div>
              </div>
            )}

            {selectedNode.example && (
              <div className="mb-5">
                <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2">Examples</h3>
                <div className="border-l-4 border-blue-500 bg-blue-50 p-3 italic whitespace-pre-wrap text-xs md:text-sm text-slate-700">
                  {selectedNode.example}
                </div>
              </div>
            )}

            {/* Divider — hidden on mobile since translator panel is large enough */}
            <div className="my-5 border-t border-slate-200" />

            {/* Translation & Grammar Checker Assistant */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Languages size={18} />
                </div>
                <h3 className="text-base md:text-lg font-semibold text-slate-800">
                  Asisten Penerjemah & Grammar
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Ketik kalimat bahasa Indonesia di bawah ini untuk diterjemahkan ke bahasa Inggris dan diperiksa tata bahasanya sesuai kaidah {selectedNode.title}.
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
                  placeholder="Contoh: Saya sedang belajar bahasa Inggris..."
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

                  {(translateText || translationResult || translateError) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTranslateText('');
                        setTranslationResult(null);
                        setTranslateError(null);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-55 font-semibold text-sm transition-all shadow-sm"
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
                    <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">
                      Terjemahan Inggris:
                    </h4>
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
