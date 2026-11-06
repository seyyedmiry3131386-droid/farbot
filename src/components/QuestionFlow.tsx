import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, HelpCircle, Plus, Trash2, Car, User, Smartphone, Package, CreditCard, Globe } from 'lucide-react';
import { PlateEditor } from './PlateEditor.tsx';
import { YES, NO } from '../lib/details.js';
import {
  stripQuestionPrefix,
  extractDynamicEntities,
  buildDynamicFieldsForEntities,
} from '../lib/domain.js';

interface QuestionFlowProps {
  questions: any[];
  answers: Record<string, any>;
  extra: Record<string, any>;
  analysis: any;
  onUpdateAnswer: (questionId: string, answer: any) => void;
  onUpdateExtra: (section: string, data: any) => void;
  onComplete: () => void;
  onBackToNarrative: () => void;
}

export const QuestionFlow: React.FC<QuestionFlowProps> = ({
  questions,
  answers,
  extra,
  analysis,
  onUpdateAnswer,
  onUpdateExtra,
  onComplete,
  onBackToNarrative,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [helpText, setHelpText] = useState('');
  const [loadingHelp, setLoadingHelp] = useState(false);

  const q = questions[currentIndex] || questions[0];
  if (!q) {
    return (
      <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-6 shadow-sm my-4 text-center animate-arrive">
        <p className="text-sm font-bold text-[#18372b] dark:text-[#e7eee9] mb-4">
          اطلاعات اولیه شرح شما کامل بوده و نیازی به پاسخ به سؤالات تکمیلی نیست.
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="px-6 py-2.5 bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] dark:hover:bg-[#23503e] text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          ادامه و بارگذاری مدارک
        </button>
      </div>
    );
  }

  const rawQAnswer = answers[q.id];
  const currentAnswer =
    typeof rawQAnswer === 'string'
      ? rawQAnswer
      : rawQAnswer && typeof rawQAnswer === 'object' && typeof rawQAnswer.value === 'string'
      ? rawQAnswer.value
      : '';
  const currentExtraData = extra[q.id] || { rows: [], detailFields: {} };
  const detailFields: Record<string, string> = currentExtraData.detailFields || {};

  // Parse which options are currently selected in the multi-select answer
  const selectedTokens = currentAnswer
    .split(/،|,|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const isOptionSelected = (opt: string) =>
    selectedTokens.includes(opt) || currentAnswer.includes(opt);

  const handleTextChange = (val: string) => {
    onUpdateAnswer(q.id, val);
  };

  const getFieldValue = (df: any, sf: any): string => {
    if (detailFields[sf.key] !== undefined) {
      return detailFields[sf.key];
    }
    const entityAns = answers?.[df.entityId] || answers?.[df.type];
    if (entityAns && typeof entityAns === 'object') {
      if (entityAns.fields && entityAns.fields[sf.key] !== undefined) {
        return String(entityAns.fields[sf.key]);
      }
      if (df.subFields?.length === 1 && entityAns.value) {
        return String(entityAns.value);
      }
    } else if (typeof entityAns === 'string' && df.subFields?.length === 1) {
      return entityAns;
    }
    return sf.defaultValue || '';
  };

  const handleDetailFieldChange = (df: any, fieldKey: string, val: string) => {
    const updatedFields = { ...detailFields, [fieldKey]: val };
    onUpdateExtra(q.id, {
      ...currentExtraData,
      enabled: true,
      detailFields: updatedFields,
    });

    // همگام‌سازی مستقیم با فیلد ساختاریافته در answers
    if (df?.entityId) {
      const prevEntityAns =
        answers?.[df.entityId] && typeof answers[df.entityId] === 'object'
          ? answers[df.entityId]
          : {
              id: df.entityId,
              type: df.type || df.entityId,
              category: df.label,
              label: df.label,
              stage: df.stage || q.stage || 2,
              targetQuestionId: q.id,
              fields: {},
            };
      const nextSubFields = { ...(prevEntityAns.fields || {}), [fieldKey]: val };
      const combinedVal = Object.values(nextSubFields)
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .join(' — ');
      onUpdateAnswer(df.entityId, {
        ...prevEntityAns,
        value: combinedVal || prevEntityAns.value || '',
        fields: nextSubFields,
      });
    }
  };

  // Combine dynamic fields from recognized LLM/analysis JSON entities (`q.dynamicFields`),
  // structured entities categorized in `answers` (`appearance`, `license_plate`, `bank_account`, etc.),
  // and any entities dynamically triggered by the user's selected chips or typed answer
  const combinedQuestionContext = `${currentAnswer}`;
  const liveTriggeredEntities = combinedQuestionContext.trim()
    ? extractDynamicEntities(combinedQuestionContext)
    : [];
  const liveDynamicFields = buildDynamicFieldsForEntities(liveTriggeredEntities, null, combinedQuestionContext);

  const activeDynamicFields = (() => {
    const merged: any[] = [];
    const seen = new Set<string>();
    const add = (df: any) => {
      if (!df || !df.id || seen.has(df.id)) return;
      seen.add(df.id);
      merged.push(df);
    };

    // 1. Dynamic fields attached to this stage question from LLM/analysis JSON entities
    for (const df of q.dynamicFields || []) {
      add(df);
    }

    // 2. Dynamic fields from structured entity categories in `answers` (e.g., appearance, license_plate, bank_account)
    const fallbackQId =
      questions.find((item) => item.id === 'details' || item.id === 'method')?.id ||
      questions[0]?.id;
    for (const [ansKey, ansVal] of Object.entries(answers || {})) {
      if (!ansVal || typeof ansVal !== 'object' || !ansVal.id) continue;
      const targetId = ansVal.targetQuestionId || 'details';
      const targetExists = questions.some((item) => item.id === targetId);
      const effectiveTarget = targetExists ? targetId : fallbackQId;
      if (effectiveTarget === q.id) {
        if (ansVal.dynamicField) {
          add(ansVal.dynamicField);
        } else {
          const built = buildDynamicFieldsForEntities([ansVal], null, '');
          for (const b of built) add(b);
        }
      }
      void ansKey;
    }

    // 3. Dynamic fields triggered by user's selected keyword chips or typed text in this question
    for (const df of liveDynamicFields) {
      add(df);
    }
    return merged;
  })();

  const buildAnswerWithDetails = () => {
    const baseText = currentAnswer.replace(/\s*\(جزئیات تکمیلی:.*?\)\s*$/, '').trim();
    const parts: string[] = [];
    const labelMap: Record<string, string> = {
      bankNumber: 'شماره حساب/کارت/شبا',
      bankOwner: 'نام صاحب حساب/بانک',
      contactId: 'شماره تماس/آیدی',
      contactChannel: 'نام صفحه/کانال',
      websiteUrl: 'نشانی سایت/آگهی',
      personName: 'نام/لقب فرد',
      personAppearance: 'مشخصات ظاهری',
      vehicleModel: 'وسیله نقلیه',
      vehiclePlate: 'پلاک',
    };

    const resolvedFieldValues: Record<string, string> = { ...detailFields };
    for (const df of activeDynamicFields) {
      for (const sf of df.subFields || []) {
        if (sf.key && sf.label && !labelMap[sf.key]) {
          labelMap[sf.key] = sf.label;
        }
        const val = getFieldValue(df, sf);
        if (val && !resolvedFieldValues[sf.key]) {
          resolvedFieldValues[sf.key] = val;
        }
      }
    }

    for (const [key, rawVal] of Object.entries(resolvedFieldValues)) {
      const val = String(rawVal || '').trim();
      if (val) {
        parts.push(`${labelMap[key] || key}: ${val}`);
      }
    }

    if (parts.length === 0) return baseText;
    const detailSummary = `(جزئیات تکمیلی: ${parts.join(' | ')})`;
    return baseText ? `${baseText} ${detailSummary}` : detailSummary;
  };

  const handleNext = () => {
    if (!q.group) {
      const merged = buildAnswerWithDetails();
      if (merged && merged !== currentAnswer) {
        onUpdateAnswer(q.id, merged);
      }
    }
    setHelpText('');
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const handleQuickOption = (option: string) => {
    if (q.group) {
      onUpdateAnswer(q.id, option);
      if (option === YES && (!currentExtraData.rows || currentExtraData.rows.length === 0)) {
        onUpdateExtra(q.id, { enabled: true, rows: [{ _id: Date.now().toString() }] });
      } else if (option === NO) {
        setTimeout(() => handleNext(), 120);
      }
      return;
    }

    // Multi-select toggle for keyword chips
    const baseClean = currentAnswer.replace(/\s*\(جزئیات تکمیلی:.*?\)\s*$/, '').trim();
    const tokens = baseClean
      .split(/،|,/)
      .map((t) => t.trim())
      .filter(Boolean);

    let nextTokens: string[];
    if (tokens.includes(option)) {
      nextTokens = tokens.filter((t) => t !== option);
    } else {
      nextTokens = [...tokens, option];
    }

    onUpdateAnswer(q.id, nextTokens.join('، '));
  };

  const handlePrev = () => {
    setHelpText('');
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      onBackToNarrative();
    }
  };

  const handleUnknown = () => {
    onUpdateAnswer(q.id, q.group ? NO : 'اطلاعات بیشتری ندارم');
    handleNext();
  };

  // Add a new row to multi-row entity
  const handleAddRow = () => {
    const existing = currentExtraData.rows || [];
    if (existing.length >= 10) return;
    const newRow = { _id: Date.now().toString() };
    onUpdateExtra(q.id, { ...currentExtraData, enabled: true, rows: [...existing, newRow] });
  };

  const handleUpdateRow = (rowIndex: number, updatedRow: any) => {
    const existing = [...(currentExtraData.rows || [])];
    existing[rowIndex] = updatedRow;
    onUpdateExtra(q.id, { ...currentExtraData, enabled: true, rows: existing });
  };

  const handleRemoveRow = (rowIndex: number) => {
    const existing = [...(currentExtraData.rows || [])];
    existing.splice(rowIndex, 1);
    onUpdateExtra(q.id, { ...currentExtraData, enabled: existing.length > 0, rows: existing });
  };

  const fetchAIHelp = async () => {
    setLoadingHelp(true);
    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.title, answer: currentAnswer }),
      });
      const data = await res.json();
      setHelpText(data.text || q.hint);
    } catch {
      setHelpText(q.hint || 'می‌توانید اطلاعات را به زبان ساده بنویسید یا گزینه نمی‌دانم را انتخاب کنید.');
    } finally {
      setLoadingHelp(false);
    }
  };

  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);
  const cleanTitle = stripQuestionPrefix(q.title).replace(/\s*\([^)]*\)/g, '').trim();
  const cleanOptions = (q.options || []).filter(
    (opt: string) => opt !== 'اطلاعات بیشتری ندارم' && opt !== 'اطلاعی ندارم'
  );
  const hasDetailFieldValues = Object.values(detailFields).some((v) => Boolean(v && String(v).trim()));
  const hasAnswer = q.group
    ? Boolean(
        currentAnswer &&
          (currentAnswer === NO ||
            (currentAnswer === YES && currentExtraData.rows && currentExtraData.rows.length > 0))
      )
    : Boolean((currentAnswer && String(currentAnswer).trim().length > 0) || hasDetailFieldValues);
  const hasTypedText = Boolean((currentAnswer && String(currentAnswer).trim().length > 0) || hasDetailFieldValues);

  return (
    <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-5 shadow-xs my-1 text-right animate-arrive">
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-[#6b756f] dark:text-[#90a397] mb-1 font-bold">
          <span>
            سؤال {currentIndex + 1} از {questions.length}
          </span>
          <span>{progressPct}٪</span>
        </div>
        <div className="w-full h-1 bg-[#edf3ef] dark:bg-[#1e3428] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#244b3b] dark:bg-[#347d61] transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question Header */}
      <div className="mb-2.5">
        <h2 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9] leading-relaxed">{cleanTitle}</h2>
      </div>

      {/* Standard Text Input for non-group questions */}
      {!q.group && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              پاسخ شما:
            </span>
            <button
              type="button"
              onClick={fetchAIHelp}
              disabled={loadingHelp}
              className="p-1 rounded-lg text-gray-400 hover:text-[#244b3b] dark:hover:text-[#a0dbbf] transition flex items-center gap-1"
              title="راهنمایی"
              aria-label="راهنمایی"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {helpText && (
            <div className="mb-2 p-2 bg-[#edf5f0] dark:bg-[#15271e] border border-[#cfe0d6] dark:border-[#244234] rounded-xl text-xs text-[#18372b] dark:text-[#a8d5be] leading-relaxed animate-arrive">
              {helpText}
            </div>
          )}

          <textarea
            value={currentAnswer}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={q.placeholder || 'پاسخ خود را بنویسید یا از گزینه‌های زیر انتخاب کنید…'}
            rows={2}
            className="w-full bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl p-2.5 text-xs sm:text-sm text-[#18372b] dark:text-[#e7eee9] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#244b3b] dark:focus:ring-emerald-500"
          />

          {/* Quick Keyword Chips */}
          {cleanOptions && cleanOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {cleanOptions.map((opt: string) => {
                const selected = isOptionSelected(opt);
                const cleanOpt = opt.replace(/\s*\([^)]*\)/g, '').trim();
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleQuickOption(opt)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold border transition flex items-center gap-1 ${
                      selected
                        ? 'bg-[#244b3b] dark:bg-[#2c624c] text-white border-[#244b3b] dark:border-[#2c624c]'
                        : 'bg-[#fcfdfa] dark:bg-[#111c16] text-[#31493e] dark:text-[#c5d6cc] border-[#d9e3dd] dark:border-[#22372c] hover:bg-[#edf5f0] dark:hover:bg-[#18291f]'
                    }`}
                  >
                    {selected && <span className="text-[10px]">✓</span>}
                    <span>{cleanOpt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Dynamic Entity Fields generated from JSON entities & selected keywords */}
          {activeDynamicFields.length > 0 && (
            <div className="mt-2.5 space-y-2 max-h-[24vh] overflow-y-auto animate-arrive">
              {activeDynamicFields.map((df: any) => {
                const subFields = Array.isArray(df.subFields) ? df.subFields : [];
                return (
                  <div
                    key={df.id}
                    className="p-2.5 bg-[#f4f9f6] dark:bg-[#111e17] border border-[#c7dfd1] dark:border-[#264535] rounded-xl"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#18372b] dark:text-[#9de0bf]">
                        {df.type === 'bank_account' && <CreditCard className="w-4 h-4" />}
                        {df.type === 'contact_info' && <Smartphone className="w-4 h-4" />}
                        {df.type === 'website_url' && <Globe className="w-4 h-4" />}
                        {(df.type === 'person_identity' || df.type === 'appearance') && <User className="w-4 h-4" />}
                        {df.type === 'license_plate' && <Car className="w-4 h-4" />}
                        {!['bank_account', 'contact_info', 'website_url', 'person_identity', 'appearance', 'license_plate'].includes(
                          df.type
                        ) && <Package className="w-4 h-4" />}
                        <span>{df.label}</span>
                      </div>
                      {df.extractedValue && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-[#162920] text-[#244b3b] dark:text-[#a0dbbf] border border-[#cfe0d6] dark:border-[#284235]">
                          شناسایی‌شده در متن: {df.extractedValue}
                        </span>
                      )}
                    </div>

                    <div
                      className={`grid grid-cols-1 ${
                        subFields.length > 1 ? 'sm:grid-cols-2' : ''
                      } gap-2.5`}
                    >
                      {subFields.map((sf: any) => (
                        <div key={sf.key}>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                            {sf.label}
                          </label>
                          <input
                            type="text"
                            dir={sf.dir || 'rtl'}
                            value={getFieldValue(df, sf)}
                            onChange={(e) => handleDetailFieldChange(df, sf.key, e.target.value)}
                            placeholder={sf.placeholder || 'اطلاعات تکمیلی را وارد کنید...'}
                            className={`w-full text-xs p-2 border border-[#cfe0d6] dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg ${
                              sf.dir === 'ltr' ? 'text-left' : 'text-right'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Group Detail Rows (Persons, Vehicles, Objects, Contacts) */}
      {q.group && currentAnswer === YES && (
        <div className="my-5 p-4 bg-[#f8fbf9] dark:bg-[#111c16] border border-[#dfe9e3] dark:border-[#22372c] rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#244b3b] dark:text-[#95d7b7]">
              موارد ثبت‌شده
            </span>
            <button
              type="button"
              onClick={handleAddRow}
              className="text-xs bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] border border-[#cfe0d6] dark:border-[#284635] px-3 py-1.5 rounded-lg font-bold hover:bg-[#dfece4] dark:hover:bg-[#233d2f] flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              افزودن مورد جدید
            </button>
          </div>

          <div className="space-y-4">
            {(currentExtraData.rows || []).map((row: any, rIdx: number) => (
              <div
                key={row._id || rIdx}
                className="p-4 bg-white dark:bg-[#15221b] border border-[#d9e3dd] dark:border-[#22372c] rounded-xl shadow-xs text-right relative"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-[#22372c] mb-3">
                  <span className="text-xs font-bold text-[#31493e] dark:text-[#a3c4b4] flex items-center gap-1.5">
                    {q.id === 'vehicle' && <Car className="w-4 h-4 text-[#244b3b] dark:text-[#a0dbbf]" />}
                    {q.id === 'person' && <User className="w-4 h-4 text-[#244b3b] dark:text-[#a0dbbf]" />}
                    {q.id === 'object' && <Package className="w-4 h-4 text-[#244b3b] dark:text-[#a0dbbf]" />}
                    {q.id === 'contact' && <Smartphone className="w-4 h-4 text-[#244b3b] dark:text-[#a0dbbf]" />}
                    مورد شماره {rIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(rIdx)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded"
                    title="حذف این مورد"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Person entity fields */}
                {q.id === 'person' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">نام یا عنوان فرد</label>
                      <input
                        type="text"
                        placeholder="مثلاً: فرد ضارب، احمد میثاقی، سارق..."
                        value={row.label || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, label: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">نقش فرد</label>
                      <select
                        value={row.role || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, role: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                      >
                        <option value="">انتخاب نقش...</option>
                        <option value="شروع کننده نزاع">شروع‌کننده نزاع یا رخداد</option>
                        <option value="فرد انجام‌دهنده رفتار">انجام‌دهنده رفتار</option>
                        <option value="فرد آسیب‌دیده">فرد آسیب‌دیده / قربانی</option>
                        <option value="شاهد">شاهد حادثه</option>
                        <option value="سایر">سایر</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">مشخصات ظاهری یا رفتار</label>
                      <input
                        type="text"
                        placeholder="قد، سن تقریبی، رنگ لباس، چهره، لهجه یا نشانه‌های ظاهری..."
                        value={row.notes || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, notes: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Vehicle entity fields */}
                {q.id === 'vehicle' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">نوع وسیله</label>
                        <select
                          value={row.kind || 'خودرو'}
                          onChange={(e) => handleUpdateRow(rIdx, { ...row, kind: e.target.value })}
                          className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                        >
                          <option value="خودرو">خودرو</option>
                          <option value="موتورسیکلت">موتورسیکلت</option>
                          <option value="وانت">وانت</option>
                          <option value="کامیون">کامیون</option>
                          <option value="تاکسی">تاکسی</option>
                          <option value="دوچرخه">دوچرخه</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">مدل یا نوع</label>
                        <input
                          type="text"
                          placeholder="پراید، پژو، سمند..."
                          value={row.model || ''}
                          onChange={(e) => handleUpdateRow(rIdx, { ...row, model: e.target.value })}
                          className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">رنگ</label>
                        <input
                          type="text"
                          placeholder="سفید، مشکی، نقره‌ای..."
                          value={row.color || ''}
                          onChange={(e) => handleUpdateRow(rIdx, { ...row, color: e.target.value })}
                          className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                        />
                      </div>
                    </div>
                    {/* License Plate Widget */}
                    <div className="pt-2">
                      <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">شماره پلاک:</span>
                      <PlateEditor
                        plateData={row}
                        onChange={(updatedPlate) => handleUpdateRow(rIdx, { ...row, ...updatedPlate })}
                      />
                    </div>
                  </div>
                )}

                {/* Object entity fields */}
                {q.id === 'object' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">نام یا عنوان وسیله</label>
                      <input
                        type="text"
                        placeholder="کیف، گوشی تلفن همراه، مدارک شناسایی..."
                        value={row.label || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, label: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">وضعیت یا خسارت</label>
                      <input
                        type="text"
                        placeholder="به سرقت رفته، تخریب‌شده، مفقود..."
                        value={row.condition || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, condition: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Contact entity fields */}
                {q.id === 'contact' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">نوع راه ارتباطی</label>
                      <input
                        type="text"
                        placeholder="تلفن، پیامک، کانال تلگرام، پیج اینستاگرام، شماره کارت..."
                        value={row.channel || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, channel: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">شماره یا نشانی / شناسه</label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="0912... یا @id یا URL"
                        value={row.value || ''}
                        onChange={(e) => handleUpdateRow(rIdx, { ...row, value: e.target.value })}
                        className="w-full text-xs p-2 border border-gray-300 dark:border-[#284235] bg-white dark:bg-[#0e1612] text-[#18372b] dark:text-[#e7eee9] rounded-lg text-left"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-[#e5ece8] dark:border-[#22372c] mt-3 gap-2">
        <button
          type="button"
          onClick={handlePrev}
          className="px-3 py-2 border border-[#dbe5df] dark:border-[#22372c] bg-white dark:bg-[#15221b] text-[#31493e] dark:text-[#c5d6cc] rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#18291f] flex items-center justify-center gap-1 transition whitespace-nowrap"
        >
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          <span>قبلی</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUnknown}
            disabled={hasTypedText}
            className={`px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
              hasTypedText
                ? 'opacity-30 cursor-not-allowed bg-gray-100 dark:bg-[#182820] text-gray-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 bg-gray-100 dark:bg-[#182820] hover:bg-gray-200 dark:hover:bg-[#20362b]'
            }`}
            title={hasTypedText ? 'با توجه به ورود متن، این دکمه غیرفعال است' : 'رد کردن این سؤال'}
          >
            اطلاعی ندارم
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!hasAnswer}
            className={`justify-center px-3.5 sm:px-5 py-2 bg-[#244b3b] dark:bg-[#2c624c] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap ${
              !hasAnswer
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-[#18372b] dark:hover:bg-[#23503e]'
            }`}
            title={!hasAnswer ? 'لطفاً ابتدا متنی بنویسید یا گزینه‌ای انتخاب کنید' : 'ادامه'}
          >
            <span>{currentIndex === questions.length - 1 ? 'تکمیل سؤالات' : 'سؤال بعدی'}</span>
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
