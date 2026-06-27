'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

let globalAlertCallback: ((msg: string) => void) | null = null;

if (typeof window !== 'undefined') {
  window.alert = (message: string) => {
    if (globalAlertCallback) {
      globalAlertCallback(message);
    } else {
      // Fallback to console during initial boot
      console.log("[Alert Fallback]:", message);
    }
  };
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    globalAlertCallback = (msg: string) => {
      setAlertMessage(msg);
    };
    return () => {
      globalAlertCallback = null;
    };
  }, []);

  return (
    <>
      {children}

      {/* Premium Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm bg-zinc-900/95 border border-zinc-800 p-6 rounded-2xl shadow-2xl relative flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            style={{ contentVisibility: 'auto' }}
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
              <AlertCircle className="text-amber-400" size={24} />
            </div>
            
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2">Notifikasi</h3>
            <p className="text-sm text-zinc-200 font-medium mb-6 leading-relaxed whitespace-pre-line">
              {alertMessage}
            </p>
            
            <button
              onClick={() => setAlertMessage(null)}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-200 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
            >
              Oke
            </button>
          </div>
        </div>
      )}
    </>
  );
}
