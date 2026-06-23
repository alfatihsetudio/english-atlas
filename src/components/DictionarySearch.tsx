'use client';

import { useState, useRef } from 'react';
import { Search, X, Volume2, Loader2, BookOpen, ChevronRight } from 'lucide-react';

interface DictionaryResult {
  word: string;
  phonetic: string;
  part_of_speech: string;
  definitions: string[];
  examples: string[];
  synonyms: string[];
}

export default function DictionarySearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setIsOpen(true);

    try {
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: query.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal mencari kata.');
      }

      const data: DictionaryResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayWord = (text: string, partOfSpeech?: string) => {
    if (!window.speechSynthesis) return;
    
    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    } catch (err) {
      console.error('SpeechSynthesis cancel error:', err);
    }

    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        
        let langCode = 'en-US';
        if (partOfSpeech) {
          const pos = partOfSpeech.toLowerCase();
          if (pos.includes('indonesia') || pos.includes('indo') || pos.includes('id-id')) {
            langCode = 'id-ID';
          }
        }
        
        utterance.lang = langCode;
        utterance.rate = 0.8;

        utterance.onerror = (e) => {
          // 'canceled' and 'interrupted' are benign — they fire when cancel() is
          // called before a previous utterance finishes. Ignore them silently.
          if (e.error === 'canceled' || e.error === 'interrupted') return;
          console.error('SpeechSynthesis error:', e.error);
        };

        const speakWithVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.lang === langCode || v.lang.startsWith(langCode.split('-')[0]));
          if (voice) utterance.voice = voice;
          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = speakWithVoice;
        } else {
          speakWithVoice();
        }
      } catch (err) {
        console.error('SpeechSynthesis error:', err);
      }
    }, 200);
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setError(null);
    setQuery('');
  };

  const posBadgeColor: Record<string, string> = {
    noun: 'bg-blue-100 text-blue-700',
    verb: 'bg-green-100 text-green-700',
    adjective: 'bg-purple-100 text-purple-700',
    adverb: 'bg-orange-100 text-orange-700',
    pronoun: 'bg-pink-100 text-pink-700',
    preposition: 'bg-amber-100 text-amber-700',
    conjunction: 'bg-teal-100 text-teal-700',
    interjection: 'bg-red-100 text-red-700',
  };
  const posColor = result
    ? (posBadgeColor[result.part_of_speech?.toLowerCase()] || 'bg-slate-100 text-slate-600')
    : '';

  return (
    <>
      {/* Floating Dictionary Search Bar — bottom left, leaves room for chatbot button */}
      <div className="fixed z-50 bottom-4 left-4 md:left-1/2 md:transform md:-translate-x-1/2 pointer-events-none">
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full shadow-lg px-3 py-2 pointer-events-auto"
          style={{ width: 'calc(100vw - 6rem)', maxWidth: '420px' }}
        >
          <BookOpen size={15} className="text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kamus Inggris Lengkap"
            className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-full"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResult(null); setError(null); setIsOpen(false); }}
              className="text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full p-1.5 transition-all shrink-0"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          </button>
        </form>
      </div>

      {/* Result Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9990] flex items-end md:items-center justify-center p-0 md:p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            style={{ animation: 'slideUpFade 0.2s ease-out', maxHeight: '85vh' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 sticky top-0">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-500" />
                <span className="text-sm font-bold text-slate-700">Kamus Inggris</span>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
              {/* Loading skeleton */}
              {loading && (
                <div className="px-6 py-8 space-y-4">
                  <div className="flex gap-3 items-center">
                    <div className="h-8 w-32 bg-slate-200 rounded-lg animate-pulse" />
                    <div className="h-5 w-20 bg-slate-100 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                  <div className="space-y-2 mt-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${85 - i * 10}%` }} />
                    ))}
                  </div>
                  <div className="space-y-2 mt-4">
                    {[1, 2].map(i => (
                      <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${90 - i * 5}%` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="px-6 py-8 text-center">
                  <div className="text-4xl mb-3">😕</div>
                  <p className="text-slate-600 text-sm">{error}</p>
                  <button
                    onClick={() => handleSearch()}
                    className="mt-4 text-indigo-600 text-sm font-semibold hover:underline"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {/* Result */}
              {result && !loading && (
                <div className="px-6 py-6 space-y-5">
                  {/* Word + phonetic + audio */}
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-3xl font-extrabold text-slate-900 leading-none">
                        {result.word}
                      </h2>
                      {result.part_of_speech && (
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${posColor}`}>
                          {result.part_of_speech}
                        </span>
                      )}
                      <button
                        onClick={() => handlePlayWord(result.word, result.part_of_speech)}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition-colors"
                        title="Dengarkan pengucapan"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                    {result.phonetic && (
                      <p className="font-mono text-slate-500 text-base mt-1 italic">{result.phonetic}</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100" />

                  {/* Definitions */}
                  {result.definitions && result.definitions.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Definisi
                      </h3>
                      <ol className="space-y-2">
                        {result.definitions.map((def, i) => (
                          <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                            <span className="shrink-0 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <span>{def}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Examples */}
                  {result.examples && result.examples.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Contoh Kalimat
                      </h3>
                      <ul className="space-y-2">
                        {result.examples.map((ex, i) => (
                          <li key={i} className="flex gap-2.5 text-sm text-slate-600 italic leading-relaxed">
                            <ChevronRight size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                            <span>"{ex}"</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Synonyms */}
                  {result.synonyms && result.synonyms.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Sinonim
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {result.synonyms.map((syn, i) => (
                          <button
                            key={i}
                            onClick={() => { setQuery(syn); handleSearch(); }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-sm rounded-full transition-colors border border-slate-200 hover:border-indigo-200 font-medium"
                          >
                            {syn}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
