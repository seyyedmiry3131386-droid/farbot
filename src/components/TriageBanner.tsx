import React, { useState } from 'react';
import { Phone, AlertTriangle, ShieldAlert, Copy, Check } from 'lucide-react';
import { triageWording } from '../lib/situation.js';

interface TriageBannerProps {
  text: string;
}

const NUMBER_NAMES: Record<string, string> = {
  '۱۱۰': 'پلیس ۱۱۰',
  '۱۱۵': 'اورژانس ۱۱۵',
  '۱۲۵': 'آتش‌نشانی ۱۲۵',
  '۱۲۳': 'اورژانس اجتماعی ۱۲۳',
};

export const TriageBanner: React.FC<TriageBannerProps> = ({ text }) => {
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const triage = triageWording(text);

  if (!triage || triage.level === 'none' || !triage.numbers.length) {
    return null;
  }

  const isEmergency = triage.level === 'emergency';

  const copyToClipboard = (num: string) => {
    const raw = num.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    navigator.clipboard.writeText(raw);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div
      className={`rounded-2xl border p-4 mb-4 transition-all duration-300 animate-arrive ${
        isEmergency
          ? 'bg-[#fdeeeb] border-[#e06a5a] text-[#782319]'
          : 'bg-[#fff8e8] border-[#f0c36d] text-[#744c0a]'
      }`}
      role="alert"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isEmergency ? (
            <ShieldAlert className="w-5 h-5 text-[#c53929] flex-shrink-0 animate-pulse" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-[#d97706] flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-bold">
              {isEmergency
                ? 'توجه: رخداد دارای فوریت یا خطر جانی تشخیص داده شد!'
                : 'در صورت نیاز به امدادرسانی فوری یا حضور مأموران:'}
            </p>
            <p className="text-xs opacity-85 mt-0.5">
              پیش از پر کردن فرم، اولویت با تماس با شماره‌های امدادی و امدادرسانی به مصدومان است.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {triage.numbers.map((num: string) => {
            const rawNumber = num.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
            return (
              <div key={num} className="flex items-center gap-1 bg-white/90 border border-black/10 rounded-xl px-2.5 py-1.5 shadow-sm">
                <a
                  href={`tel:${rawNumber}`}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#18372b] hover:text-[#244b3b]"
                  title={`تماس با ${NUMBER_NAMES[num] || num}`}
                >
                  <Phone className="w-3.5 h-3.5 text-green-700" />
                  <span>{NUMBER_NAMES[num] || num}</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(num)}
                  className="p-1 text-gray-500 hover:text-gray-800 rounded transition"
                  aria-label={`کپی شماره ${num}`}
                >
                  {copiedNumber === num ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
