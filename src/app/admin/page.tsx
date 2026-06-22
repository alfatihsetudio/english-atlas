'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node as RfNode, Edge as RfEdge, applyNodeChanges, NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@/lib/supabase';
import { X, Save, ShieldAlert, ShieldX, AlertTriangle, Loader2 } from 'lucide-react';
import { Node as DbNode, Edge as DbEdge } from '@/types/database';
import CustomNode from '@/components/CustomNode';

const nodeTypes = { custom: CustomNode };
const edgeTypes = {};

// =====================================================
// AUTH STATUS TYPES
// =====================================================
type AuthStatus = 'loading' | 'authorized' | 'unauthorized' | 'error';

interface AuthState {
  status: AuthStatus;
  message: string;
  details?: string;
}

export default function AdminAtlasEditor() {
  // Auth state - NO router.push, all states render UI
  const [authState, setAuthState] = useState<AuthState>({
    status: 'loading',
    message: 'Memverifikasi akses admin...',
  });

  // Editor state
  const [nodes, setNodes] = useState<RfNode[]>([]);
  const [edges, setEdges] = useState<RfEdge[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    formula?: string | null;
    example?: string | null;
  } | null>(null);

  // =====================================================
  // STRICT ASYNC AUTH CHECK
  // =====================================================
  useEffect(() => {
    async function checkAdminAuth() {
      console.log('========================================');
      console.log('[ADMIN AUTH] Starting admin authorization check...');
      console.log('========================================');

      try {
        // Step 1: Get authenticated user (server-verified, not from local cache)
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('[ADMIN AUTH] supabase.auth.getUser() error:', userError);
          setAuthState({
            status: 'error',
            message: 'Gagal memverifikasi sesi autentikasi.',
            details: `Auth Error: ${userError.message}`,
          });
          return;
        }

        const user = userData?.user;

        if (!user) {
          console.warn('[ADMIN AUTH] No authenticated user found. User must log in.');
          setAuthState({
            status: 'unauthorized',
            message: 'Anda belum login.',
            details: 'Silakan login terlebih dahulu untuk mengakses halaman admin.',
          });
          return;
        }

        // Log user identity for debugging
        console.log('[ADMIN AUTH] ✅ Authenticated user found:');
        console.log('  → user.id   :', user.id);
        console.log('  → user.email:', user.email);
        console.log('  → user.role :', user.role); // Supabase auth role (usually "authenticated")

        // Step 2: Query user_roles table for role
        console.log('[ADMIN AUTH] Querying user_roles table for role...');
        console.log(`  → SELECT role FROM user_roles WHERE id = '${user.id}'`);

        const { data: profileData, error: profileError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', user.id)
          .single();

        // Log the raw response
        console.log('[ADMIN AUTH] Profile query result:');
        console.log('  → data :', JSON.stringify(profileData, null, 2));
        console.log('  → error:', JSON.stringify(profileError, null, 2));

        // Step 3: Handle profile errors
        if (profileError) {
          // PGRST116 = "JSON object requested, multiple (or no) rows returned"
          // This means the user has NO profile row in the user_roles table
          if (profileError.code === 'PGRST116') {
            console.error('[ADMIN AUTH] ❌ PGRST116: Profile row NOT FOUND for user', user.id);
            console.error('[ADMIN AUTH] 📋 SOLUSI: Profil harus dibuat saat registrasi.');
            console.error('[ADMIN AUTH] 📋 Jalankan SQL berikut di Supabase SQL Editor:');
            console.error(`  INSERT INTO public.user_roles (id, role) VALUES ('${user.id}', 'admin');`);

            setAuthState({
              status: 'error',
              message: 'Profil Anda belum terdaftar di database.',
              details: `User ID "${user.id}" tidak ditemukan di tabel user_roles. Profil harus dibuat saat registrasi, atau admin harus menambahkannya secara manual. Lihat console untuk instruksi SQL.`,
            });
            return;
          }

          // Other database errors (RLS denial, network issue, etc.)
          console.error('[ADMIN AUTH] ❌ Database error saat query user_roles:', profileError);

          // Check if it's an RLS error
          const isRLSError = profileError.message?.includes('permission') ||
                             profileError.message?.includes('policy') ||
                             profileError.code === '42501';

          setAuthState({
            status: 'error',
            message: isRLSError
              ? 'Akses ditolak oleh Row Level Security (RLS).'
              : 'Gagal mengambil data profil dari database.',
            details: `Error [${profileError.code}]: ${profileError.message}. ${
              isRLSError
                ? 'Pastikan policy SELECT pada tabel user_roles mengizinkan authenticated users membaca row mereka sendiri.'
                : 'Periksa koneksi database dan konfigurasi tabel user_roles.'
            }`,
          });
          return;
        }

        // Step 4: Verify admin role
        const userRole = profileData?.role;
        console.log('[ADMIN AUTH] Profile role retrieved:', userRole);

        if (userRole !== 'admin') {
          console.warn(`[ADMIN AUTH] ⚠️ User ${user.id} has role "${userRole}", NOT "admin".`);
          setAuthState({
            status: 'unauthorized',
            message: 'Akses ditolak — Anda bukan admin.',
            details: `Role Anda saat ini: "${userRole || 'tidak ada'}". Halaman ini hanya dapat diakses oleh pengguna dengan role "admin". Hubungi administrator untuk mendapatkan akses.`,
          });
          return;
        }

        // Step 5: Auth successful!
        console.log('[ADMIN AUTH] ✅ AUTHORIZED — User is admin.');
        console.log('========================================');
        setAuthState({
          status: 'authorized',
          message: 'Akses admin diberikan.',
        });

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[ADMIN AUTH] ❌ Unexpected error during auth check:', err);
        setAuthState({
          status: 'error',
          message: 'Terjadi kesalahan sistem yang tidak terduga.',
          details: `Unexpected Error: ${errorMessage}`,
        });
      }
    }

    checkAdminAuth();
  }, []);

  // =====================================================
  // FETCH ATLAS DATA — only when authorized
  // =====================================================
  useEffect(() => {
    if (authState.status !== 'authorized') return;

    async function fetchAtlasData() {
      setDataLoading(true);
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
        console.error('[ADMIN] Error fetching atlas data:', error);
      } finally {
        setDataLoading(false);
      }
    }

    fetchAtlasData();
  }, [authState.status]);

  // =====================================================
  // EDITOR HANDLERS
  // =====================================================
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan jaringan/sistem.';
      console.error('Gagal menyimpan posisi:', error);
      alert('Gagal menyimpan: ' + errorMessage);
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

  // =====================================================
  // RENDER: STATUS-BASED UI
  // =====================================================

  // --- LOADING STATE ---
  if (authState.status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
          <p className="text-xl font-semibold text-slate-500">{authState.message}</p>
          <p className="text-sm text-slate-400">Menghubungi server autentikasi...</p>
        </div>
      </div>
    );
  }

  // --- UNAUTHORIZED STATE ---
  if (authState.status === 'unauthorized') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <ShieldX className="h-16 w-16 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Akses Ditolak</h1>
          <p className="text-lg text-slate-600 mb-4">{authState.message}</p>
          {authState.details && (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 mb-6">{authState.details}</p>
          )}
          <div className="flex gap-3 justify-center">
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Login
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition-colors"
            >
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (authState.status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-red-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-16 w-16 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Terjadi Kesalahan</h1>
          <p className="text-lg text-slate-600 mb-4">{authState.message}</p>
          {authState.details && (
            <div className="text-sm text-left text-slate-600 bg-red-50 rounded-lg p-4 mb-6 border border-red-100">
              <p className="font-semibold text-red-700 mb-1">Detail Error:</p>
              <p className="whitespace-pre-wrap break-words">{authState.details}</p>
            </div>
          )}
          <p className="text-xs text-slate-400 mb-6">
            Buka browser DevTools (F12) → Console untuk melihat log diagnostik lengkap.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Coba Lagi
            </button>
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition-colors"
            >
              Ke Halaman Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTHORIZED + DATA LOADING ---
  if (dataLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
          <p className="text-xl font-semibold text-slate-500 animate-pulse">Memuat Editor Peta...</p>
        </div>
      </div>
    );
  }

  // --- AUTHORIZED + DATA LOADED → MAIN EDITOR ---
  return (
    <div className="relative h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      {/* Admin Badge */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold shadow-sm border border-emerald-200">
        <ShieldAlert size={14} />
        Admin Mode
      </div>

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
