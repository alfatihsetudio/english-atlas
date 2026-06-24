'use client';

import React, { useState, useEffect } from 'react';
import { calculateNewPoints, getRankInfo } from '@/utils/rankSystem';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, XCircle, ArrowRight, Trophy, Loader2, AlertTriangle } from 'lucide-react';

interface Question {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
}

interface QuizBoardProps {
  questions: Question[];
  mode: 'ranked' | 'classic';
  currentPoints: number;
  onComplete: () => void;
}

export default function QuizBoard({ questions, mode, currentPoints, onComplete }: QuizBoardProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: number; wrong: number; pointChange: number; newPoints: number } | null>(null);
  const [derankedTier, setDerankedTier] = useState<string | null>(null);

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

    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    let newPoints = currentPoints;
    let pointChange = 0;

    if (mode === 'ranked') {
      // Hitung perubahan poin satu per satu sesuai dengan tier saat ini untuk akurasi
      const oldRank = getRankInfo(currentPoints);
      
      let tempPoints = currentPoints;
      questions.forEach((q, idx) => {
        const isCorrect = answers[idx] === q.correct_answer;
        tempPoints = calculateNewPoints(tempPoints, isCorrect);
      });
      newPoints = tempPoints;
      pointChange = newPoints - currentPoints;

      const newRank = getRankInfo(newPoints);
      if (newPoints < currentPoints && newRank.minPoints < oldRank.minPoints) {
        setDerankedTier(newRank.tier);
      }

      // Update database
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('highest_rank_points')
          .eq('id', user.id)
          .single();

        const currentHighest = (profileData as any)?.highest_rank_points || 0;
        const newHighest = Math.max(currentHighest, newPoints);

        await (supabase.from('profiles') as any)
          .update({ 
            rank_points: newPoints,
            highest_rank_points: newHighest
          })
          .eq('id', user.id);
      }
    }

    setResult({ correct: correctCount, wrong: wrongCount, pointChange, newPoints });
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  useEffect(() => {
    // Attempt to prevent some shortcut keys for screenshot (e.g. PrintScreen, Ctrl+P, Mac shortcuts)
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
      
      {/* Pertanyaan */}
      {questions.map((q, idx) => (
        <div key={idx} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center font-bold">
              {idx + 1}
            </div>
            <h3 className="font-medium text-lg leading-relaxed">{q.question}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {['a', 'b', 'c', 'd'].map((opt) => {
              const optionText = q[`option_${opt}` as keyof Question];
              const isSelected = answers[idx] === opt;
              const isCorrectOpt = q.correct_answer === opt;
              
              let styleClass = "border-gray-700 bg-gray-900 hover:bg-gray-700 hover:border-gray-500 text-gray-300";
              
              if (isSelected && !isSubmitted) {
                styleClass = "border-indigo-500 bg-indigo-900/40 text-white shadow-inner shadow-indigo-500/20";
              } else if (isSubmitted) {
                if (isCorrectOpt) {
                  styleClass = "border-green-500 bg-green-900/40 text-white";
                } else if (isSelected && !isCorrectOpt) {
                  styleClass = "border-red-500 bg-red-900/40 text-white";
                } else {
                  styleClass = "border-gray-800 bg-gray-900 text-gray-600 opacity-50";
                }
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect(idx, opt)}
                  disabled={isSubmitted}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${styleClass}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="uppercase font-bold text-sm opacity-50">{opt}.</span>
                    <span className="font-medium">{optionText}</span>
                  </div>
                  
                  {isSubmitted && isCorrectOpt && (
                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={20} />
                  )}
                  {isSubmitted && isSelected && !isCorrectOpt && (
                    <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" size={20} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation shown after submission */}
          {isSubmitted && (
            <div className={`mt-4 p-4 rounded-xl text-sm border ${
              answers[idx] === q.correct_answer 
                ? 'bg-green-900/20 border-green-800/50 text-green-200' 
                : 'bg-red-900/20 border-red-800/50 text-red-200'
            }`}>
              <div className="font-bold mb-1 flex items-center gap-2">
                {answers[idx] === q.correct_answer ? (
                  <><CheckCircle2 size={16} /> Benar!</>
                ) : (
                  <><XCircle size={16} /> Salah.</>
                )}
              </div>
              <p className="opacity-90 leading-relaxed">{q.explanation}</p>
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
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-900/50 transition-all ${
              allAnswered 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-105 hover:from-indigo-500 hover:to-purple-500 text-white cursor-pointer' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }`}
          >
            {isSubmitting ? (
              <><Loader2 className="animate-spin" size={24} /> Menghitung Hasil...</>
            ) : (
              <><Trophy size={24} /> Kirim & Lihat Hasil</>
            )}
          </button>
        </div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-500">
            <Trophy size={64} className="mx-auto text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
            <h2 className="text-3xl font-bold mb-2 text-white">Selesai!</h2>
            <div className="flex items-center justify-center gap-4 mb-6 text-gray-300">
              <span className="flex items-center gap-1"><CheckCircle2 className="text-green-500" size={18} /> {result?.correct} Benar</span>
              <span className="flex items-center gap-1"><XCircle className="text-red-500" size={18} /> {result?.wrong} Salah</span>
            </div>
            
            {mode === 'ranked' && (
              <div className="bg-gray-800 rounded-2xl p-4 mb-8">
                <div className="text-sm text-gray-400 mb-1">Perubahan Poin</div>
                <div className={`text-3xl font-black ${
                  (result?.pointChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(result?.pointChange || 0) > 0 ? '+' : ''}{result?.pointChange}
                </div>
                <div className="text-xs text-indigo-300 mt-2">
                  Total Poin: {result?.newPoints}
                </div>
              </div>
            )}

            {derankedTier && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-4 mb-8 text-red-200">
                <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
                <h3 className="font-bold text-lg mb-1">Rank Turun!</h3>
                <p className="text-sm opacity-90">
                  Anda telah turun ke <strong>{derankedTier}</strong>. Jangan menyerah, ayo raih kembali posisi Anda!
                </p>
              </div>
            )}

            <button
              onClick={onComplete}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              Kembali ke Lobi <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
