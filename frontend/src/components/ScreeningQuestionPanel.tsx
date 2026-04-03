import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ScreeningQuestionItem } from '../data/screeningQuestions';
import { FREQUENCY_OPTIONS, FREQUENCY_PROMPT } from '../data/screeningQuestions';

export type ScreeningQuestionPanelProps = {
  testTitle: string;
  questions: ScreeningQuestionItem[];
  currentIndex: number;
  answers: Record<string, number>;
  onAnswer: (questionKey: string, value: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  lastButtonLabel?: string;
  isBusy?: boolean;
};

const ScreeningQuestionPanel: React.FC<ScreeningQuestionPanelProps> = ({
  testTitle,
  questions,
  currentIndex,
  answers,
  onAnswer,
  onPrevious,
  onNext,
  lastButtonLabel = 'Submit',
  isBusy = false,
}) => {
  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const selected = answers[q.key];

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_14px_34px_-18px_rgba(15,23,42,0.18)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-950 via-slate-700 to-slate-400" />
        <div className="p-4 sm:p-6 md:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{testTitle}</p>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-950">
                  Question {currentIndex + 1} of {questions.length}
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-slate-500">
                {Math.round(((currentIndex + 1) / questions.length) * 100)}% Complete
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-medium text-slate-950 mb-4 sm:mb-6 leading-tight">
              {q.text}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-4 sm:mb-6">{FREQUENCY_PROMPT}</p>

            <div className="space-y-2 sm:space-y-3">
              {FREQUENCY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 sm:p-4 rounded-xl border cursor-pointer transition-colors touch-manipulation ${
                    selected === option.value
                      ? 'border-slate-900 bg-slate-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 active:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.key}
                    value={option.value}
                    checked={selected === option.value}
                    onChange={() => onAnswer(q.key, option.value)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                      selected === option.value ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                    }`}
                  >
                    {selected === option.value && (
                      <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                    )}
                  </div>
                  <span className="text-sm sm:text-base text-slate-700 flex-1">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onPrevious}
              disabled={currentIndex === 0 || isBusy}
              className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={selected === undefined || isBusy}
              className="flex items-center px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-slate-950 text-white rounded-xl hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation font-medium"
            >
              <span>{isLast ? lastButtonLabel : 'Next'}</span>
              {!isLast && <ArrowRight className="h-4 w-4 ml-1 sm:ml-2" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreeningQuestionPanel;
