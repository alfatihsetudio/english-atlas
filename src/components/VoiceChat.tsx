'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, WifiOff } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IAgoraRTCClient = any;

interface VoiceChatProps {
  /** Unique name for the voice channel (use roomCode) */
  channelName: string;
  /** A numeric UID derived from the user; Agora requires number or null for auto-assign */
  uid?: number;
}

/**
 * VoiceChat component — integrates Agora RTC voice chat.
 * Creates a fresh Agora client per component instance to avoid
 * "Client already in connecting/connected state" errors on re-mount.
 * MUST be rendered with dynamic import + ssr:false.
 */
export default function VoiceChat({ channelName, uid }: VoiceChatProps) {
  const [isMicMuted, setIsMicMuted] = useState(true); // default muted until user enables
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [remoteCount, setRemoteCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Create a fresh Agora client per component instance (not a singleton)
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTrackRef = useRef<any>(null);
  const remoteAudioTracksRef = useRef<Map<any, any>>(new Map());
  const isSpeakerMutedRef = useRef(false);

  useEffect(() => {
    isSpeakerMutedRef.current = isSpeakerMuted;
  }, [isSpeakerMuted]);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

    if (!appId) {
      setError('Agora App ID tidak ditemukan.');
      setIsConnecting(false);
      return;
    }
    if (!channelName) return;

    // Always create a fresh client for this component instance
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    let active = true;

    async function join() {
      try {
        client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'audio') {
            remoteAudioTracksRef.current.set(user.uid, user.audioTrack);
            if (!isSpeakerMutedRef.current) {
              user.audioTrack?.play();
            }
            if (active) setRemoteCount((c) => c + 1);
          }
        });

        client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
          if (mediaType === 'audio') {
            remoteAudioTracksRef.current.delete(user.uid);
            if (active) setRemoteCount((c) => Math.max(0, c - 1));
          }
        });

        client.on('user-left', (user: any) => {
          remoteAudioTracksRef.current.delete(user.uid);
          if (active) setRemoteCount((c) => Math.max(0, c - 1));
        });

        // Fetch token from server
        const res = await fetch('/api/agora-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, uid: uid ?? 0 }),
        });
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengambil token dari server');
        }

        // Join the channel
        await client.join(appId as string, channelName, data.token, data.uid);

        if (!active) return;

        setIsJoined(true);
        setIsConnecting(false);

        // Try to auto-create mic — mobile browsers may block this until user gesture
        try {
          const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localTrackRef.current = micTrack;
          await client.publish([micTrack]);
          // Auto-mute by default so user consciously unmutes
          await micTrack.setEnabled(false);
          if (active) setIsMicMuted(true);
        } catch (micErr) {
          console.warn('[VoiceChat] Auto-mic skipped (mobile or no mic):', micErr);
          // Leave isMicMuted=true so user can click to request permission
        }
      } catch (err: any) {
        console.error('[VoiceChat] Error joining:', err);
        if (active) {
          setError(err?.message || 'Gagal join voice channel.');
          setIsConnecting(false);
        }
      }
    }

    join();

    const tracksMap = remoteAudioTracksRef.current;

    return () => {
      active = false;
      try { localTrackRef.current?.stop(); } catch (_) {}
      try { localTrackRef.current?.close(); } catch (_) {}
      localTrackRef.current = null;
      client.leave().catch(() => {});
      client.removeAllListeners();
      tracksMap.clear();
      clientRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, uid]);

  const toggleMic = async () => {
    const client = clientRef.current;
    if (!isJoined || !client) return;

    // If mic track doesn't exist yet (blocked by mobile on auto-join), create on user click
    if (!localTrackRef.current) {
      try {
        const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTrackRef.current = micTrack;
        await client.publish([micTrack]);
        await micTrack.setEnabled(true);
        setIsMicMuted(false);
      } catch (err: any) {
        console.error('[VoiceChat] Mic permission denied:', err);
        alert('Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan browser Anda, lalu muat ulang halaman.');
      }
      return;
    }

    // Track exists — toggle enabled state
    const next = !isMicMuted;
    try {
      await localTrackRef.current.setEnabled(!next);
      setIsMicMuted(next);
    } catch (err) {
      console.error('[VoiceChat] Toggle mic failed:', err);
    }
  };

  const toggleSpeaker = () => {
    if (!isJoined) return;
    const next = !isSpeakerMuted;
    setIsSpeakerMuted(next);
    isSpeakerMutedRef.current = next;

    remoteAudioTracksRef.current.forEach((track) => {
      if (!track) return;
      next ? track.stop() : track.play();
    });
  };

  // Buttons always clickable once connected; disabled only while connecting or on error
  const buttonsDisabled = isConnecting || !!error;

  return (
    <div className="flex items-center gap-2">

      {/* Remote user count indicator */}
      {isJoined && remoteCount > 0 && (
        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <Volume2 size={11} className="text-green-400 animate-pulse" />
          <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">{remoteCount}</span>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-red-950/40 border border-red-900/50">
          <WifiOff size={11} className="text-red-400" />
          <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider hidden sm:inline">VC Error</span>
        </div>
      )}

      {/* Speaker button */}
      <button
        type="button"
        onClick={toggleSpeaker}
        disabled={buttonsDisabled}
        title={
          isConnecting ? 'Menghubungkan...' :
          error ? `Error: ${error}` :
          isSpeakerMuted ? 'Nyalakan Speaker' : 'Matikan Speaker'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 touch-manipulation ${
          buttonsDisabled
            ? 'bg-zinc-900/40 border-zinc-800/50 text-zinc-600 cursor-not-allowed opacity-50'
            : isSpeakerMuted
              ? 'bg-orange-950/40 border-orange-900/50 text-orange-400 active:scale-95'
              : 'bg-zinc-900/60 border-zinc-700/60 text-zinc-300 active:scale-95 active:bg-zinc-800'
        }`}
      >
        {isConnecting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isSpeakerMuted ? (
          <VolumeX size={12} />
        ) : (
          <Volume2 size={12} />
        )}
        <span className="text-[9px] font-bold uppercase tracking-wider hidden sm:inline">
          {isConnecting ? 'VC...' : isSpeakerMuted ? 'Bisu' : 'Dengar'}
        </span>
      </button>

      {/* Mic button */}
      <button
        type="button"
        onClick={toggleMic}
        disabled={buttonsDisabled}
        title={
          isConnecting ? 'Menghubungkan...' :
          error ? `Error: ${error}` :
          isMicMuted ? 'Nyalakan Mikrofon' : 'Matikan Mikrofon'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 touch-manipulation ${
          buttonsDisabled
            ? 'bg-zinc-900/40 border-zinc-800/50 text-zinc-600 cursor-not-allowed opacity-50'
            : isMicMuted
              ? 'bg-red-950/40 border-red-900/50 text-red-400 active:scale-95 active:bg-red-950/60'
              : 'bg-green-950/30 border-green-900/40 text-green-400 active:scale-95 active:bg-green-950/50'
        }`}
      >
        {isConnecting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isMicMuted ? (
          <MicOff size={12} />
        ) : (
          <Mic size={12} />
        )}
        <span className="text-[9px] font-bold uppercase tracking-wider hidden sm:inline">
          {isConnecting ? 'VC...' : isMicMuted ? 'Bisu' : 'Aktif'}
        </span>
      </button>

    </div>
  );
}
