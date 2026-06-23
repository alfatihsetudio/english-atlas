'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, LayoutDashboard, ChevronDown, Camera, Loader2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserMenuProps {
  user: any;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  onLogout: () => void;
  onAdminClick: () => void;
  onAvatarUpdate: (url: string) => void;
  onUsernameUpdate?: (username: string) => void;
}

export default function UserMenu({ user, username, avatarUrl, isAdmin, onLogout, onAdminClick, onAvatarUpdate, onUsernameUpdate }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsEditingUsername(false);
      }
    };
    document.addEventListener('mousedown', handler, { capture: true });
    return () => document.removeEventListener('mousedown', handler, { capture: true });
  }, []);

  const displayName = username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayAvatar = avatarUrl || user?.user_metadata?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  // Sync tempUsername when displayName changes
  useEffect(() => {
    setTempUsername(displayName);
  }, [displayName]);

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

  const handleSaveUsername = async () => {
    const trimmed = tempUsername.trim();
    if (!trimmed) {
      alert('Username tidak boleh kosong!');
      return;
    }
    if (trimmed === displayName) {
      setIsEditingUsername(false);
      return;
    }
    try {
      setUpdatingUsername(true);
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny
        .from('profiles')
        .update({ username: trimmed })
        .eq('id', user.id);

      if (error) throw error;
      
      if (onUsernameUpdate) {
        onUsernameUpdate(trimmed);
      }
      setIsEditingUsername(false);
      alert('Username berhasil diperbarui!');
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah username');
    } finally {
      setUpdatingUsername(false);
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
          {displayName}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[180px] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
          style={{ animation: 'dropdownFade 0.15s ease-out' }}
        >
          {/* User info header */}
          <div className="px-3 py-3.5 bg-slate-50 border-b border-slate-100 relative">
            <div className="flex flex-col items-center gap-2">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-lg shadow-md shrink-0 border-2 border-white">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                {/* Upload overlay */}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
                </div>
                {/* Always-visible camera badge */}
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center border border-white shadow-md text-white transition-transform group-hover:scale-110">
                  {uploading ? <Loader2 size={9} className="animate-spin" /> : <Camera size={9} />}
                </div>
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold underline -mt-1 select-none"
              >
                Ubah Foto Profil
              </button>

              <div className="text-center w-full min-w-0 flex flex-col items-center">
                {isEditingUsername ? (
                  <div className="flex items-center gap-1 mt-1 w-full px-1">
                    <input
                      type="text"
                      value={tempUsername}
                      onChange={(e) => setTempUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveUsername();
                        if (e.key === 'Escape') { setIsEditingUsername(false); setTempUsername(displayName); }
                      }}
                      disabled={updatingUsername}
                      className="flex-grow bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-800 outline-none focus:border-indigo-500 font-semibold text-center w-full min-w-0"
                      placeholder="Username baru"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveUsername}
                      disabled={updatingUsername}
                      className="p-0.5 bg-green-50 hover:bg-green-100 text-green-600 rounded transition-colors border border-green-100 shrink-0"
                      title="Simpan"
                    >
                      {updatingUsername ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                    </button>
                    <button
                      onClick={() => { setIsEditingUsername(false); setTempUsername(displayName); }}
                      disabled={updatingUsername}
                      className="p-0.5 bg-red-50 hover:bg-red-100 text-red-500 rounded transition-colors border border-red-100 shrink-0"
                      title="Batal"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center justify-center gap-1 group/name cursor-pointer mt-0.5 hover:text-indigo-600 transition-colors w-full px-1" 
                    onClick={() => setIsEditingUsername(true)}
                    title="Klik untuk ubah username"
                  >
                    <p className="font-extrabold text-slate-800 text-sm truncate max-w-[120px] group-hover/name:text-indigo-600">{displayName}</p>
                    <Edit2 size={10} className="text-slate-400 opacity-60 group-hover/name:opacity-100 group-hover/name:text-indigo-600 transition-all shrink-0" />
                  </div>
                )}
                <p className="text-[10px] text-slate-400 truncate mt-0.5 w-full">{user?.email}</p>
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
          <div className="py-1">
            {isAdmin && (
              <button
                onClick={() => { onAdminClick(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50 transition-colors font-semibold"
              >
                <LayoutDashboard size={14} />
                Dashboard Admin
              </button>
            )}
            <div className="mx-2 border-t border-slate-100 my-1" />
            <button
              onClick={() => { onLogout(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors font-semibold"
            >
              <LogOut size={14} />
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
