'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node as RfNode, Edge as RfEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { X, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
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

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: roleData } = await (supabase
          .from('user_roles')
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
          .from('user_roles')
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
      {/* Floating Header */}
      <div className="fixed top-4 left-4 md:top-6 md:left-6 z-40 flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-2.5 md:px-6 md:py-3 rounded-full shadow-lg border border-slate-200 transition-all hover:bg-white">
        <div className="font-bold text-xl text-indigo-600 mr-4">English Atlas</div>
        
        {user ? (
          <div className="flex items-center gap-4 text-sm text-slate-700">
            <span className="hidden md:inline-block">Halo, <span className="font-semibold text-slate-900">{user.email}</span></span>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-full font-medium transition-colors border border-indigo-200"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 transition-colors ml-2"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium transition-colors shadow-md"
          >
            <LogIn size={18} />
            Login
          </button>
        )}
      </div>

      {/* Search Bar AI — fixed bottom on mobile, fixed top-center on desktop */}
      <div className="fixed z-50 bottom-12 md:bottom-auto md:top-6 left-1/2 -translate-x-1/2 w-[90vw] md:w-[400px]">
        <form onSubmit={handleAnalyze} className="relative flex items-center shadow-2xl rounded-2xl md:rounded-full bg-white/95 backdrop-blur-md border border-indigo-100 p-1">
          <input
            type="text"
            value={analyzeQuery}
            onChange={(e) => setAnalyzeQuery(e.target.value)}
            placeholder="Ketik kalimat bahasa Inggris..."
            className="flex-grow bg-transparent border-none outline-none px-4 py-3.5 md:px-5 md:py-3 text-slate-800 placeholder-slate-400 text-base"
          />
          <button
            type="submit"
            disabled={isLoadingAi}
            className={`flex items-center justify-center gap-2 px-5 py-3.5 md:px-6 md:py-3 min-w-[90px] md:min-w-[120px] rounded-xl md:rounded-full text-white font-semibold transition-all text-sm md:text-base ${
              isLoadingAi ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isLoadingAi ? <span className="animate-pulse">Loading...</span> : 'Analisis'}
          </button>
        </form>
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
          bottom-0 left-0 w-full rounded-t-2xl max-h-[55vh]
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
          </div>
        </div>
      )}
    </div>
  );
}
