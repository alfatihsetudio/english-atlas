'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, LayoutDashboard, ChevronDown, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserMenuProps {
  user: any;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  onLogout: () => void;
  onAdminClick: () => void;
  onAvatarUpdate: (url: string) => void;
}

export default function UserMenu({ user, username, avatarUrl, isAdmin, onLogout, onAdminClick, onAvatarUpdate }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, { capture: true });
    return () => document.removeEventListener('mousedown', handler, { capture: true });
  }, []);

  const displayName = username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayAvatar = avatarUrl || user?.user_metadata?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const supabaseAny = supabase as any;
      const { error: updateError } = await supabaseAny
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      onAvatarUpdate(data.publicUrl);
      alert('Foto profil berhasil diperbarui!');
    } catch (error: any) {
      alert(error.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
        title={displayName}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm shadow-sm shrink-0">
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <span className="hidden md:block text-sm font-semibold text-slate-700 max-w-[100px] truncate">
          @{displayName}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
          style={{ animation: 'dropdownFade 0.15s ease-out' }}
        >
          {/* User info header */}
          <div className="px-4 py-4 bg-slate-50 border-b border-slate-100 relative">
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-2xl shadow-md shrink-0 border-2 border-white">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                {/* Upload overlay */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}
                </div>
              </div>
              <div className="text-center w-full min-w-0">
                <p className="font-bold text-slate-800 text-base truncate">@{displayName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            {/* Hidden file input */}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleUpload}
            />
          </div>

          {/* Menu Items */}
          <div className="py-1.5">
            {isAdmin && (
              <button
                onClick={() => { onAdminClick(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 transition-colors font-medium"
              >
                <LayoutDashboard size={16} />
                Dashboard Admin
              </button>
            )}
            <div className="mx-2 border-t border-slate-100 my-1" />
            <button
              onClick={() => { onLogout(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
            >
              <LogOut size={16} />
              Keluar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropdownFade {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
