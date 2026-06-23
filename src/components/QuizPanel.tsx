'use client';

import { useState, useCallback } from 'react';
import { Loader2, Sparkles, RefreshCw, CheckCircle2, XCircle, Trophy, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string; // 'A', 'B', 'C', or 'D'
}

interface QuizPanelProps {
  nodeContent: string; // concatenated content from the node to send to the API
  nodeTitle: string;
}

type QuizState = 'idle' | 'loading' | 'playing' | 'submitted';

export default function QuizPanel({ nodeContent, nodeTitle }: QuizPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const score = questions.reduce((acc, q, i) => {
    return acc + (userAnswers[i] === q.answer ? 1 : 0);
  }, 0);

  const handleGenerateQuiz = useCallback(async () => {
    setQuizState('loading');
    setQuestions([]);
    setUserAnswers({});
    setError(null);

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeContent }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat soal.');

      setQuestions(data.quiz);
      setQuizState('playing');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
      setQuizState('idle');
    }
  }, [nodeContent]);

  const handleSelectAnswer = (questionIndex: number, letter: string) => {
    if (quizState === 'submitted') return;
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: letter }));
  };

  const handleSubmit = () => {
    if (Object.keys(userAnswers).length < questions.length) {
      alert(`Harap jawab semua ${questions.length} soal terlebih dahulu!`);
      return;
    }
    setQuizState('submitted');
  };

  const handleRetry = () => {
    setUserAnswers({});
    setQuizState('playing');
  };

  const handleReset = () => {
    setQuizState('idle');
    setQuestions([]);
    setUserAnswers({});
    setError(null);
  };

  // Extract letter from option string like "A. text" → "A"
  const getLetter = (option: string) => option.charAt(0);

  const getScoreColor = () => {
    const pct = score / questions.length;
    if (pct >= 0.8) return 'text-green-600';
    if (pct >= 0.6) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getScoreEmoji = () => {
    const pct = score / questions.length;
    if (pct === 1) return '🏆';
    if (pct >= 0.8) return '🌟';
    if (pct >= 0.6) return '👍';
    return '📚';
  };

  return (
    <div className={`mt-3 border rounded-2xl overflow-hidden transition-all duration-300 ${
      isOpen 
        ? 'border-indigo-200 shadow-xl shadow-indigo-100/40 bg-white' 
        : 'border-indigo-100 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/30 bg-gradient-to-br from-white to-indigo-50/20'
    }`}>
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 transition-all hover:bg-indigo-50/30"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 animate-pulse">
            <span className="text-white text-lg">🎯</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <div className="font-extrabold text-sm sm:text-base text-slate-800">Quiz Interaktif AI</div>
              <span className="hidden sm:inline-block text-[10px] tracking-wider font-extrabold px-2 py-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 text-white rounded-full">
                TANTANGAN
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">Uji pemahaman {nodeTitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {quizState === 'submitted' && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white border-2 ${getScoreColor()} border-current shadow-sm`}>
              Skor: {score}/{questions.length}
            </span>
          )}
          <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all duration-300 transform active:scale-95 ${
            isOpen 
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 hover:shadow-lg'
          }`}>
            <span>{isOpen ? 'Tutup' : 'Mulai Quiz'}</span>
            {isOpen ? <ChevronUp size={14} className="animate-bounce" /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {/* Quiz Content */}
      {isOpen && (
        <div className="px-5 pb-5 space-y-4">
          <div className="h-[1px] bg-indigo-100/60 -mx-5 mb-2" />

          {/* IDLE STATE */}
          {quizState === 'idle' && (
            <div className="text-center py-6 px-4 bg-gradient-to-b from-indigo-50/30 to-transparent rounded-2xl border border-dashed border-indigo-100">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Sparkles size={22} className="text-indigo-600 animate-pulse" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-800 mb-1">Siap untuk tantangan?</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                AI akan merancang 5 soal pilihan ganda khusus untuk menguji pemahaman materi <strong className="text-indigo-600">{nodeTitle}</strong>.
              </p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                  {error}
                </div>
              )}
              <button
                onClick={handleGenerateQuiz}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <Sparkles size={16} />
                Mulai Quiz Sekarang
              </button>
            </div>
          )}

          {/* LOADING STATE */}
          {quizState === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 size={36} className="animate-spin text-indigo-600" />
                <div className="absolute inset-0 flex items-center justify-center text-xs">✨</div>
              </div>
              <p className="text-sm font-bold text-slate-700 animate-pulse">AI sedang merancang soal...</p>
              <p className="text-xs text-slate-400">Menganalisis materi {nodeTitle} untuk membuat pertanyaan yang tepat.</p>
            </div>
          )}

          {/* PLAYING & SUBMITTED STATE */}
          {(quizState === 'playing' || quizState === 'submitted') && questions.length > 0 && (
            <div className="space-y-6">

              {/* Score banner (submitted only) */}
              {quizState === 'submitted' && (
                <div className={`p-5 rounded-2xl text-center border-2 shadow-sm transition-all duration-500 ${
                  score === questions.length
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200 shadow-green-100/40'
                    : score >= questions.length * 0.6
                    ? 'bg-gradient-to-br from-yellow-50 to-amber-50/50 border-yellow-200 shadow-yellow-100/40'
                    : 'bg-gradient-to-br from-red-50 to-orange-50/50 border-red-200 shadow-red-100/40'
                }`}>
                  <div className="text-4xl mb-2 animate-bounce">{getScoreEmoji()}</div>
                  <div className={`text-3xl font-black mb-1 tracking-tight ${getScoreColor()}`}>
                    {score} / {questions.length}
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">
                    {score === questions.length
                      ? 'SEMPURNA! Kamu luar biasa!'
                      : score >= questions.length * 0.6
                      ? 'KERJA BAGUS! Sedikit lagi menuju sempurna.'
                      : 'Coba lagi! Belajar adalah proses.'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {score === questions.length
                      ? 'Kamu telah menguasai semua aspek dari materi ini.'
                      : score >= questions.length * 0.6
                      ? 'Periksa jawaban yang salah di bawah untuk meningkatkan pemahamanmu.'
                      : 'Yuk baca lagi materinya dan coba lagi.'}
                  </p>
                </div>
              )}

              {/* Questions */}
              <div className="space-y-4">
                {questions.map((q, qi) => {
                  const selected = userAnswers[qi];
                  const isCorrect = selected === q.answer;

                  return (
                    <div key={qi} className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                      quizState === 'submitted'
                        ? isCorrect
                          ? 'border-green-200 bg-green-50/10 shadow-sm shadow-green-50'
                          : 'border-red-200 bg-red-50/10 shadow-sm shadow-red-50'
                        : 'border-slate-100 bg-white hover:border-indigo-100 hover:shadow-md hover:shadow-slate-100/50'
                    }`}>
                      {/* Question header */}
                      <div className="px-4 py-3.5 border-b border-inherit flex items-start gap-3 bg-slate-50/50">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          quizState === 'submitted'
                            ? isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            : 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                        }`}>
                          {qi + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                      </div>

                      {/* Options */}
                      <div className="p-4 grid grid-cols-1 gap-2.5 bg-white">
                        {q.options.map((opt) => {
                          const letter = getLetter(opt);
                          const isSelected = selected === letter;
                          const isAnswer = q.answer === letter;

                          let optClass = 'border-slate-100 bg-slate-50/30 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40';

                          if (quizState === 'submitted') {
                            if (isAnswer) {
                              optClass = 'border-green-500 bg-green-50 text-green-900 font-bold shadow-sm';
                            } else if (isSelected && !isAnswer) {
                              optClass = 'border-red-400 bg-red-50/60 text-red-700 line-through opacity-70';
                            } else {
                              optClass = 'border-slate-100 bg-white text-slate-400 opacity-60';
                            }
                          } else if (isSelected) {
                            optClass = 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold shadow-sm shadow-indigo-50';
                          }

                          return (
                            <button
                              key={letter}
                              onClick={() => handleSelectAnswer(qi, letter)}
                              disabled={quizState === 'submitted'}
                              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left text-xs sm:text-sm transition-all duration-200 active:scale-[0.99] disabled:cursor-default ${optClass}`}
                            >
                              {/* Letter badge */}
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 transition-colors ${
                                quizState === 'submitted' && isAnswer
                                  ? 'bg-green-600 text-white'
                                  : quizState === 'submitted' && isSelected && !isAnswer
                                  ? 'bg-red-500 text-white'
                                  : isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white border border-slate-200 text-slate-500'
                              }`}>
                                {letter}
                              </span>
                              <span className="leading-relaxed flex-1">{opt.substring(3)}</span>

                              {/* Status icon */}
                              {quizState === 'submitted' && isAnswer && (
                                <CheckCircle2 size={18} className="text-green-600 shrink-0 ml-2" />
                              )}
                              {quizState === 'submitted' && isSelected && !isAnswer && (
                                <XCircle size={18} className="text-red-500 shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex gap-2 flex-1 min-w-[200px]">
                  {quizState === 'playing' && (
                    <button
                      onClick={handleSubmit}
                      disabled={Object.keys(userAnswers).length < questions.length}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-100 disabled:shadow-none transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed"
                    >
                      <Trophy size={16} />
                      Cek Jawaban ({Object.keys(userAnswers).length}/{questions.length})
                    </button>
                  )}

                  {quizState === 'submitted' && (
                    <button
                      onClick={handleRetry}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50/50 font-bold text-sm rounded-xl transition-all active:scale-95"
                    >
                      <RotateCcw size={15} />
                      Coba Lagi
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={(quizState as string) === 'loading'}
                    className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className="animate-spin-hover" />
                    Soal Baru
                  </button>

                  {quizState === 'submitted' && (
                    <button
                      onClick={handleReset}
                      className="px-4 py-3 text-slate-400 hover:text-slate-600 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
