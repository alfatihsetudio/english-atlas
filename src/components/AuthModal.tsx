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

  // Fallback OAuth login (if clientId is not set)
  const handleGoogleLoginFallback = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan Google.');
      setGoogleLoading(false);
    }
  };

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
              {/* Google Native Button */}
              <div 
                id="google-signin-button" 
                className={`w-full flex justify-center ${googleLoading ? 'opacity-50 pointer-events-none' : ''}`} 
              />
            </div>
          ) : (
            /* Fallback button */
            <button
              onClick={handleGoogleLoginFallback}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 rounded-full py-2 px-2.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 size={13} className="animate-spin text-indigo-500" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 18 18" fill="none" className="shrink-0">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9.01 9.01 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}
            </button>
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
