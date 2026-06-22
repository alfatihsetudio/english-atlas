'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node as RfNode, Edge as RfEdge, applyNodeChanges, NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { X, Save } from 'lucide-react';
import { Node as DbNode, Edge as DbEdge } from '@/types/database';
import CustomNode from '@/components/CustomNode';

const nodeTypes = { custom: CustomNode };
const edgeTypes = {};

export default function AdminAtlasEditor() {
  const router = useRouter();
  const [nodes, setNodes] = useState<RfNode[]>([]);
  const [edges, setEdges] = useState<RfEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    formula?: string | null;
    example?: string | null;
  } | null>(null);

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

    async function checkAdminAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/');
        return;
      }
      const { data: roleData } = await (supabase
        .from('user_roles')
        .select('role')
        .eq('id', session.user.id)
        .single() as any);
      
      if (roleData?.role !== 'admin') {
        router.push('/');
        return;
      }
      
      await fetchAtlasData();
    }

    checkAdminAuth();
  }, [router]);

  // Update position local saat drag
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const handleSaveMap = async () => {
    setIsSaving(true);
    try {
      const updatePromises = nodes.map((node) =>
        supabase
          .from('nodes')
          // @ts-ignore
          .update({ position_x: Math.round(node.position.x), position_y: Math.round(node.position.y) })
          .eq('id', node.id)
          .select()
      );

      const results = await Promise.all(updatePromises);
      
      const errors = results.filter(res => res.error);
      if (errors.length > 0) {
        console.error('Beberapa node gagal disimpan:', errors);
        throw errors[0].error;
      }

      alert('Posisi peta berhasil disimpan!');
    } catch (error: any) {
      console.error('Gagal menyimpan posisi:', error);
      alert('Gagal menyimpan: ' + (error?.message || 'Terjadi kesalahan jaringan/sistem.'));
    } finally {
      setIsSaving(false);
    }
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

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <p className="text-xl font-semibold text-slate-500 animate-pulse">Memuat Editor Peta...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={true}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="z-0"
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap zoomable pannable className="rounded-lg shadow-lg" nodeColor={(n) => {
          if (n.data?.category?.toLowerCase() === 'time') return '#eff6ff';
          if (n.data?.category?.toLowerCase() === 'grammar' || n.data?.category?.toLowerCase() === 'form') return '#dcfce7';
          if (n.data?.category?.toLowerCase() === 'root') return '#1e293b';
          return '#ffffff';
        }} />
      </ReactFlow>

      {/* Tombol Simpan di Kanan Atas */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={handleSaveMap}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${
            isSaving 
              ? 'bg-slate-500 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5'
          }`}
        >
          <Save size={20} />
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Peta'}
        </button>
      </div>

      {/* Side Panel Materi */}
      {selectedNode && (
        <div className="absolute left-0 top-0 h-full w-96 max-w-full bg-white shadow-2xl border-r border-slate-200 transform transition-transform duration-300 ease-in-out z-10 flex flex-col">
          {/* Header Panel */}
          <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50">
            <div className="flex flex-col gap-2 pr-4">
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">
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
              className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Tutup panel"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Konten Panel */}
          <div className="p-6 flex-grow overflow-y-auto">
            {selectedNode.description ? (
              <div className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap mb-6">
                {selectedNode.description}
              </div>
            ) : (
              <div className="flex items-center justify-center mb-6">
                <p className="text-slate-400 italic text-sm text-center">
                  Belum ada deskripsi untuk materi ini.
                </p>
              </div>
            )}

            {selectedNode.formula && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Formula</h3>
                <div className="bg-slate-800 text-green-400 font-mono p-3 rounded-md whitespace-pre-wrap text-sm">
                  {selectedNode.formula}
                </div>
              </div>
            )}

            {selectedNode.example && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Examples</h3>
                <div className="border-l-4 border-blue-500 bg-blue-50 p-3 italic whitespace-pre-wrap text-sm text-slate-700">
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
