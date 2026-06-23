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
    <div className="mt-2 border border-indigo-100 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50/50 to-white">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-base">🎯</span>
          </div>
          <div className="text-left">
            <div className="font-bold text-sm text-slate-800">Quiz Interaktif</div>
            <div className="text-xs text-slate-500">Uji pemahaman {nodeTitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quizState === 'submitted' && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border ${getScoreColor()} border-current`}>
              {score}/{questions.length}
            </span>
          )}
          {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Quiz Content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4">

          {/* IDLE STATE */}
          {quizState === 'idle' && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500 mb-4">
                AI akan membuat 5 soal pilihan ganda khusus untuk materi <strong>{nodeTitle}</strong>
              </p>
              {error && (
                <div className="mb-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <button
                onClick={handleGenerateQuiz}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-100 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Sparkles size={16} />
                Mulai Quiz
              </button>
            </div>
          )}

          {/* LOADING STATE */}
          {quizState === 'loading' && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm font-medium text-slate-600 animate-pulse">AI sedang membuat soal...</p>
              <p className="text-xs text-slate-400">Menyiapkan 5 pertanyaan dari materi {nodeTitle}</p>
            </div>
          )}

          {/* PLAYING & SUBMITTED STATE */}
          {(quizState === 'playing' || quizState === 'submitted') && questions.length > 0 && (
            <div className="space-y-5">

              {/* Score banner (submitted only) */}
              {quizState === 'submitted' && (
                <div className={`p-4 rounded-xl text-center border-2 ${
                  score === questions.length
                    ? 'bg-green-50 border-green-200'
                    : score >= questions.length * 0.6
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="text-3xl mb-1">{getScoreEmoji()}</div>
                  <div className={`text-2xl font-extrabold mb-1 ${getScoreColor()}`}>
                    {score} / {questions.length}
                  </div>
                  <p className="text-sm text-slate-600">
                    {score === questions.length
                      ? 'Sempurna! Kamu menguasai materi ini.'
                      : score >= questions.length * 0.6
                      ? 'Bagus! Masih ada beberapa yang perlu dipelajari.'
                      : 'Jangan menyerah! Pelajari kembali materinya.'}
                  </p>
                </div>
              )}

              {/* Questions */}
              {questions.map((q, qi) => {
                const selected = userAnswers[qi];
                const isCorrect = selected === q.answer;

                return (
                  <div key={qi} className={`rounded-xl border-2 overflow-hidden transition-all ${
                    quizState === 'submitted'
                      ? isCorrect
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-red-200 bg-red-50/30'
                      : 'border-slate-200 bg-white'
                  }`}>
                    {/* Question header */}
                    <div className="px-3 py-2.5 border-b border-inherit flex items-start gap-2.5 bg-white/60">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        quizState === 'submitted'
                          ? isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {qi + 1}
                      </span>
                      <p className="text-sm font-medium text-slate-800 leading-snug">{q.question}</p>
                    </div>

                    {/* Options */}
                    <div className="p-3 grid grid-cols-1 gap-2">
                      {q.options.map((opt) => {
                        const letter = getLetter(opt);
                        const isSelected = selected === letter;
                        const isAnswer = q.answer === letter;

                        let optClass = 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50';

                        if (quizState === 'submitted') {
                          if (isAnswer) {
                            optClass = 'border-green-400 bg-green-50 text-green-800 font-semibold';
                          } else if (isSelected && !isAnswer) {
                            optClass = 'border-red-300 bg-red-50 text-red-700 line-through opacity-70';
                          } else {
                            optClass = 'border-slate-100 bg-white text-slate-400';
                          }
                        } else if (isSelected) {
                          optClass = 'border-indigo-500 bg-indigo-50 text-indigo-800 font-semibold';
                        }

                        return (
                          <button
                            key={letter}
                            onClick={() => handleSelectAnswer(qi, letter)}
                            disabled={quizState === 'submitted'}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 text-left text-sm transition-all active:scale-[0.99] disabled:cursor-default ${optClass}`}
                          >
                            {/* Letter badge */}
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                              quizState === 'submitted' && isAnswer
                                ? 'bg-green-500 text-white'
                                : quizState === 'submitted' && isSelected && !isAnswer
                                ? 'bg-red-400 text-white'
                                : isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {letter}
                            </span>
                            <span className="leading-snug">{opt.substring(3)}</span>

                            {/* Status icon */}
                            {quizState === 'submitted' && isAnswer && (
                              <CheckCircle2 size={16} className="text-green-500 ml-auto shrink-0" />
                            )}
                            {quizState === 'submitted' && isSelected && !isAnswer && (
                              <XCircle size={16} className="text-red-400 ml-auto shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {quizState === 'playing' && (
                  <button
                    onClick={handleSubmit}
                    disabled={Object.keys(userAnswers).length < questions.length}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Trophy size={16} />
                    Cek Jawaban ({Object.keys(userAnswers).length}/{questions.length})
                  </button>
                )}

                {quizState === 'submitted' && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-sm rounded-xl transition-all"
                  >
                    <RotateCcw size={15} />
                    Coba Lagi
                  </button>
                )}

                <button
                  onClick={handleGenerateQuiz}
                  disabled={(quizState as string) === 'loading'}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold text-sm rounded-xl transition-all disabled:opacity-50"
                >
                  <RefreshCw size={15} />
                  Soal Baru
                </button>

                {quizState === 'submitted' && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-slate-600 text-sm transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
