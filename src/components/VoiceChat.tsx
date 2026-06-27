'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import agoraClient from '@/lib/agora';

interface VoiceChatProps {
  /** Unique name for the voice channel (use roomCode) */
  channelName: string;
  /** A numeric UID derived from the user; Agora requires number or null for auto-assign */
  uid?: number;
}

/**
 * VoiceChat component — integrates Agora RTC voice chat.
 * Auto-joins on mount, auto-leaves on unmount.
 * MUST be rendered with dynamic import + ssr:false.
 */
export default function VoiceChat({ channelName, uid }: VoiceChatProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [remoteCount, setRemoteCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const localTrackRef = useRef<any>(null);
  const remoteAudioTracksRef = useRef<Map<any, any>>(new Map());
  const isSpeakerMutedRef = useRef(false);

  useEffect(() => {
    isSpeakerMutedRef.current = isSpeakerMuted;
  }, [isSpeakerMuted]);

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    
    // We delay the state update to avoid the setState-in-effect linter warning during early mount
    if (!appId) {
      setTimeout(() => {
        setError('Agora App ID tidak ditemukan.');
        setIsConnecting(false);
      }, 0);
      return;
    }
    if (!channelName) return;

    let active = true;

    async function join() {
      try {
        agoraClient.on('user-published', async (user: any, mediaType: string) => {
          await agoraClient.subscribe(user, mediaType);
          if (mediaType === 'audio') {
            remoteAudioTracksRef.current.set(user.uid, user.audioTrack);
            if (!isSpeakerMutedRef.current) {
              user.audioTrack?.play();
            }
            if (active) setRemoteCount((c) => c + 1);
          }
        });

        agoraClient.on('user-unpublished', (user: any, mediaType: string) => {
          if (mediaType === 'audio') {
            remoteAudioTracksRef.current.delete(user.uid);
            if (active) setRemoteCount((c) => Math.max(0, c - 1));
          }
        });

        agoraClient.on('user-left', (user: any) => {
          remoteAudioTracksRef.current.delete(user.uid);
          if (active) setRemoteCount((c) => Math.max(0, c - 1));
        });

        const res = await fetch('/api/agora-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, uid: uid ?? 0 })
        });
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengambil token dari server');
        }

        await agoraClient.join(appId as string, channelName, data.token, data.uid);

        const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTrackRef.current = micTrack;
        await agoraClient.publish([micTrack]);

        if (active) {
          setIsJoined(true);
          setIsConnecting(false);
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

    // Store the ref in a variable to satisfy exhaustive-deps for cleanup function
    const tracksMap = remoteAudioTracksRef.current;

    return () => {
      active = false;
      localTrackRef.current?.stop();
      localTrackRef.current?.close();
      agoraClient.leave().catch(() => {});
      tracksMap.clear();
      agoraClient.removeAllListeners();
    };
  }, [channelName, uid]);

  const toggleMic = async () => {
    if (!localTrackRef.current || !isJoined) return;
    const next = !isMicMuted;
    await localTrackRef.current.setEnabled(!next);
    setIsMicMuted(next);
  };

  const toggleSpeaker = () => {
    if (!isJoined) return;
    const next = !isSpeakerMuted;
    setIsSpeakerMuted(next);
    isSpeakerMutedRef.current = next;

    remoteAudioTracksRef.current.forEach((track) => {
      if (!track) return;
      if (next) {
        track.stop();
      } else {
        track.play();
      }
    });
  };

  const micDisabled = !isJoined;
  const speakerDisabled = !isJoined;

  return (
    <div className="flex items-center gap-2">

      {isJoined && remoteCount > 0 && (
        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <Volume2 size={11} className="text-green-400 animate-pulse" />
          <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">{remoteCount}</span>
        </div>
      )}

      <button
        onClick={toggleSpeaker}
        disabled={speakerDisabled}
        title={
          isConnecting ? 'Menghubungkan...' :
          error ? 'Voice tidak tersedia' :
          isSpeakerMuted ? 'Nyalakan Speaker' : 'Matikan Speaker'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
          speakerDisabled
            ? 'bg-zinc-900/40 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
            : isSpeakerMuted
              ? 'bg-orange-950/40 border-orange-900/50 text-orange-400 hover:bg-orange-950/60'
              : 'bg-zinc-900/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-600'
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
          {isConnecting ? 'VC...' : error ? 'Error' : isSpeakerMuted ? 'Bisu' : 'Dengar'}
        </span>
      </button>

      <button
        onClick={toggleMic}
        disabled={micDisabled}
        title={
          isConnecting ? 'Menghubungkan...' :
          error ? 'Voice tidak tersedia' :
          isMicMuted ? 'Nyalakan Mikrofon' : 'Matikan Mikrofon'
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
          micDisabled
            ? 'bg-zinc-900/40 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
            : isMicMuted
              ? 'bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-950/60'
              : 'bg-green-950/30 border-green-900/40 text-green-400 hover:bg-green-950/50'
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
          {isConnecting ? 'VC...' : error ? 'Error' : isMicMuted ? 'Bisu' : 'Aktif'}
        </span>
      </button>

    </div>
  );
}
