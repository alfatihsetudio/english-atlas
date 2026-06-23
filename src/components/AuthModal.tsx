'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2 } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Initialize Google Identity Services
  useEffect(() => {
    if (!clientId) return;

    const handleCredentialResponse = async (response: any) => {
      setGoogleLoading(true);
      setError(null);
      try {
        const { error: authError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        });
        if (authError) throw authError;
        onClose();
      } catch (err: any) {
        setError(err.message || 'Gagal login dengan Google.');
        setGoogleLoading(false);
      }
    };

    const initGoogleGsi = () => {
      if (typeof window !== 'undefined' && (window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const btnElem = document.getElementById('google-signin-button');
        if (btnElem) {
          (window as any).google.accounts.id.renderButton(
            btnElem,
            { 
              theme: 'outline', 
              size: 'medium', 
              text: 'continue_with',
              shape: 'pill',
              width: 200, 
            }
          );
        }
      }
    };

    const scriptId = 'google-gsi-client';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      script.onload = initGoogleGsi;
      document.body.appendChild(script);
    } else {
      initGoogleGsi();
    }
  }, [clientId, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-[240px] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
        style={{ animation: 'slideUpFade 0.2s ease-out' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-10 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
        >
          <X size={13} />
        </button>

        {/* Header */}
        <div className="px-4 pt-6 pb-2.5 text-center">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            English Atlas
          </h2>
          <p className="text-slate-500 text-[10px] mt-1 leading-relaxed">
            Login untuk mengakses lebih banyak fitur.
          </p>
        </div>

        {/* Body */}
        <div className="px-4 pb-6 flex flex-col items-center">
          {clientId ? (
            <div className="w-full flex flex-col items-center">
              {googleLoading && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
                  <Loader2 size={12} className="animate-spin text-indigo-500" />
                  Menghubungkan...
                </div>
              )}
              
              {/* Check if origin is secure (localhost or HTTPS) */}
              {typeof window !== 'undefined' && 
               window.location.protocol !== 'https:' && 
               window.location.hostname !== 'localhost' && 
               window.location.hostname !== '127.0.0.1' ? (
                <div className="text-center p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-[9px] leading-normal font-medium">
                  Login Google memerlukan koneksi aman (HTTPS). Silakan akses versi Vercel atau gunakan HTTPS tunnel (ngrok).
                </div>
              ) : (
                /* Google Native Button */
                <div 
                  id="google-signin-button" 
                  className={`w-full flex justify-center ${googleLoading ? 'opacity-50 pointer-events-none' : ''}`} 
                />
              )}
            </div>
          ) : (
            <div className="text-center p-2 bg-red-50 border border-red-100 rounded-lg text-red-700 text-[9px]">
              Google Client ID belum dikonfigurasi di sistem.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="w-full mt-3 p-2 bg-red-50 text-red-600 text-[9px] rounded-md border border-red-100 text-center leading-relaxed">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
