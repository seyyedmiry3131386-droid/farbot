import React, { useState, useMemo } from 'react';
import { Sparkles, MessageSquare, CornerDownLeft } from 'lucide-react';
import { stripQuestionPrefix, interviewStepsFor } from '../lib/domain.js';

interface GuideInterviewProps {
  initialText: string;
  onFinish: (generatedNarrative: string, interviewTurns: Array<{ q: string; a: string }>) => void;
  onTurnUpdate?: (draftNarrative: string) => void;
  onCancel: () => void;
}

export const GuideInterview: React.FC<GuideInterviewProps> = ({
  initialText,
  onFinish,
  onTurnUpdate,
  onCancel,
}) => {
  const initialSteps = useMemo(() => {
    const steps = interviewStepsFor(initialText, []);
    return steps.length > 0
      ? steps
      : [
          {
            id: 'source',
            title: 'نحوه اطلاع شما از این رویداد چگونه بوده است؟',
            hint: 'مشاهدهٔ مستقیم را از شنیده‌ها، تماس‌ها و پیام‌ها جدا کنید.',
            options: ['خودم شاهد بودم', 'برای خودم اتفاق افتاد', 'از شخص دیگری شنیدم', 'در فضای مجازی دیدم'],
          },
        ];
  }, [initialText]);

  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [question, setQuestion] = useState(initialSteps[0].title);
  const [hint, setHint] = useState(initialSteps[0].hint || '');
  const [options, setOptions] = useState<string[]>(initialSteps[0].options || []);
  const [answerInput, setAnswerInput] = useState('');
  const [detailExtraInput, setDetailExtraInput] = useState('');
  const [loading, setLoading] = useState(false);

  const totalSteps = initialSteps.length;

  const selectedTokens = answerInput
    .split(/،|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const isChipSelected = (opt: string) =>
    selectedTokens.includes(opt) || answerInput.includes(opt);

  const toggleChipOption = (opt: string) => {
    const tokens = answerInput
      .split(/،|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = tokens.includes(opt)
      ? tokens.filter((t) => t !== opt)
      : [...tokens, opt];
    setAnswerInput(next.join('، '));
  };

  const showDetailBoxInGuide = /(صاحب حساب|حساب بانکی|شماره حساب|شماره کارت|شماره شبا|کارت به کارت|شماره تماس|آیدی|ایدی|صفحه اینستاگرام|کانال یا حساب تلگرام|وب‌سایت فروشگاهی|سایت دیوار|شیپور|درگاه پرداخت|نام و مشخصات طرف مقابل را دارم|مشخصات ظاهری)/.test(
    answerInput
  );

  const askNextFromAI = async (lastQuestion: string, lastAnswer: string) => {
    const updatedHistory = [...history, { q: stripQuestionPrefix(lastQuestion), a: lastAnswer }];
    setHistory(updatedHistory);
    if (onTurnUpdate) {
      const liveText = updatedHistory
        .filter((h) => h.a && h.a !== 'اطلاعی ندارم' && h.a !== 'نمی‌دانم' && h.a !== 'اطلاعات بیشتری ندارم')
        .map((h) => h.a)
        .join(' — ');
      if (liveText) {
        onTurnUpdate(liveText);
      }
    }
    setAnswerInput('');
    setDetailExtraInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'intake',
          text: initialText,
          history: updatedHistory,
          currentQuestion: lastQuestion,
          answer: lastAnswer,
        }),
      });

      const data = await res.json();

      if (data.done || currentStepIndex >= totalSteps - 1) {
        const finalNarrative =
          data.narrative ||
          updatedHistory
            .filter((h) => h.a && h.a !== 'اطلاعی ندارم' && h.a !== 'نمی‌دانم')
            .map((h) => `${h.q}: ${h.a}`)
            .join('\n');
        onFinish(finalNarrative, updatedHistory);
        return;
      }

      if (data.question) {
        setQuestion(data.question);
        setHint(data.hint || '');
        setOptions(
          (data.options || []).filter((o: string) => o !== 'اطلاعات بیشتری ندارم' && o !== 'اطلاعی ندارم')
        );
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        advanceLocally(updatedHistory);
      }
    } catch {
      advanceLocally(updatedHistory);
    } finally {
      setLoading(false);
    }
  };

  const advanceLocally = (updatedHistory: Array<{ q: string; a: string }>) => {
    // Re-evaluate dynamic steps in case the user's first answer revealed the incident type (e.g. online shopping)
    const dynamicSteps = interviewStepsFor(initialText, updatedHistory.slice(0, 1));
    const activeSteps = dynamicSteps.length >= initialSteps.length ? initialSteps : dynamicSteps;
    const nextIdx = currentStepIndex + 1;
    if (nextIdx >= activeSteps.length) {
      const narrative = updatedHistory
        .filter((h) => h.a && h.a !== 'اطلاعی ندارم' && h.a !== 'نمی‌دانم')
        .map((h) => h.a)
        .join(' ');
      onFinish(narrative, updatedHistory);
      return;
    }

    const step = activeSteps[nextIdx] || initialSteps[nextIdx];
    setCurrentStepIndex(nextIdx);
    setQuestion(step.title);
    setHint(step.hint || '');
    setOptions(step.options || []);
  };

  const handleSendAnswer = (ans: string) => {
    const base = ans.trim();
    const extraDetail = detailExtraInput.trim();
    const merged = base && extraDetail ? `${base} (${extraDetail})` : base || extraDetail || 'اطلاعی ندارم';
    askNextFromAI(question, merged);
  };

  const cleanQuestion = question.replace(/\s*\([^)]*\)/g, '').trim();

  return (
    <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-4 sm:p-6 shadow-xs text-right animate-arrive overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#e5ece8] dark:border-[#22372c] mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-[#244b3b] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-300" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9] truncate">
            راهنمای گام‌به‌گام
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            · گام {currentStepIndex + 1} از {totalSteps}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#1a2c22] shrink-0 whitespace-nowrap"
        >
          بازگشت به متن
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1.5 mb-5">
        {initialSteps.map((s: any, idx: number) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              idx < currentStepIndex
                ? 'bg-emerald-600'
                : idx === currentStepIndex
                ? 'bg-[#244b3b] dark:bg-emerald-400'
                : 'bg-gray-200 dark:bg-[#1f3528]'
            }`}
          />
        ))}
      </div>

      {/* Current Question */}
      <div className="mb-4">
        <h3 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9] leading-relaxed mb-3">
          {cleanQuestion}
        </h3>

        {/* Quick Suggestion Chips */}
        {options.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {options.map((opt) => {
              const selected = isChipSelected(opt);
              const cleanOpt = opt.replace(/\s*\([^)]*\)/g, '').trim();
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={loading}
                  aria-pressed={selected}
                  onClick={() => toggleChipOption(opt)}
                  className={`px-3 py-1.5 border text-xs font-semibold rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 text-right ${
                    selected
                      ? 'bg-[#244b3b] dark:bg-[#2c624c] text-white border-[#244b3b] dark:border-[#2c624c]'
                      : 'bg-[#f8fbf9] dark:bg-[#182920] border-[#dce6e0] dark:border-[#284635] text-[#18372b] dark:text-[#e7eee9] hover:border-[#244b3b]'
                  }`}
                >
                  {selected && <span className="text-[10px]">✓</span>}
                  <span>{cleanOpt}</span>
                </button>
              );
            })}
          </div>
        )}

        {showDetailBoxInGuide && (
          <div className="mt-3 p-3 bg-[#f9fbfa] dark:bg-[#15241c] border border-[#c7dfd1] dark:border-[#284635] rounded-xl animate-arrive">
            <label className="block text-xs font-bold text-[#18372b] dark:text-[#9de0bf] mb-1.5">
              مشخصات تکمیلی:
            </label>
            <input
              type="text"
              value={detailExtraInput}
              onChange={(e) => setDetailExtraInput(e.target.value)}
              placeholder="شماره کارت، شماره تماس، آیدی یا مشخصات…"
              className="w-full min-w-0 bg-white dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] text-[#18372b] dark:text-[#e7eee9] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
            />
          </div>
        )}
      </div>

      {/* Manual Free Text Input */}
      <div className="flex items-center gap-2 w-full">
        <input
          type="text"
          value={answerInput}
          onChange={(e) => setAnswerInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (answerInput.trim() || detailExtraInput.trim())) {
              handleSendAnswer(answerInput);
            }
          }}
          disabled={loading}
          placeholder="پاسخ خود را بنویسید…"
          className="flex-1 min-w-0 h-11 bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] text-[#18372b] dark:text-[#e7eee9] rounded-xl px-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
        />
        <button
          type="button"
          disabled={loading || (!answerInput.trim() && !detailExtraInput.trim())}
          onClick={() => handleSendAnswer(answerInput)}
          className="h-11 bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] text-white px-4 sm:px-5 rounded-xl text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5 transition shadow-2xs shrink-0 whitespace-nowrap"
        >
          <span>{loading ? 'بررسی…' : 'ثبت پاسخ'}</span>
          <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      <div className="flex items-center justify-end pt-3 mt-3 border-t border-[#e5ece8] dark:border-[#22372c]">
        <button
          type="button"
          onClick={() => handleSendAnswer('اطلاعی ندارم')}
          className="text-xs text-[#244b3b] dark:text-[#9de0bf] font-semibold hover:underline"
        >
          اطلاعی ندارم
        </button>
      </div>
    </div>
  );
};
