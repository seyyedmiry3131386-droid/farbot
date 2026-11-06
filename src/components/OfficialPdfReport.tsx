import React, { useRef } from 'react';
import { Printer, Download, X, FileText, CheckCircle2 } from 'lucide-react';
import { stripQuestionPrefix } from '../lib/domain.js';

interface OfficialPdfReportProps {
  report: {
    id: string;
    created?: string | number;
    title?: string;
    text: string;
    reporter: {
      name: string;
      province: string;
      mobile: string;
      rank: string;
      post: string;
      group?: string;
      teamNumber?: string;
    };
    newsDomain?: string | string[];
    analysis?: any;
    answers?: Record<string, any>;
    extra?: Record<string, any>;
    files?: Array<{ name: string; size: number; type: string; url?: string }>;
  };
  onClose?: () => void;
  isModal?: boolean;
}

// Persian digits converter
const toFaDigits = (n: any) => {
  if (n === null || n === undefined) return '';
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

// Format Persian date
const formatPersianDate = (dateVal?: string | number) => {
  try {
    const d = dateVal ? new Date(dateVal) : new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    return formatter.format(d);
  } catch {
    return '۱۴۰۳/۰۸/۰۹';
  }
};

export const OfficialPdfReport: React.FC<OfficialPdfReportProps> = ({
  report,
  onClose,
  isModal = true,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const rep = report.reporter || {
    name: '—',
    province: 'تهران',
    mobile: '—',
    rank: '—',
    post: '—',
  };

  const filesCount = report.files?.length || 0;
  const docType =
    filesCount === 0
      ? 'بدون مستند'
      : `${toFaDigits(filesCount)} مورد (${report.files?.map((f) => f.name.split('.').pop()).filter((v, i, a) => a.indexOf(v) === i).join('، ') || 'فایل'})`;

  // Determine Source (نحوه اطلاع)
  const sourceAnswer =
    report.answers?.source ||
    report.analysis?.known?.source ||
    'مشاهده مستقیم (گزارش‌دهنده شاهد رخداد بوده است)';

  // Determine Subject
  const topicTitle =
    report.title ||
    (Array.isArray(report.newsDomain) ? report.newsDomain.join(' - ') : report.newsDomain) ||
    'نزاع و درگیری خیابانی - انتظامی';

  // Merge structured details for section 5
  const known = report.analysis?.known || {};
  const answers = report.answers || {};

  // Extract structured facts with Persian labels
  const structuredItems: Array<{ label: string; value: string }> = [];

  if (known.actor || answers.person) {
    const pCountStr = known.peopleCount
      ? String(known.peopleCount).includes('نفر')
        ? `(مجموع: ${known.peopleCount})`
        : `(مجموع: ${known.peopleCount} نفر)`
      : '';
    structuredItems.push({
      label: 'فاعل و افراد حاضر',
      value: `${known.actor ? `شروع‌کننده: ${known.actor}` : ''} ${pCountStr} ${answers.person && answers.person !== 'خیر' ? answers.person : ''}`.trim(),
    });
  }

  if (known.time || answers.time) {
    structuredItems.push({
      label: 'زمان وقوع',
      value: `${known.time || answers.time || '—'}`.trim(),
    });
  }

  if (known.place || answers.place) {
    structuredItems.push({
      label: 'مکان وقوع',
      value: `${known.place || answers.place || '—'}`.trim(),
    });
  }

  if (known.reason || answers.reason) {
    structuredItems.push({
      label: 'علت و انگیزه رخداد',
      value: `${known.reason || answers.reason || '—'}`.trim(),
    });
  }

  if (answers.method) {
    structuredItems.push({
      label: 'روش و ابزار مورد استفاده',
      value: `${answers.method}`.trim(),
    });
  }

  if (answers.vehicle && answers.vehicle !== 'خیر') {
    structuredItems.push({
      label: 'وسیله نقلیه مرتبط',
      value: `${answers.vehicle}`.trim(),
    });
  }

  if (answers.object && answers.object !== 'خیر') {
    structuredItems.push({
      label: 'اموال و اشیاء مرتبط',
      value: `${answers.object}`.trim(),
    });
  }

  if (answers.contact && answers.contact !== 'خیر') {
    structuredItems.push({
      label: 'راه‌های ارتباطی مرتبط',
      value: `${answers.contact}`.trim(),
    });
  }

  const getPersianItemLabel = (key: string, valObj?: any): string => {
    if (valObj && typeof valObj === 'object' && valObj.label) {
      return String(valObj.label);
    }
    const clean = stripQuestionPrefix(key);
    const map: Record<string, string> = {
      source: 'نحوه اطلاع گزارشگر',
      person: 'فاعل و افراد مرتبط',
      time: 'زمان وقوع',
      place: 'مکان وقوع',
      reason: 'علت و انگیزه رخداد',
      method: 'روش و ابزار مورد استفاده',
      vehicle: 'وسیله نقلیه',
      object: 'اموال و اشیاء',
      contact: 'راه‌های ارتباطی',
      details: 'شرح جزئیات رخداد',
      clarify: 'رفتار مشاهده‌شده',
      appearance: 'مشخصات ظاهری افراد',
      license_plate: 'شماره پلاک خودرو',
      bank_account: 'اطلاعات بانکی',
      person_identity: 'هویت و مشخصات فرد / فاعل',
      contact_info: 'شماره تماس / آیدی مجازی',
      website_url: 'نشانی سایت / فروشگاه اینترنتی',
      item_or_amount: 'کالا، مال یا مبلغ مورد نظر',
    };
    if (map[clean]) return map[clean];
    if (clean.startsWith('details_')) {
      const ev = clean.slice(8);
      const evNames: Record<string, string> = {
        assault: 'نزاع و درگیری',
        theft: 'سرقت',
        fraud: 'کلاهبرداری',
        service: 'نقص خدمات شهری',
        damage: 'خسارت و تخریب',
        drugs: 'مواد مخدر / مفاسد',
        other: 'رخداد',
      };
      return `جزئیات ${evNames[ev] || 'رخداد'}`;
    }
    return clean;
  };

  // Add any other question or structured entity answers with Persian title
  Object.entries(answers).forEach(([qId, val]) => {
    if (
      !['source', 'person', 'time', 'place', 'reason', 'method', 'vehicle', 'object', 'contact'].includes(
        qId
      ) &&
      val &&
      val !== 'خیر' &&
      val !== 'اطلاعات بیشتری ندارم'
    ) {
      const formattedVal =
        typeof val === 'object'
          ? String(
              val.value ||
                Object.values(val.fields || {})
                  .map((x) => String(x || '').trim())
                  .filter(Boolean)
                  .join(' — ') ||
                ''
            ).trim()
          : String(val).trim();
      if (formattedVal) {
        structuredItems.push({
          label: getPersianItemLabel(qId, val),
          value: formattedVal,
        });
      }
    }
  });

  const content = (
    <div
      ref={printRef}
      className="faraja-official-document w-full max-w-[820px] mx-auto bg-white text-black p-6 sm:p-10 font-sans text-right select-text shadow-md border border-gray-300 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full"
      dir="rtl"
    >
      {/* HEADER SECTION */}
      <div className="relative border-b-2 border-black pb-4 mb-4">
        {/* Right emblem: Faraja Police Crest */}
        <div className="absolute right-0 top-0 w-16 h-16 flex items-center justify-center">
          <img
            src="/assets/favicon.svg"
            alt="آرم سازمان فراجا"
            className="w-14 h-14 object-contain"
          />
        </div>

        {/* Center top emblem: Emblem of the Islamic Republic of Iran (Allah) */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-11 h-11 mb-1 text-black flex items-center justify-center">
            {/* SVG of Islamic Republic of Iran Coat of Arms */}
            <svg
              viewBox="0 0 200 200"
              className="w-10 h-10 fill-current"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M100 20 C96 35 90 60 90 90 C90 120 96 145 100 160 C104 145 110 120 110 90 C110 60 104 35 100 20 Z" />
              <path d="M100 165 C60 165 40 135 40 100 C40 85 45 70 55 55 C50 70 50 85 55 100 C62 120 78 145 100 152 Z" />
              <path d="M100 165 C140 165 160 135 160 100 C160 85 155 70 145 55 C150 70 150 85 145 100 C138 120 122 145 100 152 Z" />
              <path d="M100 145 C80 145 68 125 68 100 C68 85 74 72 82 62 C78 72 78 84 82 96 C86 108 92 125 100 135 Z" />
              <path d="M100 145 C120 145 132 125 132 100 C132 85 126 72 118 62 C122 72 122 84 118 96 C114 108 108 125 100 135 Z" />
              <path d="M96 12 C96 8 104 8 104 12 C104 15 96 15 96 12 Z" />
            </svg>
          </div>

          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-center leading-normal">
            سازمان سوم فرماندهی جمهوری اسلامی ایران
          </h1>
        </div>
      </div>

      {/* FORM TITLE */}
      <div className="text-center my-3">
        <h2 className="text-base sm:text-lg font-extrabold tracking-wide inline-block pb-1">
          فرم گزارش خبری
        </h2>
      </div>

      {/* SECTION 1: شناسه گزارش */}
      <div className="mb-4">
        <div className="text-xs font-bold mb-1 text-right">۱- شناسه گزارش</div>
        <table className="w-full border-collapse border border-black text-center text-xs">
          <tbody>
            <tr>
              <td className="border border-black p-1.5 font-bold w-[12%]">تاریخ تنظیم</td>
              <td className="border border-black p-1.5 font-mono w-[18%]">{formatPersianDate(report.created)}</td>
              <td className="border border-black p-1.5 font-bold w-[14%]">شماره گزارش</td>
              <td className="border border-black p-1.5 font-mono text-[11px] font-bold tracking-tight w-[28%] break-all" dir="ltr">
                {report.id || 'RPT-FA4008ABC12984838A9D'}
              </td>
              <td className="border border-black p-1.5 font-bold w-[14%]">نوع مستندات</td>
              <td className="border border-black p-1.5 w-[14%]">{docType}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 2: شناسه گزارشگر */}
      <div className="mb-4">
        <div className="text-xs font-bold mb-1 text-right">۲- شناسه گزارشگر</div>
        <table className="w-full border-collapse border border-black text-center text-xs">
          <tbody>
            <tr>
              <td className="border border-black p-1.5 font-bold w-[16%]">استان</td>
              <td className="border border-black p-1.5 w-[17%]">{rep.province || 'کرج'}</td>
              <td className="border border-black p-1.5 font-bold w-[16%]">عنوان رده</td>
              <td className="border border-black p-1.5 w-[17%]">{rep.rank || 'سبل'}</td>
              <td className="border border-black p-1.5 font-bold w-[16%]">شماره رده</td>
              <td className="border border-black p-1.5 font-mono w-[18%]">{toFaDigits(rep.mobile || '329047233')}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold">شماره دسته</td>
              <td className="border border-black p-1.5 font-mono">{toFaDigits(rep.group || '3')}</td>
              <td className="border border-black p-1.5 font-bold">شماره گروه</td>
              <td className="border border-black p-1.5 font-mono">{toFaDigits(rep.teamNumber || '425')}</td>
              <td className="border border-black p-1.5 font-bold">عنوان تیم</td>
              <td className="border border-black p-1.5">{rep.post || rep.name || 'رسن.'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 3: موضوع گزارش */}
      <div className="mb-4">
        <div className="text-xs font-bold mb-1">۳- موضوع گزارش</div>
        <div className="border border-black p-2.5 text-xs font-bold bg-white text-right leading-relaxed">
          {topicTitle}
        </div>
      </div>

      {/* SECTION 4: نحوه اطلاع گزارشگر */}
      <div className="mb-4">
        <div className="text-xs font-bold mb-1">۴- نحوه اطلاع گزارشگر</div>
        <div className="border border-black p-2.5 text-xs bg-white text-right leading-relaxed font-medium">
          {sourceAnswer}
        </div>
      </div>

      {/* SECTION 5: شرح گزارش */}
      <div className="mb-4">
        <div className="text-xs font-bold mb-1">۵- شرح گزارش</div>
        <div className="border border-black p-3.5 text-xs bg-white min-h-[220px] text-right space-y-3 leading-relaxed">
          {/* Main Narrative */}
          <div className="whitespace-pre-wrap font-sans text-justify text-sm leading-relaxed">
            {report.text}
          </div>

          {/* Unified extracted and structured findings */}
          {structuredItems.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-300">
              <span className="font-bold block text-xs mb-2">اطلاعات تکمیلی استخراج‌شده و مستندات:</span>
              <table className="w-full border-collapse border border-gray-400 text-xs text-right">
                <tbody>
                  {structuredItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="border-l border-gray-400 p-1.5 bg-gray-50 font-bold w-1/3">
                        {item.label}
                      </td>
                      <td className="p-1.5 w-2/3">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Files listing if present */}
          {report.files && report.files.length > 0 && (
            <div className="mt-3 pt-2 text-[11px] text-gray-700">
              <span className="font-bold">فهرست پیوست‌ها: </span>
              {report.files.map((f, i) => (
                <span key={i} className="ml-2">
                  [{i + 1}] {f.name} ({Math.round(f.size / 1024)} کیلوبایت)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER NOTICE */}
      <div className="pt-3 border-t border-gray-300 text-[10px] text-gray-600 text-center flex items-center justify-between">
        <span>سامانه هوشمند ثبت و ارزیابی اخبار و گزارشات فراجا</span>
        <span>محرمانه - ویژه استفاده سازمانی</span>
        <span>شناسه رهگیری: {report.id}</span>
      </div>
    </div>
  );

  if (!isModal) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-[#244b3b] hover:bg-[#18372b] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            چاپ و ذخیره به عنوان PDF
          </button>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-arrive overflow-y-auto">
      <div className="bg-white dark:bg-[#0e1612] rounded-2xl max-w-4xl w-full my-auto flex flex-col shadow-2xl border border-gray-300 dark:border-[#22372c] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#22372c] bg-gray-50 dark:bg-[#14231b] print:hidden">
          <div className="flex items-center gap-2 text-right">
            <FileText className="w-5 h-5 text-[#244b3b] dark:text-[#a0dbbf]" />
            <h3 className="text-sm font-bold text-[#18372b] dark:text-[#e7eee9]">
              نسخه رسمی گزارش (قالب استاندارد فراجا)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#244b3b] hover:bg-[#18372b] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-lg transition"
                title="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[80vh] bg-gray-100 dark:bg-[#0a0f0c]">
          {content}
        </div>
      </div>
    </div>
  );
};
