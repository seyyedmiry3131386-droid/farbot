import React, { useState } from 'react';
import { Sparkles, Edit2, Trash2, ArrowLeft, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { EVENTS } from '../lib/scenarios.js';

interface AnalysisReviewProps {
  analysis: any;
  text: string;
  onEditTopics: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

export const AnalysisReview: React.FC<AnalysisReviewProps> = ({
  analysis,
  text,
  onEditTopics,
  onConfirm,
  onBack,
}) => {
  const [facts, setFacts] = useState(() => {
    const list: Array<{ id: string; label: string; value: string; evidence?: string; deleted?: boolean }> = [];

    if (analysis.known?.source) {
      list.push({ id: 'source', label: 'نحوه اطلاع', value: analysis.known.source });
    }
    if (analysis.known?.actor) {
      list.push({ id: 'actor', label: 'فاعل / متخلفان شناسایی‌شده', value: analysis.known.actor });
    }
    if (analysis.known?.appearance) {
      list.push({ id: 'appearance', label: 'مشخصات ظاهری افراد', value: analysis.known.appearance });
    }
    if (analysis.known?.peopleCount) {
      list.push({ id: 'peopleCount', label: 'تعداد افراد حاضر', value: analysis.known.peopleCount });
    }
    if (analysis.known?.victim) {
      list.push({ id: 'victim', label: 'وضعیت آسیب‌دیدگان / مالباخته', value: analysis.known.victim });
    }
    if (analysis.known?.otherPeople) {
      list.push({ id: 'otherPeople', label: 'مشخصات سایر افراد', value: analysis.known.otherPeople });
    }
    if (analysis.known?.time) {
      list.push({ id: 'time', label: 'زمان وقوع', value: analysis.known.time });
    }
    if (analysis.known?.place) {
      list.push({ id: 'place', label: 'مکان وقوع', value: analysis.known.place });
    }
    if (analysis.known?.details) {
      list.push({ id: 'details', label: 'موضوع رخداد', value: analysis.known.details });
    }
    if (analysis.known?.reason) {
      list.push({ id: 'reason', label: 'علت رخداد', value: analysis.known.reason });
    }
    if (analysis.known?.method) {
      list.push({ id: 'method', label: 'شیوه انجام', value: analysis.known.method });
    }
    if (analysis.known?.otherInfo) {
      list.push({ id: 'otherInfo', label: 'سایر نکات', value: analysis.known.otherInfo });
    }

    for (const p of analysis.prefills || []) {
      if (!list.some((item) => item.id === `${p.section}_${p.field}`)) {
        list.push({
          id: `${p.section}_${p.field}`,
          label: p.field === 'answer' ? 'پاسخ استخراج‌شده' : p.field,
          value: p.value,
          evidence: p.evidence,
        });
      }
    }

    for (const ent of analysis.entities || []) {
      if (ent?.value && !list.some((item) => item.value === ent.value || item.id === ent.id)) {
        list.push({
          id: `entity_${ent.id}`,
          label: ent.label || 'مشخصات شناسایی‌شده',
          value: ent.value,
        });
      }
    }

    return list;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeFacts = facts.filter((f) => !f.deleted);
  const events = analysis.events || [analysis.event] || ['other'];

  const handleDeleteFact = (id: string) => {
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, deleted: true } : f)));
  };

  const handleStartEdit = (fact: any) => {
    setEditingId(fact.id);
    setEditValue(fact.value);
  };

  const handleSaveEdit = (id: string) => {
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, value: editValue } : f)));
    setEditingId(null);
  };

  return (
    <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-4 sm:p-5 shadow-xs my-1 text-right animate-arrive">
      <div className="flex items-center justify-between pb-2.5 border-b border-[#e5ece8] dark:border-[#22372c] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#edf5f0] dark:bg-[#1b2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9]">
            بازبینی اطلاعات استخراج‌شده
          </h2>
        </div>
      </div>

      {/* Identified Topics */}
      <div className="mb-3 p-2.5 bg-[#f8fbf9] dark:bg-[#111c16] border border-[#dfe9e3] dark:border-[#22372c] rounded-xl">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-[#244b3b] dark:text-[#95d7b7]">موضوع گزارش:</span>
          <button
            type="button"
            onClick={onEditTopics}
            className="text-xs text-[#244b3b] dark:text-[#95d7b7] font-medium hover:underline flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            <span>ویرایش موضوع</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {events.map((evId: string) => {
            const ev = EVENTS[evId] || { title: evId };
            return (
              <span
                key={evId}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#edf5f0] dark:bg-[#1b2f24] text-[#18372b] dark:text-[#d3e9de] border border-[#cfe0d6] dark:border-[#294635] rounded-lg text-xs font-bold"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#244b3b] dark:text-[#6ee7b7]" />
                {ev.title}
              </span>
            );
          })}
        </div>
      </div>

      {/* Extracted Facts List */}
      <div className="space-y-2 mb-3 max-h-[34vh] overflow-y-auto">
        {activeFacts.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 py-2.5 text-center bg-gray-50 dark:bg-[#111c16] rounded-lg">
            در گام بعدی جزئیات تکمیلی پرسیده می‌شود.
          </p>
        ) : (
          activeFacts.map((fact) => (
            <div
              key={fact.id}
              className="p-2.5 bg-white dark:bg-[#131f18] border border-[#d9e3dd] dark:border-[#22372c] rounded-xl flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#31493e] dark:text-[#a3c4b4]">{fact.label}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(fact)}
                    className="text-gray-400 hover:text-[#244b3b] dark:hover:text-[#a0dbbf] p-1 rounded transition"
                    title="ویرایش"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFact(fact.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded transition"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {editingId === fact.id ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 text-xs border border-[#244b3b] dark:border-emerald-500 bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg px-2 py-1 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(fact.id)}
                    className="bg-[#244b3b] text-white text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>ذخیره</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#18372b] dark:text-[#e7eee9] font-medium leading-relaxed">{fact.value}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-[#e5ece8] dark:border-[#22372c] gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 border border-[#dbe5df] dark:border-[#22372c] bg-white dark:bg-[#15221b] text-[#31493e] dark:text-[#c5d6cc] rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#1a2c22] flex items-center gap-1 transition whitespace-nowrap"
        >
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          <span>ویرایش شرح</span>
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="px-4 py-2 bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] dark:hover:bg-[#23503e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
        >
          <span>تأیید و ادامه</span>
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
};
