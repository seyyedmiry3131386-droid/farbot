import React, { useState } from 'react';
import { X, Search, Shield, BookOpen, Info, Settings, Lock, Check } from 'lucide-react';
import { CATEGORIES } from '../lib/question-bank.js';
import { EVENTS } from '../lib/scenarios.js';

interface ModalWrapperProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-arrive">
    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#dbe5df] text-right">
      <div className="flex items-center justify-between p-5 border-b border-[#e5ece8]">
        <h3 className="text-base font-bold text-[#18372b]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 overflow-y-auto space-y-4 text-sm text-[#31493e] leading-relaxed">
        {children}
      </div>
    </div>
  </div>
);

// 1. Topic Selector Modal
export const TopicSelectorModal: React.FC<{
  currentEvents: string[];
  onApply: (events: string[]) => void;
  onClose: () => void;
}> = ({ currentEvents, onApply, onClose }) => {
  const [selected, setSelected] = useState<string[]>(currentEvents);
  const [query, setQuery] = useState('');

  const [deptFilter, setDeptFilter] = useState('all');

  const departments = [
    'همه',
    'پلیس آگاهی',
    'پلیس امنیت عمومی',
    'پلیس فتا',
    'پلیس مبارزه با مواد مخدر',
    'پلیس امنیت اقتصادی',
    'پلیس پیشگیری',
    'پلیس راهور',
  ];

  const allEntries = Object.entries(EVENTS);
  const filtered = allEntries.filter(([id, e]: [string, any]) => {
    const matchesQuery =
      (e.title || '').includes(query) ||
      (e.detail || '').includes(query) ||
      (e.department || '').includes(query) ||
      id.includes(query);

    const matchesDept =
      deptFilter === 'all' ||
      deptFilter === 'همه' ||
      (e.department && e.department.includes(deptFilter));

    return matchesQuery && matchesDept;
  });

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );
  };

  return (
    <ModalWrapper title="انتخاب و اصلاح عناوین و موضوعات جرائم و رویدادها" onClose={onClose}>
      <p className="text-xs text-gray-600">
        عناوین و دسته‌بندی‌های رسمی فراجا و ارگان‌های انتظامی و امنیتی. می‌توانید یک یا چند موضوع مرتبط را انتخاب نمایید.
      </p>

      {/* Department Filter Badges */}
      <div className="flex flex-wrap gap-1.5 my-2">
        {departments.map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => setDeptFilter(dept)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              deptFilter === dept || (dept === 'همه' && deptFilter === 'all')
                ? 'bg-[#244b3b] text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      <div className="relative my-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در عناوین پلیس آگاهی، فتا، امنیت، راهور و مواد مخدر…"
          className="w-full bg-[#fcfdfa] border border-[#d9e3dd] rounded-xl pl-9 pr-3 py-2 text-xs text-[#18372b] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
        />
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
        {filtered.map(([id, ev]: [string, any]) => {
          const isChecked = selected.includes(id);
          return (
            <label
              key={id}
              onClick={() => toggle(id)}
              className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                isChecked
                  ? 'bg-[#edf5f0] border-[#244b3b] text-[#18372b] font-bold'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {}}
                className="mt-0.5 accent-[#244b3b]"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span>{ev.title}</span>
                  {ev.department && (
                    <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-normal shrink-0">
                      {ev.department}
                    </span>
                  )}
                </div>
                {ev.hint && <p className="text-[10px] text-gray-500 font-normal line-clamp-1">{ev.hint}</p>}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-[#e5ece8]">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-[#dbe5df] text-[#31493e] rounded-xl text-xs font-semibold"
        >
          انصراف
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(selected);
            onClose();
          }}
          className="px-5 py-2 bg-[#244b3b] text-white rounded-xl text-xs font-bold hover:bg-[#18372b]"
        >
          اعمال موضوعات
        </button>
      </div>
    </ModalWrapper>
  );
};

// 2. Question Bank Modal
export const QuestionBankModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalWrapper title="بانک سؤال‌های جامع ثبت گزارش (راوی)" onClose={onClose}>
    <p className="text-xs text-gray-600 mb-3">
      بانک استاندارد بر پایه ۴ دسته اصلی (فرد، مکان، رخداد و شیء) و بیش از ۷۰ موضوع عملیاتی طبقه‌بندی شده است.
    </p>
    <div className="space-y-3">
      {Object.entries(CATEGORIES).map(([catKey, cat]: any) => (
        <div key={catKey} className="border border-[#dfe9e3] rounded-xl p-3.5 bg-[#fcfdfa]">
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen className="w-4 h-4 text-[#244b3b]" />
            <h4 className="text-sm font-bold text-[#18372b]">{cat.title}</h4>
          </div>
          <p className="text-xs text-gray-600 mb-2">{cat.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {cat.sections?.map((sec: string) => (
              <span key={sec} className="px-2 py-0.5 bg-[#edf5f0] text-[#244b3b] text-[11px] rounded-md font-medium">
                {sec}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </ModalWrapper>
);

// 3. Help Modal
export const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalWrapper title="راهنمای کاربری سامانه ثبت گزارش راوی" onClose={onClose}>
    <div className="space-y-4">
      <div>
        <h4 className="font-bold text-[#18372b] mb-1">۱. روایت رویداد</h4>
        <p className="text-xs text-gray-600">
          آنچه رخ داده را به زبان خودتان بنویسید یا با ضبط صدا بیان کنید. اگر نمی‌دانید چطور آغاز کنید، دکمه «دستیار گام‌به‌گام» را بزنید.
        </p>
      </div>
      <div>
        <h4 className="font-bold text-[#18372b] mb-1">۲. تحلیل و استخراج هوشمند</h4>
        <p className="text-xs text-gray-600">
          مدل هوش مصنوعی Gemini و موتور محلی گزارش شما را بررسی کرده و اطلاعات کلیدی و موضوعات مربوطه را جهت بازبینی به شما نشان می‌دهند.
        </p>
      </div>
      <div>
        <h4 className="font-bold text-[#18372b] mb-1">۳. تکمیل سؤال‌ها و پلاک</h4>
        <p className="text-xs text-gray-600">
          سؤال‌های باقی‌مانده و اطلاعات تکمیلی مثل پلاک، اشخاص و راه‌های تماس را تکمیل کنید. گزینه «نمی‌دانم» همواره معتبر است.
        </p>
      </div>
      <div>
        <h4 className="font-bold text-[#18372b] mb-1">۴. پیوست مستندات و ثبت نهایی</h4>
        <p className="text-xs text-gray-600">
          عکس، ویدئو یا فایل صوتی مربوطه را بارگذاری کنید، اطلاعات گزارش‌دهنده را تأیید کرده و شناسه رهگیری گزارش را دریافت کنید.
        </p>
      </div>
    </div>
  </ModalWrapper>
);

// 4. About Modal
export const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalWrapper title="درباره سامانه راوی | سازمان رزم سوم فراجا" onClose={onClose}>
    <div className="text-center py-2">
      <img src="/assets/faraja.webp" alt="لوگوی فراجا" className="w-20 h-20 mx-auto object-contain mb-3" />
      <h4 className="font-bold text-base text-[#18372b]">سامانه هوشمند ثبت و تحلیل گزارش‌های راوی</h4>
      <p className="text-xs text-gray-500 mt-1">فرماندهی انتظامی جمهوری اسلامی ایران</p>
    </div>
    <p className="text-xs text-gray-700 leading-relaxed text-justify">
      این سامانه جهت تسهیل و تسریع فرایند دریافت گزارش‌های دقیق، طبقه‌بندی ساختاریافته رویدادها، کشف حقایق مستند و هدایت مصاحبه با بهره‌گیری از مدل‌های پیشرفته هوش مصنوعی و پردازش زبان طبیعی فارسی توسعه یافته است.
    </p>
    <div className="bg-[#edf5f0] p-3 rounded-xl text-xs text-[#244b3b] font-medium text-center">
      شعاری از جنس تعهد: كُونُوا قَوَّامِينَ لِلَّهِ شُهَدَاءَ بِالْقِسْطِ
    </div>
  </ModalWrapper>
);

// 5. Settings Modal
export const SettingsModal: React.FC<{
  aiConfig: any;
  onClose: () => void;
}> = ({ aiConfig, onClose }) => (
  <ModalWrapper title="تنظیمات و وضعیت مدل هوش مصنوعی" onClose={onClose}>
    <div className="space-y-4">
      <div className="p-4 bg-[#f8fbf9] border border-[#dfe9e3] rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-[#244b3b]" />
          <h4 className="font-bold text-sm text-[#18372b]">وضعیت اتصال هوش مصنوعی</h4>
        </div>
        <div className="space-y-1.5 text-xs text-gray-700">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">مدل تحلیلی فعال:</span>
            <span className="font-bold text-[#244b3b] font-mono">Gemini 3.8 Flash</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">سرویس تبدیل گفتار به متن:</span>
            <span className="font-bold text-[#244b3b]">Gemini Transcribe (fa-IR)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">موتور پردازش موازی داخلی:</span>
            <span className="font-bold text-emerald-700">فعال (بدون وابستگی)</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-500">وضعیت سرویس:</span>
            <span className="inline-flex items-center gap-1 text-green-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              متصل و آماده پاسخگویی
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        تحلیل محتوا، طبقه‌بندی ۷۰ موضوعی، و دستیار هدایت مصاحبه با بالاترین دقت از سوی مدل هوش مصنوعی پشتیبانی می‌شود. در صورت قطع شبکه، موتور داخلی بدون وقفه به کار ادامه خواهد داد.
      </p>
    </div>
  </ModalWrapper>
);

// 6. Privacy Modal
export const PrivacyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <ModalWrapper title="حریم خصوصی و امنیت داده‌ها" onClose={onClose}>
    <div className="space-y-3 text-xs text-gray-700 leading-relaxed text-justify">
      <div className="flex items-center gap-2 text-[#244b3b] font-bold">
        <Lock className="w-4 h-4" />
        حفاظت از اطلاعات شهروندان و مأموران
      </div>
      <p>
        اطلاعات پیش‌نویس، فایل‌های مستندات و گزارش‌های ذخیره‌شده شما در حافظه امن مرورگر نگهداری می‌شوند.
      </p>
      <p>
        تحلیل‌های هوش مصنوعی صرفاً بر روی گزاره‌های گزارش‌شده جهت تدوین و دسته‌بندی موضوعی اعمال شده و اطلاعات هویتی غیرضروری استخراج نمی‌گردد.
      </p>
      <p>
        از وارد کردن اطلاعات محرمانه نظیر رمز کارت بانکی یا داده‌های خصوصی غیرمرتبط خودداری نمایید.
      </p>
    </div>
  </ModalWrapper>
);
