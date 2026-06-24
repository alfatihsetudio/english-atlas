import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, BookOpen, Layers, Lightbulb, List, RefreshCcw } from 'lucide-react';

interface ClassicQuestion {
  question: string;
  translation: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  question_explanation: string;
  options_breakdown: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  reasoning: string;
}

interface ClassicBoardProps {
  questions: ClassicQuestion[];
  currentIdx: number;
  isLoading?: boolean;
  isPrefetching?: boolean;
  onNext: () => void;
  onExit: () => void;
}

export default function ClassicBoard({ questions, currentIdx, isLoading, isPrefetching, onNext, onExit }: ClassicBoardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  if (isLoading || !questions || questions.length === 0) {
    return (
      <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-6 lg:gap-8 items-start animate-pulse">
        {/* Left Column Skeleton */}
        <div className="w-full flex flex-col md:w-5/12 lg:w-1/2">
          {/* Question Skeleton */}
          <div className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-3xl mb-5" />

          {/* Options Skeleton */}
          <div className="w-full flex flex-col gap-3">
            {[1,2,3,4].map(i => <div key={i} className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl" />)}
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="hidden md:flex w-full md:w-7/12 lg:w-1/2 h-full flex-col items-center justify-center pt-20">
          <div className="opacity-30 flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-zinc-700 border-t-zinc-500 rounded-full animate-spin mb-4" />
            <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Menyiapkan Soal Edukasi...</p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback in case currentIdx goes out of bounds while not loading
  if (currentIdx >= questions.length) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 border-4 border-zinc-700 border-t-zinc-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest">Memuat soal berikutnya...</p>
      </div>
    );
  }

  const question = questions[currentIdx];

  const handleSelectOption = (letter: string) => {
    if (showReview) return; // locked
    setSelectedOption(letter);
    setShowReview(true);

    if (letter.toLowerCase() === question.correct_answer.toLowerCase()) {
      setCorrectCount(prev => prev + 1);
    }
  };

  const isWaitingForNext = isPrefetching && currentIdx >= questions.length - 1;

  const handleNextQuestion = () => {
    if (currentIdx >= questions.length - 1 && isPrefetching) return; // Wait for prefetch
    setSelectedOption(null);
    setShowReview(false);
    onNext();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isCorrect = selectedOption === question.correct_answer;

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
      
      {/* Left Column: Question & Options */}
      <div className="w-full flex flex-col md:w-5/12 lg:w-1/2">
        
        {/* Question Card */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative mb-5">
          <h2 className="text-lg sm:text-xl font-black text-white leading-relaxed relative z-10">
            {question.question}
          </h2>
        </div>

        {/* Options */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          {['a', 'b', 'c', 'd'].map((letter) => {
            const optText = question[`option_${letter}` as keyof ClassicQuestion] as string;
            if (!optText) return null;
            
            const isSelected = selectedOption === letter;
            const isCorrectAnswer = letter === question.correct_answer;
            
            let btnClass = 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 cursor-pointer';
            
            if (showReview) {
              btnClass = 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 cursor-default opacity-60'; // disabled state default
              if (isCorrectAnswer) {
                btnClass = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 opacity-100 z-10 shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/50';
              } else if (isSelected && !isCorrectAnswer) {
                btnClass = 'bg-rose-500/10 border-rose-500/50 text-rose-400 opacity-100 ring-1 ring-rose-500/50';
              }
            }

            return (
              <button
                key={letter}
                onClick={() => handleSelectOption(letter)}
                disabled={showReview}
                className={`relative w-full p-3 rounded-2xl border-2 text-left font-bold transition-all duration-300 flex items-center gap-3 group ${btnClass}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs transition-colors uppercase
                  ${showReview && isCorrectAnswer ? 'bg-emerald-500 text-zinc-950' : 
                    showReview && isSelected && !isCorrectAnswer ? 'bg-rose-500 text-white' : 
                    'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}`}>
                  {letter}
                </div>
                <span className="flex-1 text-xs sm:text-sm leading-snug">{optText}</span>
                
                {showReview && isCorrectAnswer && <CheckCircle2 className="text-emerald-500 w-4 h-4 absolute right-3 shrink-0" />}
                {showReview && isSelected && !isCorrectAnswer && <XCircle className="text-rose-500 w-4 h-4 absolute right-3 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Action Buttons (Left Column for efficiency) */}
        {showReview && (
          <div className="w-full mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={onExit}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-widest py-3 sm:py-4 px-4 rounded-xl border border-zinc-800 transition-colors text-xs text-center"
              >
                Kembali ke Dashboard
              </button>
              <button 
                onClick={handleNextQuestion}
                disabled={isWaitingForNext}
                className="flex-1 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-black uppercase tracking-widest py-3 sm:py-4 px-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 text-xs"
              >
                {isWaitingForNext ? 'Memuat...' : 'Lanjut Soal'}
                {!isWaitingForNext && <ArrowRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Review Panel Placeholder or Content */}
      <div className={`w-full md:w-7/12 lg:w-1/2 flex-col ${showReview ? 'flex animate-in slide-in-from-bottom-8 md:slide-in-none duration-500' : 'hidden md:flex'}`}>
        <div className="w-full h-full min-h-[300px] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          
          {!showReview ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 p-10">
              <Layers className="w-12 h-12 text-zinc-500 mb-4 animate-pulse" />
              <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs text-center">Menunggu Jawaban Anda...</p>
            </div>
          ) : (
            <>
              {/* Header Status */}
              <div className="px-5 py-3 flex items-center gap-3 border-b border-zinc-800/50 bg-zinc-900/30 animate-in fade-in slide-in-from-top-4 duration-500">
              {isCorrect ? (
                <>
                  <div className="w-8 h-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-emerald-500 uppercase tracking-widest text-xs">BENAR</div>
                    <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Analisa Akurat</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full border border-rose-500/30 bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-rose-500 uppercase tracking-widest text-xs">SALAH</div>
                    <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Perlu Penyesuaian</div>
                  </div>
                </>
              )}
            </div>

            {/* Review Content */}
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              
              {/* Translation & Context */}
              <div 
                className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80 flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500"
                style={{ animationFillMode: 'both', animationDelay: '150ms' }}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-1.5">
                    <RefreshCcw className="w-3 h-3" /> Translasi
                  </div>
                  <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed font-medium">"{question.translation}"</p>
                </div>
                <div className="w-full h-px bg-zinc-800/50" />
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-1.5">
                    <BookOpen className="w-3 h-3" /> Materi Terkait
                  </div>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">{question.question_explanation}</p>
                </div>
              </div>

              {/* Options Breakdown */}
              <div 
                className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50 animate-in fade-in slide-in-from-top-4 duration-500"
                style={{ animationFillMode: 'both', animationDelay: '300ms' }}
              >
                <div className="flex items-center gap-1.5 text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-3 px-1">
                  <List className="w-3 h-3" /> Bedah Opsi Jawaban
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {['a', 'b', 'c', 'd'].map(letter => {
                    const isAnsCorrect = letter === question.correct_answer;
                    return (
                      <div key={letter} className={`flex gap-3 p-2.5 rounded-lg border ${isAnsCorrect ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
                        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-black uppercase tracking-wider
                          ${isAnsCorrect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                          {letter}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed pt-0.5">
                          {question.options_breakdown[letter as keyof typeof question.options_breakdown]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reasoning (Key Takeaway) */}
              <div 
                className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-4 duration-500"
                style={{ animationFillMode: 'both', animationDelay: '450ms' }}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-1.5">Inti Sari</div>
                  <p className="text-indigo-200 text-xs sm:text-sm font-medium leading-relaxed">{question.reasoning}</p>
                </div>
              </div>

            </div>
          </>
        )}

        </div>
      </div>

    </div>
  );
}
