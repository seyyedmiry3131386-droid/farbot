import React, { useState } from 'react';
import { Shield, X, Check, AlertCircle } from 'lucide-react';
import { asciiDigits } from '../lib/plates.js';

interface ReporterIdentityModalProps {
  initialData: {
    name: string;
    province: string;
    mobile: string;
    rank: string;
    post: string;
  };
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    province: string;
    mobile: string;
    rank: string;
    post: string;
  }) => void;
}

export const ReporterIdentityModal: React.FC<ReporterIdentityModalProps> = ({
  initialData,
  onClose,
  onSubmit,
}) => {
  const getSaved = () => {
    try {
      const raw = localStorage.getItem('faraja_reporter_identity');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saved = getSaved() || {};
  const [name, setName] = useState(initialData.name || saved.name || '');
  const [province, setProvince] = useState(initialData.province || saved.province || 'تهران');
  const [mobile, setMobile] = useState(initialData.mobile || saved.mobile || '');
  const [rank, setRank] = useState(initialData.rank || saved.rank || '');
  const [post, setPost] = useState(initialData.post || saved.post || '');
  const [error, setError] = useState('');

  const handleMobileChange = (val: string) => {
    const raw = asciiDigits(val).replace(/\D/g, '');
    if (raw.length <= 11) {
      // If starts with 09..., drop leading 0 to get 10-digit format
      const cleaned = raw.startsWith('09') ? raw.slice(1) : raw;
      setMobile(cleaned);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('وارد کردن «نام و نام خانوادگی» الزامی است.');
      return;
    }
    if (!province.trim()) {
      setError('وارد کردن «استان» الزامی است.');
      return;
    }
    if (!mobile.trim()) {
      setError('وارد کردن «شماره همراه» الزامی است.');
      return;
    }

    const cleanMobile = asciiDigits(mobile).replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError('شماره همراه باید دقیقاً ۱۰ رقم بدون صفر اول باشد (مثلاً ۹۱۲۳۴۵۶۷۸۹).');
      return;
    }

    if (!rank.trim()) {
      setError('وارد کردن «عنوان رده» الزامی است.');
      return;
    }
    if (!post.trim()) {
      setError('وارد کردن «عنوان سمت» الزامی است.');
      return;
    }

    const reporterData = {
      name: name.trim(),
      province: province.trim(),
      mobile: cleanMobile,
      rank: rank.trim(),
      post: post.trim(),
    };

    try {
      localStorage.setItem('faraja_reporter_identity', JSON.stringify(reporterData));
    } catch {}

    onSubmit(reporterData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-arrive">
      <div className="bg-white dark:bg-[#15221b] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-[#dbe5df] dark:border-[#22372c] text-right">
        <div className="flex items-center justify-between pb-3 border-b border-[#e5ece8] dark:border-[#22372c] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#18372b] dark:text-[#e7eee9]">مشخصات گزارش‌دهنده</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1">نام و نام خانوادگی *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="علی رضایی"
              className="w-full bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-sm text-[#18372b] dark:text-[#e7eee9] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1">استان *</label>
              <input
                type="text"
                required
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="تهران"
                className="w-full bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-sm text-[#18372b] dark:text-[#e7eee9] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1">شماره همراه *</label>
              <input
                type="tel"
                required
                dir="ltr"
                value={mobile}
                onChange={(e) => handleMobileChange(e.target.value)}
                placeholder="9123456789"
                className="w-full bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-sm text-[#18372b] dark:text-[#e7eee9] text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1">عنوان رده *</label>
              <input
                type="text"
                required
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-full bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-sm text-[#18372b] dark:text-[#e7eee9] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1">عنوان سمت *</label>
              <input
                type="text"
                required
                value={post}
                onChange={(e) => setPost(e.target.value)}
                className="w-full bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-sm text-[#18372b] dark:text-[#e7eee9] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#e5ece8] dark:border-[#22372c] mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#dbe5df] dark:border-[#22372c] text-[#31493e] dark:text-[#c5d6cc] rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#244b3b] text-white rounded-xl text-xs font-bold hover:bg-[#18372b] flex items-center gap-1.5 shadow-xs transition"
            >
              <Check className="w-4 h-4" />
              <span>ثبت نهایی</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
