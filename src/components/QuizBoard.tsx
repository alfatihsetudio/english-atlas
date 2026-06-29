'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, Trophy, Loader2, AlertTriangle } from 'lucide-react';

interface Question {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

interface QuizBoardProps {
  questions: Question[];
  sessionId: string;
  mode: 'ranked' | 'classic';
  currentPoints: number;
  onComplete: () => void;
  onBack?: () => void;
}

function getRankInfo(points: number) {
  const safePoints = Math.max(0, points);
  if (safePoints >= 7001) return { tier: 'Immortal', win: 10, lose: -40 };
  if (safePoints >= 4001) return { tier: 'Advanced', win: 10, lose: -20 };
  if (safePoints >= 2001) return { tier: 'Intermediate', win: 10, lose: -10 };
  if (safePoints >= 501) return { tier: 'Elementary', win: 10, lose: -5 };
  return { tier: 'Rookie', win: 10, lose: 0 };
}

export default function QuizBoard({ questions, sessionId, mode, currentPoints, onComplete, onBack }: QuizBoardProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: number; wrong: number; pointChange: number; newPoints: number } | null>(null);
  const [derankedTier, setDerankedTier] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(true);

  // Secure server-provided data retrieved post-submission
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [explanations, setExplanations] = useState<string[]>([]);

  const handleOptionSelect = (qIndex: number, option: string) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: option }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert('Mohon jawab semua pertanyaan terlebih dahulu.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mengirimkan kuis.');
      }

      const res = await response.json();

      setResult({
        correct: res.correct,
        wrong: res.wrong,
        pointChange: res.pointChange,
        newPoints: res.newPoints
      });
      setDerankedTier(res.derankedTier || null);
      setCorrectAnswers(res.correctAnswers || []);
      setExplanations(res.explanations || []);
      
      setIsSubmitted(true);
      setShowResultModal(true);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses kuis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' || 
        (e.ctrlKey && e.key === 'p') || 
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5' || e.key === 's'))
      ) {
        e.preventDefault();
        alert('Fitur screenshot tidak diizinkan di mode ini.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allAnswered = Object.keys(answers).length === questions.length;

  return (
    <div 
      className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 select-none"
      onCopy={(e) => { e.preventDefault(); alert('Teks tidak bisa disalin!'); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      
      {/* Header Info (Sticky) */}
      <div className="sticky top-4 z-30 mb-8 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-3xl p-5 shadow-2xl flex items-center justify-between">
        {onBack ? (
          <button onClick={onBack} className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors shrink-0 text-zinc-300">
            <ArrowLeft size={16} />
          </button>
        ) : (
          <div className="w-10" />
        )}
        
        <div className="text-center flex-1">
          <div className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs mb-1">
            {mode === 'ranked' ? '🏆 Ranked Match' : '🎮 Practice Match'}
          </div>
          {mode === 'ranked' && (
            <div className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center justify-center gap-2">
              <span>Current Tier:</span>
              <span className="text-indigo-400 font-extrabold">{getRankInfo(currentPoints).tier}</span>
            </div>
          )}
        </div>
        
        <div className="w-10" />
      </div>

      {/* Pertanyaan */}
      {questions.map((q, idx) => (
        <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-8 h-8 bg-zinc-800 text-zinc-300 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border border-zinc-700">
              {idx + 1}
            </div>
            <h3 className="font-bold text-white text-base sm:text-lg leading-relaxed">{q.question}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {['a', 'b', 'c', 'd'].map((opt) => {
              const optionText = q[`option_${opt}` as keyof Question] || (q as any)[`option_${opt}`];
              const isSelected = answers[idx] === opt;
              const isCorrectOpt = isSubmitted && correctAnswers[idx] === opt;
              
              let styleClass = "border-zinc-800 bg-zinc-950 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300";
              
              if (isSelected && !isSubmitted) {
                styleClass = "border-indigo-500 bg-indigo-950/40 text-white shadow-inner shadow-indigo-500/20";
              } else if (isSubmitted) {
                if (isCorrectOpt) {
                  styleClass = "border-green-500/40 bg-green-950/30 text-green-300";
                } else if (isSelected && !isCorrectOpt) {
                  styleClass = "border-red-500/40 bg-red-950/30 text-red-300";
                } else {
                  styleClass = "border-zinc-950 bg-zinc-950/50 text-zinc-600 opacity-50";
                }
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect(idx, opt)}
                  disabled={isSubmitted}
                  className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-300 flex items-center gap-3 group font-bold ${styleClass}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs transition-colors uppercase
                    ${isSubmitted && isCorrectOpt ? 'bg-green-500 text-zinc-950' : 
                      isSubmitted && isSelected && !isCorrectOpt ? 'bg-red-500 text-white' : 
                      'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}`}>
                    {opt}
                  </div>
                  <span className="flex-1 text-sm leading-snug">{optionText}</span>
                  
                  {isSubmitted && isCorrectOpt && (
                    <CheckCircle2 className="absolute right-4 text-green-500 w-5 h-5 shrink-0" />
                  )}
                  {isSubmitted && isSelected && !isCorrectOpt && (
                    <XCircle className="absolute right-4 text-red-500 w-5 h-5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation shown after submission */}
          {isSubmitted && correctAnswers[idx] && (
            <div className={`mt-4 p-5 rounded-2xl text-xs sm:text-sm border ${
              answers[idx] === correctAnswers[idx] 
                ? 'bg-green-950/20 border-green-900/40 text-green-200' 
                : 'bg-red-950/20 border-red-900/40 text-red-200'
            }`}>
              <div className="font-black mb-2 flex items-center gap-2 uppercase tracking-widest text-[10px] sm:text-xs">
                {answers[idx] === correctAnswers[idx] ? (
                  <><CheckCircle2 size={16} className="text-green-500" /> JAWABAN BENAR</>
                ) : (
                  <><XCircle size={16} className="text-red-500" /> JAWABAN SALAH</>
                )}
              </div>
              <p className="opacity-90 leading-relaxed font-medium">{explanations[idx]}</p>
            </div>
          )}
        </div>
      ))}

      {/* Submit Action */}
      {!isSubmitted ? (
        <div className="sticky bottom-4 z-10 flex justify-center mt-8 p-4">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl transition-all duration-300 ${
              allAnswered 
                ? 'bg-zinc-100 hover:bg-white text-zinc-950 cursor-pointer hover:scale-105 shadow-zinc-900/50' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
            }`}
          >
            {isSubmitting ? (
              <><Loader2 className="animate-spin w-4 h-4" /> Memvalidasi...</>
            ) : (
              <><Trophy size={16} /> Kirim & Lihat Hasil</>
            )}
          </button>
        </div>
      ) : (
        !showResultModal && (
          <div className="sticky bottom-4 z-10 flex justify-center mt-8 p-4">
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm bg-zinc-100 hover:bg-white text-zinc-950 hover:scale-105 shadow-xl shadow-zinc-900/50 transition-all duration-300"
            >
              Selesai Tinjau <ArrowRight size={16} />
            </button>
          </div>
        )
      )}

      {isSubmitted && showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-500">
            <Trophy size={64} className="mx-auto text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" />
            <h2 className="text-3xl font-black mb-2 text-white uppercase tracking-wider">Selesai!</h2>
            <div className="flex items-center justify-center gap-4 mb-6 text-zinc-400 font-bold uppercase tracking-wider text-xs">
              <span className="flex items-center gap-1"><CheckCircle2 className="text-green-500" size={16} /> {result?.correct} Benar</span>
              <span className="flex items-center gap-1"><XCircle className="text-red-500" size={16} /> {result?.wrong} Salah</span>
            </div>
            
            {mode === 'ranked' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-8">
                <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Perubahan Poin</div>
                <div className={`text-3xl font-black ${
                  (result?.pointChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(result?.pointChange || 0) > 0 ? '+' : ''}{result?.pointChange}
                </div>
                <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mt-2">
                  Total Poin: {result?.newPoints}
                </div>
              </div>
            )}

            {derankedTier && (
              <div className="bg-red-950/40 border border-red-900/50 rounded-2xl p-4 mb-8 text-red-200">
                <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
                <h3 className="font-black text-sm uppercase tracking-wider mb-1">Rank Turun!</h3>
                <p className="text-xs opacity-90 leading-relaxed">
                  Anda telah turun ke <strong>{derankedTier}</strong>. Jangan menyerah, ayo raih kembali posisi Anda!
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-100 font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-zinc-800 uppercase tracking-widest text-[10px]"
              >
                Tinjau Jawaban
              </button>
              <button
                onClick={onComplete}
                className="w-full py-3.5 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-zinc-950/50 uppercase tracking-widest text-[10px]"
              >
                Kembali ke Lobi <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
