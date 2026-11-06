import React from 'react';
import { PLATE_TEMPLATES, plateTemplate, normalizePlateInput, plateFields } from '../lib/plates.js';

interface PlateEditorProps {
  row?: any;
  plateData?: any;
  onChange: (updatedRow: any) => void;
}

export const PlateEditor: React.FC<PlateEditorProps> = ({ row, plateData, onChange }) => {
  const effectiveRow = row || plateData || {};
  const currentTemplateId = effectiveRow.plateTemplate || 'private';
  const t = plateTemplate(currentTemplateId) || PLATE_TEMPLATES[0];
  const drafts = effectiveRow.plateDrafts || {};
  const currentParts = drafts[currentTemplateId] || {};

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    const nextDrafts = { ...drafts };
    if (!nextDrafts[nextId]) nextDrafts[nextId] = {};
    onChange({
      ...row,
      plateTemplate: nextId,
      plateDrafts: nextDrafts,
      _plateSkipped: false,
    });
  };

  const handlePartChange = (fieldId: string, val: string) => {
    const norm = normalizePlateInput(row, fieldId, val);
    const updatedTemplateParts = { ...currentParts, [fieldId]: norm };
    const updatedDrafts = { ...drafts, [currentTemplateId]: updatedTemplateParts };
    onChange({
      ...row,
      plateDrafts: updatedDrafts,
      _plateSkipped: false,
    });
  };

  return (
    <div className="bg-[#f0f5e8] border border-[#d9e3cf] rounded-xl p-4 my-3 text-right">
      <label className="block text-xs font-bold text-[#5e7550] mb-2">
        قالب و نوع پلاک خودرو یا موتورسیکلت
      </label>
      <select
        value={currentTemplateId}
        onChange={handleTemplateChange}
        className="w-full bg-white border border-[#cfddd5] rounded-lg p-2 text-sm text-[#18372b] font-medium mb-3 focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
      >
        {PLATE_TEMPLATES.map((tmpl) => (
          <option key={tmpl.id} value={tmpl.id}>
            {tmpl.label}
          </option>
        ))}
      </select>

      {/* Visual Iranian Plate representation */}
      <div className={`iran-plate tone-${t.tone || 'white'} ${t.layout === 'motorcycle' ? 'layout-motorcycle' : ''}`}>
        {/* Blue I.R. IRAN Strip */}
        <div className="plate-band">
          <div className="plate-flag">
            <i />
            <i />
            <i />
          </div>
          <b>I.R.</b>
          <span>IRAN</span>
        </div>

        {/* National 4-Part Plate */}
        {t.layout === 'national' && (
          <div className="flex flex-1 items-center gap-1 min-w-0">
            {/* Left 2 digits */}
            <input
              type="text"
              inputMode="numeric"
              placeholder="۱۲"
              maxLength={2}
              value={currentParts.left || ''}
              onChange={(e) => handlePartChange('left', e.target.value)}
              className="plate-slot text-center"
              aria-label="دو رقم سمت چپ"
            />

            {/* Letter or Symbol */}
            {t.symbol ? (
              <span className="plate-symbol text-[#18372b]">{t.symbol}</span>
            ) : (
              <input
                type="text"
                placeholder="ب"
                maxLength={2}
                value={currentParts.letter || ''}
                onChange={(e) => handlePartChange('letter', e.target.value)}
                className="plate-slot plate-letter text-center"
                aria-label="حرف پلاک"
              />
            )}

            {/* Middle 3 digits */}
            <input
              type="text"
              inputMode="numeric"
              placeholder="۳۴۵"
              maxLength={3}
              value={currentParts.middle || ''}
              onChange={(e) => handlePartChange('middle', e.target.value)}
              className="plate-slot text-center"
              aria-label="سه رقم میانی"
            />

            {/* Iran Region Code */}
            <div className="plate-region">
              <small>ایران</small>
              <input
                type="text"
                inputMode="numeric"
                placeholder="۶۷"
                maxLength={2}
                value={currentParts.region || ''}
                onChange={(e) => handlePartChange('region', e.target.value)}
                className="plate-slot text-center"
                aria-label="کد دو رقمی منطقه ایران"
              />
            </div>
          </div>
        )}

        {/* Motorcycle Plate */}
        {t.layout === 'motorcycle' && (
          <div className="plate-motor-rows flex-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="۱۲۳"
              maxLength={3}
              value={currentParts.top || ''}
              onChange={(e) => handlePartChange('top', e.target.value)}
              className="plate-slot text-center border-b border-dashed border-gray-400 mb-1"
              aria-label="سه رقم بالا"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="۴۵۶۷۸"
              maxLength={5}
              value={currentParts.bottom || ''}
              onChange={(e) => handlePartChange('bottom', e.target.value)}
              className="plate-slot text-center"
              aria-label="پنج رقم پایین"
            />
          </div>
        )}

        {/* Freezone & Free Text */}
        {t.layout !== 'national' && t.layout !== 'motorcycle' && (
          <div className="flex flex-1 items-center gap-2 p-1">
            <input
              type="text"
              placeholder="شماره یا حروف پلاک را وارد کنید..."
              value={currentParts.text || ''}
              onChange={(e) => handlePartChange('text', e.target.value)}
              className="plate-slot text-center text-sm w-full"
            />
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#68795e] mt-2 leading-relaxed text-center">
        ارقام به صورت خودکار فارسی می‌شوند. در صورت عدم اطمینان، می‌توانید علامت «؟» وارد کنید یا وضعیت را به «بخشی را دیدم» تغییر دهید.
      </p>
    </div>
  );
};
