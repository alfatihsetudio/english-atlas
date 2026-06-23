'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Loader2 } from 'lucide-react';

interface UsernameModalProps {
  userId: string;
  onComplete: (username: string) => void;
}

export default function UsernameModal({ userId, onComplete }: UsernameModalProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUsername = (val: string) => {
    if (val.length < 3) return 'Username minimal 3 karakter.';
    if (val.length > 20) return 'Username maksimal 20 karakter.';
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return 'Hanya huruf, angka, dan underscore (_).';
    return null;
  };

  const handleChange = (val: string) => {
    setUsername(val);
    setError(null);
    const validationError = validateUsername(val);
    if (validationError && val.length > 0) {
      setError(validationError);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: upsertError } = await (supabase
        .from('profiles' as any)
        .upsert({ id: userId, username: username.toLowerCase() } as any, { onConflict: 'id' }));
      if (upsertError) throw upsertError;
      onComplete(username.toLowerCase());
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        style={{ animation: 'slideUpFade 0.25s ease-out' }}
      >
        {/* Gradient Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 pt-6 pb-8 text-white">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <User size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold leading-tight">Pilih Username Anda</h2>
          <p className="text-indigo-200 text-sm mt-1">
            Username adalah identitas unik Anda di English Atlas.
          </p>
        </div>

        {/* Card Overlap */}
        <div className="px-6 pb-6 -mt-4">
          <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="contoh: budi_belajar"
                    maxLength={20}
                    autoFocus
                    className="w-full pl-7 pr-10 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                  />
                </div>
                {/* Status messages */}
                {error && (
                  <p className="text-red-500 text-xs mt-1.5">{error}</p>
                )}

                <p className="text-slate-400 text-[11px] mt-2">
                  Hanya huruf kecil, angka, dan underscore (_). 3-20 karakter.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !!error}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Menyimpan...
                  </>
                ) : 'Simpan & Mulai Belajar →'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
