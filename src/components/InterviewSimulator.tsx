import React, { useState } from 'react';
import { architectQuiz } from '../data/dbSchema';
import { QuizQuestion } from '../types';
import { Award, CheckCircle2, XCircle, ChevronRight, RefreshCw, Sparkles, BookOpen, UserCheck, ShieldAlert } from 'lucide-react';

export default function InterviewSimulator() {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedOptIdx, setSelectedOptIdx] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [answersHistory, setAnswersHistory] = useState<Record<number, { selectedIndex: number; isCorrect: boolean }>>({});
  const [quizComplete, setQuizComplete] = useState<boolean>(false);

  const activeQuestion = architectQuiz[currentIdx];

  const handleOptionSelect = (idx: number) => {
    if (isSubmitted) return;
    setSelectedOptIdx(idx);
  };

  const handleSubmit = () => {
    if (selectedOptIdx === null || isSubmitted) return;

    const isCorrect = selectedOptIdx === activeQuestion.correctAnswerIndex;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnswersHistory(prev => ({
      ...prev,
      [activeQuestion.id]: { selectedIndex: selectedOptIdx, isCorrect }
    }));
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (currentIdx < architectQuiz.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setSelectedOptIdx(null);
      setIsSubmitted(false);
    } else {
      setQuizComplete(true);
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setSelectedOptIdx(null);
    setIsSubmitted(false);
    setScore(0);
    setAnswersHistory({});
    setQuizComplete(false);
  };

  // Calculations for Certifications
  const getCertificationBadge = (sc: number) => {
    if (sc <= 3) return { title: 'Junior Schema Cataloger', color: 'bg-rose-50 border-rose-200 text-rose-800', desc: 'Capable of writing 1NF queries, but needs guidance on lock contentions and composite keys.' };
    if (sc <= 6) return { title: 'Mid-Level SQL Engineer', color: 'bg-amber-50 border-amber-200 text-amber-800', desc: 'Writes normalized 3NF structures and understands index creation. Ready for query optimization training.' };
    if (sc <= 8) return { title: 'Senior DB Systems Architect', color: 'bg-indigo-50 border-indigo-200 text-indigo-800', desc: 'Excellent layout skills. Masters partition scopes, compound GIN index configurations, and audit caching.' };
    return { title: 'Principal Database Architect (Enterprise Certified)', color: 'bg-emerald-50 border-emerald-200 text-emerald-800', desc: 'Perfect architectural leadership! Expertly isolates hot/cold tables, optimizes query plans, and prevents record deadlock contentions.' };
  };

  const badge = getCertificationBadge(score);

  return (
    <div id="interview-simulation" className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full items-start">
      {/* Left side: Questions selector/progress sidebar */}
      {!quizComplete && (
        <div className="xl:col-span-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
          <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider font-bold">Architect Board Exam</span>
          <div className="grid grid-cols-5 xl:grid-cols-2 gap-2">
            {architectQuiz.map((q, idx) => {
              const hist = answersHistory[q.id];
              const isActive = currentIdx === idx;

              let scoreColor = 'border-slate-200 text-slate-500 hover:bg-slate-50';
              if (isActive) scoreColor = 'border-amber-400 bg-amber-50 text-amber-800 font-bold shadow-sm';
              else if (hist) {
                scoreColor = hist.isCorrect 
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold' 
                  : 'border-rose-300 bg-rose-50 text-rose-700 font-semibold';
              }

              return (
                <button
                  id={`quiz-progress-btn-${idx}`}
                  key={idx}
                  onClick={() => {
                    if (isSubmitted || Object.keys(answersHistory).length === idx) {
                      setCurrentIdx(idx);
                      setSelectedOptIdx(answersHistory[q.id]?.selectedIndex ?? null);
                      setIsSubmitted(hist !== undefined);
                    }
                  }}
                  disabled={!isSubmitted && idx !== currentIdx && !answersHistory[q.id]}
                  className={`py-2 px-3 rounded-lg border text-xs font-mono transition-all text-center ${scoreColor} disabled:opacity-40 cursor-pointer`}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-1 text-[11px] font-mono text-slate-400 leading-normal">
            <div>Correct Score: <span className="text-slate-700 font-bold">{score}/{architectQuiz.length}</span></div>
            <div className="mt-1">Rank: <span className="hover:underline text-indigo-650 font-bold cursor-pointer">{badge.title}</span></div>
          </div>
        </div>
      )}

      {/* Right side: Detailed Workspace Panel */}
      <div className={`${quizComplete ? 'xl:col-span-4' : 'xl:col-span-3'} flex flex-col h-full`}>
        {quizComplete ? (
          /* Finished Screen Certifications */
          <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center max-w-2xl mx-auto gap-6 shadow-sm">
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-amber-600 animate-bounce">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">Senior Architect Board Exam Complete</h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">PostgreSQL Database Schema Optimization credentials compiled</p>
            </div>

            {/* Score block */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl w-full max-w-md flex flex-col gap-3">
              <div className="text-xs font-mono text-slate-400 uppercase font-black">Total Score Received</div>
              <div className="text-4xl font-extrabold font-display tracking-tight text-slate-900">
                {score} <span className="text-slate-400 text-lg font-sans font-normal">/ {architectQuiz.length} correct</span>
              </div>

              {/* Dynamic Badge Card */}
              <div className={`mt-3 border p-4 rounded-xl flex flex-col gap-1 items-stretch ${badge.color}`}>
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold flex items-center justify-center gap-1.5 leading-none">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Licensed Certification:</span>
                </span>
                <div className="font-display font-bold text-sm mt-1">{badge.title}</div>
                <p className="text-[11px] font-sans leading-relaxed text-slate-650 font-medium mt-1">
                  {badge.desc}
                </p>
              </div>
            </div>

            <button
              id="quiz-retry-btn"
              onClick={handleReset}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg font-mono text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Board Exam</span>
            </button>
          </div>
        ) : (
          /* Question Panel */
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between h-full min-h-[500px] shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span className="text-xs font-mono text-slate-500 font-bold uppercase">Exam Question {currentIdx + 1} of {architectQuiz.length}</span>
                </div>
                <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-0.5 rounded-full font-mono font-semibold">
                  {activeQuestion.category}
                </span>
              </div>

              {/* The Question Text */}
              <h3 className="text-sm font-display font-bold text-slate-900 leading-relaxed pr-2">
                {activeQuestion.question}
              </h3>

              {/* Option Cards */}
              <div className="space-y-2.5">
                {activeQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOptIdx === idx;
                  const isCorrectAnswer = idx === activeQuestion.correctAnswerIndex;
                  
                  let optionStyles = 'bg-white border-slate-200 text-slate-700 hover:border-slate-350 hover:bg-slate-50/80';
                  if (!isSubmitted) {
                    if (isSelected) optionStyles = 'bg-indigo-50 border-indigo-300 text-indigo-800 font-semibold';
                  } else {
                    if (isCorrectAnswer) {
                      optionStyles = 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold';
                    } else if (isSelected) {
                      optionStyles = 'bg-rose-50 border-rose-300 text-rose-800 font-bold';
                    } else {
                      optionStyles = 'bg-slate-50/50 border-slate-200/85 text-slate-500 opacity-60';
                    }
                  }

                  return (
                    <button
                      id={`quiz-option-btn-${idx}`}
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={isSubmitted}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs leading-relaxed transition-all flex items-start gap-3 shadow-sm ${optionStyles} cursor-pointer`}
                    >
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 h-5 w-5 rounded flex items-center justify-center shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Grading Explanations (only shows after submit) */}
              {isSubmitted && (
                <div className="bg-slate-50 border border-[#e2e8f0]/80 p-5 rounded-xl flex flex-col gap-3 font-sans shadow-inner">
                  <div className="flex items-center gap-2">
                    {selectedOptIdx === activeQuestion.correctAnswerIndex ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wide">Graded: PASS (Correct Answer)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-600" />
                        <span className="text-xs font-mono font-bold text-rose-700 uppercase tracking-wide">Graded: REJECTED (Incorrect Selection)</span>
                      </>
                    )}
                  </div>

                  <p className="text-xs leading-normal text-slate-600">
                    {activeQuestion.explanation.overview}
                  </p>

                  <div className="border-t border-slate-200/60 pt-3 flex gap-2.5 items-start mt-1">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="inline-block text-[11px] leading-relaxed text-slate-550">
                      <strong className="text-slate-800 block font-mono text-[10px] uppercase text-indigo-600 tracking-wide font-bold">Senior Database Architect Opinion:</strong>
                      <p className="mt-0.5 italic text-slate-650 font-sans">{activeQuestion.explanation.architectOpinion}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper buttons */}
            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end">
              {!isSubmitted ? (
                <button
                  id="quiz-submit-btn"
                  onClick={handleSubmit}
                  disabled={selectedOptIdx === null}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white py-2.5 px-6 rounded-lg font-mono text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  id="quiz-next-btn"
                  onClick={handleNext}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-6 rounded-lg font-mono text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                >
                  <span>{currentIdx === architectQuiz.length - 1 ? 'Finish Exam' : 'Next Question'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
