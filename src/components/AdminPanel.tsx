import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Shield,
  FileText,
  Users,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  LogOut,
  Printer,
  Lock,
  Eye,
  RefreshCw,
  Award,
  Smartphone,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { OfficialPdfReport } from './OfficialPdfReport.tsx';

interface AdminPanelProps {
  reports: any[];
  onUpdateReportStatus?: (id: string, status: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  reports: initialReports,
  onUpdateReportStatus,
  theme = 'light',
  onToggleTheme,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('faraja_admin_session') === 'true';
    } catch {
      return false;
    }
  });
  const [loadingReports, setLoadingReports] = useState<boolean>(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin tabs: 'monitoring' | 'performance'
  const [tab, setTab] = useState<'monitoring' | 'performance'>('monitoring');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');

  // Modals
  const [selectedReportForPdf, setSelectedReportForPdf] = useState<any | null>(null);
  const [selectedReportDetails, setSelectedReportDetails] = useState<any | null>(null);
  const [showApkModal, setShowApkModal] = useState<boolean>(false);

  // Reports list backed by Cloud SQL
  const [reportsList, setReportsList] = useState<any[]>(() => {
    try {
      const savedStatus = JSON.parse(localStorage.getItem('faraja_reports_status') || '{}');
      return initialReports.map((r) => ({
        ...r,
        status: savedStatus[r.id] || r.status || 'جدید',
      }));
    } catch {
      return initialReports.map((r) => ({ ...r, status: r.status || 'جدید' }));
    }
  });

  // Fetch all submitted reports from Cloud SQL
  const fetchCloudSqlReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          const dbReports = data.reports;
          const byId = new Map<string, any>();
          for (const r of dbReports) {
            if (r?.id) byId.set(r.id, r);
          }
          // Merge any local reports not yet in DB and push them to Cloud SQL
          for (const localRep of initialReports) {
            if (localRep?.id && !byId.has(localRep.id)) {
              byId.set(localRep.id, localRep);
              fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localRep),
              }).catch(() => {});
            }
          }
          const merged = Array.from(byId.values()).sort(
            (a, b) => (Number(b.created) || 0) - (Number(a.created) || 0)
          );
          setReportsList(merged);
        }
      }
    } catch {
      // Keep current list on transient offline error
    } finally {
      setLoadingReports(false);
    }
  }, [initialReports]);

  useEffect(() => {
    fetchCloudSqlReports();
  }, [fetchCloudSqlReports, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password === 'admin') {
      setIsAuthenticated(true);
      try {
        localStorage.setItem('faraja_admin_session', 'true');
      } catch {}
      setLoginError('');
    } else {
      setLoginError('نام کاربری یا کلمه عبور نادرست است. (نام کاربری: admin / کلمه عبور: admin)');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('faraja_admin_session');
    } catch {}
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const updated = reportsList.map((r) => (r.id === id ? { ...r, status: newStatus } : r));
    setReportsList(updated);
    try {
      const saved = JSON.parse(localStorage.getItem('faraja_reports_status') || '{}');
      saved[id] = newStatus;
      localStorage.setItem('faraja_reports_status', JSON.stringify(saved));
    } catch {}
    if (onUpdateReportStatus) {
      onUpdateReportStatus(id, newStatus);
    }
    try {
      await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {}
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reportsList.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        (r.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.text || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.reporter?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.reporter?.rank || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesProvince = provinceFilter === 'all' || r.reporter?.province === provinceFilter;

      return matchesSearch && matchesStatus && matchesProvince;
    });
  }, [reportsList, searchTerm, statusFilter, provinceFilter]);

  // Performance calculations by reporter
  const reporterPerformance = useMemo(() => {
    const map = new Map<string, any>();

    reportsList.forEach((r) => {
      const key = r.reporter?.name ? `${r.reporter.name}_${r.reporter.mobile}` : 'نامشخص';
      if (!map.has(key)) {
        map.set(key, {
          name: r.reporter?.name || 'گزارش‌دهنده ناشناس',
          rank: r.reporter?.rank || 'یگان نامشخص',
          post: r.reporter?.post || '—',
          province: r.reporter?.province || 'تهران',
          mobile: r.reporter?.mobile || '—',
          reportsCount: 0,
          verifiedCount: 0,
          hasFilesCount: 0,
          qualityScoreSum: 0,
        });
      }

      const entry = map.get(key);
      entry.reportsCount += 1;
      if (r.status === 'اقدام‌شده' || r.status === 'مختومه') {
        entry.verifiedCount += 1;
      }
      if (r.files && r.files.length > 0) {
        entry.hasFilesCount += 1;
      }

      const answersCount = Object.keys(r.answers || {}).length;
      const textLen = (r.text || '').length;
      let score = 70;
      if (answersCount >= 3) score += 15;
      if (textLen > 100) score += 10;
      if (r.files?.length) score += 5;
      entry.qualityScoreSum += Math.min(score, 100);
    });

    return Array.from(map.values()).map((p) => ({
      ...p,
      avgQuality: Math.round(p.qualityScoreSum / p.reportsCount),
      verificationRate: Math.round((p.verifiedCount / p.reportsCount) * 100),
      rankBadge:
        p.qualityScoreSum / p.reportsCount >= 90
          ? 'عالی'
          : p.qualityScoreSum / p.reportsCount >= 75
          ? 'خیلی خوب'
          : 'قابل قبول',
    }));
  }, [reportsList]);

  // Provinces list for filter
  const provinces = useMemo(() => {
    const set = new Set<string>();
    reportsList.forEach((r) => {
      if (r.reporter?.province) set.add(r.reporter.province);
    });
    return Array.from(set);
  }, [reportsList]);

  // Export CSV
  const exportCsv = () => {
    const headers = 'شناسه,تاریخ,عنوان,گزارش دهنده,رده,استان,تعداد مستندات,وضعیت\n';
    const rows = filteredReports
      .map(
        (r) =>
          `"${r.id}","${new Date(r.created || Date.now()).toLocaleDateString('fa-IR')}","${(r.title || '').replace(/"/g, '""')}","${r.reporter?.name || ''}","${r.reporter?.rank || ''}","${r.reporter?.province || ''}","${r.files?.length || 0}","${r.status || 'جدید'}"`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faraja_reports_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Status counts (overall & last 24 hours)
  const newCount = useMemo(
    () => reportsList.filter((r) => (r.status || 'جدید') === 'جدید').length,
    [reportsList]
  );
  const inProgressCount = useMemo(
    () =>
      reportsList.filter(
        (r) => r.status === 'در حال بررسی' || r.status === 'در حال پیگیری'
      ).length,
    [reportsList]
  );
  const resolvedCount = useMemo(
    () =>
      reportsList.filter((r) => r.status === 'اقدام‌شده' || r.status === 'مختومه').length,
    [reportsList]
  );

  // Statistical summary for reports registered in the last 24 hours and status breakdown
  const last24hStats = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = reportsList.filter((r) => Number(r.created || 0) >= cutoff);
    const recentNew = recent.filter((r) => (r.status || 'جدید') === 'جدید').length;
    const recentInReview = recent.filter(
      (r) => r.status === 'در حال بررسی' || r.status === 'در حال پیگیری'
    ).length;
    const recentClosed = recent.filter(
      (r) => r.status === 'مختومه' || r.status === 'اقدام‌شده'
    ).length;
    return {
      total24h: recent.length,
      recentNew,
      recentInReview,
      recentClosed,
    };
  }, [reportsList]);

  // IF NOT AUTHENTICATED: Standalone Login Screen (No Google Login, No Citizen App Back Link)
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-[#f3f7f5] dark:bg-[#0a110d] flex flex-col justify-center items-center p-4 text-right font-vazir"
        dir="rtl"
      >
        <div className="w-full max-w-md bg-white dark:bg-[#15221b] border border-[#d9e3dd] dark:border-[#22372c] rounded-3xl p-6 sm:p-8 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-[#606b65] dark:text-[#90a397]">
              سازمان رزم سوم فراجا
            </span>
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-9 h-9 rounded-xl bg-[#f4f7f5] dark:bg-[#1a2b22] border border-[#dbe5df] dark:border-[#284235] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center cursor-pointer"
                title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
                aria-label="تغییر حالت شب و روز"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : (
                  <Moon className="w-4 h-4 text-[#244b3b]" />
                )}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center justify-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center mb-3 border border-[#cfe0d6] dark:border-[#284635]">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#18372b] dark:text-[#e7eee9]">
              سامانه پایش و مدیریت گزارشات
            </h1>
            <p className="text-xs text-[#606b65] dark:text-[#90a397] mt-1">
              درگاه اختصاصی مدیران و بازرسان کارتابل متمرکز
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-username"
                className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1.5"
              >
                نام کاربری
              </label>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full min-h-[44px] bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] text-sm text-[#18372b] dark:text-[#e7eee9] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold text-[#31493e] dark:text-[#c5d6cc] mb-1.5"
              >
                کلمه عبور
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                className="w-full min-h-[44px] bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] text-sm text-[#18372b] dark:text-[#e7eee9] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
            </div>

            <button
              type="submit"
              data-testid="admin-login-submit"
              className="w-full min-h-[46px] py-3 bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] dark:hover:bg-[#23503e] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>ورود به پنل مدیریت</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#e5ece8] dark:border-[#22372c] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#606b65] dark:text-[#90a397]">
              نسخه اندروید سامانه‌ها:
            </span>
            <div className="flex items-center gap-2">
              <a
                href="/download/ravi-admin.apk"
                download="ravi-admin.apk"
                className="px-2.5 py-1.5 rounded-lg bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] text-[11px] font-bold hover:bg-[#dfece4] transition inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>APK پنل مدیریت</span>
              </a>
              <a
                href="/download/ravi-citizen.apk"
                download="ravi-citizen.apk"
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-[#111c16] text-[#31493e] dark:text-[#c5d6cc] text-[11px] font-bold hover:bg-gray-200 transition inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>APK ثبت گزارش</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f4f7f5] dark:bg-[#0d1611] text-[#18372b] dark:text-[#e7eee9] text-right font-vazir flex flex-col"
      dir="rtl"
    >
      {/* Compact Sticky Top Admin Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#15221b]/95 backdrop-blur-xs border-b border-[#e1e9e4] dark:border-[#22372c]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center shrink-0 border border-[#cfe0d6] dark:border-[#284635]">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-[#18372b] dark:text-[#e7eee9] truncate">
                سامانه پایش و مدیریت گزارشات فراجا
              </h1>
              <p className="text-[10px] sm:text-[11px] text-[#606b65] dark:text-[#90a397] hidden sm:block truncate">
                کارتابل متمرکز بررسی، تعیین وضعیت و ارزیابی گزارش‌های ارسالی
              </p>
            </div>
          </div>

          {/* Zone 2: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchCloudSqlReports}
              disabled={loadingReports}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 bg-[#edf5f0] dark:bg-[#1a2f24] border border-[#cfe0d6] dark:border-[#284635] text-[#244b3b] dark:text-[#a0dbbf] text-xs font-bold rounded-xl hover:bg-[#dfece4] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              title="به‌روزرسانی از پایگاه داده"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loadingReports ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">به‌روزرسانی</span>
            </button>

            <button
              type="button"
              onClick={() => setShowApkModal(true)}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 bg-white dark:bg-[#111c16] border border-[#dbe5df] dark:border-[#284235] text-[#244b3b] dark:text-[#a0dbbf] text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a2b22] flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              title="دریافت فایل نصبی اندروید (APK)"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>دریافت APK</span>
            </button>

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-9 h-9 rounded-xl bg-white dark:bg-[#1a2b22] border border-[#dbe5df] dark:border-[#284235] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center cursor-pointer shrink-0"
                title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
                aria-label="تغییر حالت شب و روز"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : (
                  <Moon className="w-4 h-4 text-[#244b3b]" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 border border-red-200/60 dark:border-red-900/50 rounded-xl flex items-center gap-1.5 transition font-bold cursor-pointer whitespace-nowrap"
              title="خروج از پنل مدیریت"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* 24-Hour & Status Breakdown Statistical Card */}
        <div
          data-testid="admin-24h-status-card"
          className="bg-white dark:bg-[#15221b] border border-[#d6e4dc] dark:border-[#254032] rounded-2xl p-4 sm:p-5 shadow-2xs"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left/Right Main 24h Counter */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#edf5f0] dark:bg-[#1a2f24] border border-[#cfe0d6] dark:border-[#284635] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-extrabold text-[#18372b] dark:text-[#e7eee9]">
                    آمار گزارش‌های ثبت‌شده در ۲۴ ساعت گذشته و وضعیت‌ها
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    ۲۴ ساعت اخیر
                  </span>
                </div>
                <p className="text-[11px] text-[#606b65] dark:text-[#90a397] mt-0.5">
                  تعداد کل گزارش‌های دریافتی در شبانه‌روز اخیر به تفکیک وضعیت (جدید، در حال بررسی، مختومه)
                </p>
              </div>
            </div>

            {/* 4-Column Breakdown Inside the Statistical Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 lg:min-w-[540px]">
              <div className="p-2.5 sm:p-3 rounded-xl bg-[#f4f8f6] dark:bg-[#101b15] border border-[#e1ebe5] dark:border-[#22372c] flex flex-col justify-between">
                <span className="text-[11px] font-bold text-[#31493e] dark:text-[#c5d6cc]">
                  ثبت‌شده (۲۴ ساعت اخیر)
                </span>
                <div className="flex items-baseline justify-between gap-1 mt-1.5">
                  <span
                    data-testid="stat-24h-total"
                    className="text-lg sm:text-xl font-extrabold text-[#18372b] dark:text-[#e7eee9] tabular-nums"
                  >
                    {last24hStats.total24h.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-[#606b65] dark:text-[#90a397] tabular-nums">
                    از {reportsList.length.toLocaleString('fa-IR')} کل
                  </span>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  وضعیت: جدید
                </span>
                <div className="flex items-baseline justify-between gap-1 mt-1.5">
                  <span
                    data-testid="stat-status-new"
                    className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums"
                  >
                    {newCount.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 tabular-nums">
                    ۲۴ساعت: {last24hStats.recentNew.toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                  وضعیت: در حال بررسی
                </span>
                <div className="flex items-baseline justify-between gap-1 mt-1.5">
                  <span
                    data-testid="stat-status-inreview"
                    className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums"
                  >
                    {inProgressCount.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-blue-700/80 dark:text-blue-300/80 tabular-nums">
                    ۲۴ساعت: {last24hStats.recentInReview.toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  وضعیت: مختومه
                </span>
                <div className="flex items-baseline justify-between gap-1 mt-1.5">
                  <span
                    data-testid="stat-status-closed"
                    className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums"
                  >
                    {resolvedCount.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 tabular-nums">
                    ۲۴ساعت: {last24hStats.recentClosed.toLocaleString('fa-IR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Summary Grid (2x2 on Mobile, 4 columns on Desktop) */}
        <div data-testid="admin-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-[#606b65] dark:text-[#90a397] text-[11px] sm:text-xs font-bold mb-1.5">
              <span>کل گزارش‌های دریافتی</span>
              <FileText className="w-4 h-4 text-[#244b3b] dark:text-[#a0dbbf] shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#18372b] dark:text-[#e7eee9] tabular-nums">
              {reportsList.length.toLocaleString('fa-IR')}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#606b65] dark:text-[#90a397] mt-1 block">
              ثبت‌شده در پایگاه داده
            </span>
          </div>

          <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-[#606b65] dark:text-[#90a397] text-[11px] sm:text-xs font-bold mb-1.5">
              <span>گزارش‌های جدید</span>
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {newCount.toLocaleString('fa-IR')}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#606b65] dark:text-[#90a397] mt-1 block">
              منتظر بررسی اولیه
            </span>
          </div>

          <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-[#606b65] dark:text-[#90a397] text-[11px] sm:text-xs font-bold mb-1.5">
              <span>در حال بررسی</span>
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
              {inProgressCount.toLocaleString('fa-IR')}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#606b65] dark:text-[#90a397] mt-1 block">
              ارجاع‌شده به رده‌ها
            </span>
          </div>

          <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-[#606b65] dark:text-[#90a397] text-[11px] sm:text-xs font-bold mb-1.5">
              <span>مختومه و اقدام‌شده</span>
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {resolvedCount.toLocaleString('fa-IR')}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#606b65] dark:text-[#90a397] mt-1 block">
              تعیین تکلیف نهایی
            </span>
          </div>
        </div>

        {/* Segmented Navigation Tabs + CSV Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTab('monitoring')}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                tab === 'monitoring'
                  ? 'bg-[#244b3b] dark:bg-[#2c624c] text-white'
                  : 'text-[#606b65] dark:text-[#90a397] hover:text-[#18372b] dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>کارتابل گزارش‌ها ({reportsList.length.toLocaleString('fa-IR')})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('performance')}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                tab === 'performance'
                  ? 'bg-[#244b3b] dark:bg-[#2c624c] text-white'
                  : 'text-[#606b65] dark:text-[#90a397] hover:text-[#18372b] dark:hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>عملکرد گزارشگران ({reporterPerformance.length.toLocaleString('fa-IR')})</span>
            </button>
          </div>

          {tab === 'monitoring' && (
            <button
              type="button"
              onClick={exportCsv}
              className="min-h-[38px] px-3.5 py-2 bg-white dark:bg-[#15221b] border border-[#dbe5df] dark:border-[#22372c] text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a2b22] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>خروجی اکسل / CSV</span>
            </button>
          )}
        </div>

        {/* TAB 1: MONITORING & REPORTS LIST */}
        {tab === 'monitoring' && (
          <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-5 space-y-4">
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
              <div className="relative sm:col-span-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجو در شناسه رهگیری، موضوع، متن یا نام گزارشگر..."
                  aria-label="جستجو در گزارش‌ها"
                  className="w-full min-h-[42px] bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#18372b] dark:text-[#e7eee9] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="grid grid-cols-2 sm:col-span-6 gap-2.5 sm:gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="فیلتر وضعیت"
                  className="w-full min-h-[42px] bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-xs text-[#18372b] dark:text-[#e7eee9]"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="جدید">وضعیت: جدید</option>
                  <option value="در حال بررسی">وضعیت: در حال بررسی</option>
                  <option value="در حال پیگیری">وضعیت: در حال پیگیری</option>
                  <option value="اقدام‌شده">وضعیت: اقدام‌شده</option>
                  <option value="مختومه">وضعیت: مختومه</option>
                </select>

                <select
                  value={provinceFilter}
                  onChange={(e) => setProvinceFilter(e.target.value)}
                  aria-label="فیلتر استان"
                  className="w-full min-h-[42px] bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#d9e3dd] dark:border-[#284235] rounded-xl px-3 py-2 text-xs text-[#18372b] dark:text-[#e7eee9]"
                >
                  <option value="all">همه استان‌ها</option>
                  {provinces.map((prov) => (
                    <option key={prov} value={prov}>
                      استان {prov}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-[#d9e3dd] dark:border-[#22372c] rounded-2xl">
                <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2.5" />
                <p className="text-xs sm:text-sm font-bold text-[#31493e] dark:text-[#c5d6cc]">
                  گزارشی مطابق با فیلترهای انتخابی یافت نشد
                </p>
                <p className="text-[11px] text-[#606b65] dark:text-[#90a397] mt-1">
                  به محض ثبت گزارش توسط کاربران، اطلاعات به‌صورت خودکار در این کارتابل قرار می‌گیرد.
                </p>
              </div>
            ) : (
              <>
                {/* DESKTOP VIEW: Structured High-Density Data Grid */}
                <div className="hidden md:block overflow-x-auto border border-[#e5ece8] dark:border-[#22372c] rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#f8fbf9] dark:bg-[#111c16] text-[#31493e] dark:text-[#a0dbbf] border-b border-[#e5ece8] dark:border-[#22372c] font-bold">
                      <tr>
                        <th className="p-3.5 whitespace-nowrap">شناسه رهگیری</th>
                        <th className="p-3.5">موضوع و خلاصه شرح</th>
                        <th className="p-3.5 whitespace-nowrap">گزارش‌دهنده و رده</th>
                        <th className="p-3.5 whitespace-nowrap">تاریخ ثبت</th>
                        <th className="p-3.5 whitespace-nowrap">مستندات</th>
                        <th className="p-3.5 whitespace-nowrap">وضعیت اقدام</th>
                        <th className="p-3.5 text-center whitespace-nowrap">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef3f0] dark:divide-[#22372c]">
                      {filteredReports.map((rep) => (
                        <tr
                          key={rep.id}
                          className="hover:bg-[#f8fbf9] dark:hover:bg-[#1a2f24]/30 transition"
                        >
                          <td
                            className="p-3.5 font-mono tabular-nums font-bold text-[#244b3b] dark:text-[#a0dbbf] whitespace-nowrap"
                            dir="ltr"
                          >
                            {rep.id}
                          </td>
                          <td className="p-3.5 max-w-xs">
                            <span className="font-bold text-[#18372b] dark:text-[#e7eee9] block truncate">
                              {rep.title || 'گزارش خبری انتظامی'}
                            </span>
                            <span className="text-[11px] text-[#606b65] dark:text-[#90a397] truncate block mt-0.5">
                              {rep.text}
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-semibold block">
                              {rep.reporter?.name || 'گزارشگر مردمی'}
                            </span>
                            <span className="text-[11px] text-[#606b65] dark:text-[#90a397] block mt-0.5">
                              {rep.reporter?.rank || 'شهروند'} · {rep.reporter?.province || 'تهران'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono tabular-nums text-[11px] whitespace-nowrap">
                            {new Date(rep.created || Date.now()).toLocaleDateString('fa-IR')}
                          </td>
                          <td className="p-3.5 text-[11px] text-[#606b65] dark:text-[#90a397] whitespace-nowrap">
                            {rep.files?.length
                              ? `${rep.files.length.toLocaleString('fa-IR')} فایل پیوست`
                              : 'بدون پیوست'}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <select
                              value={rep.status || 'جدید'}
                              onChange={(e) => handleStatusChange(rep.id, e.target.value)}
                              aria-label={`وضعیت گزارش ${rep.id}`}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#d9e3dd] dark:border-[#284235] bg-white dark:bg-[#111c16] font-semibold focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
                            >
                              <option value="جدید">جدید</option>
                              <option value="در حال بررسی">در حال بررسی</option>
                              <option value="در حال پیگیری">در حال پیگیری</option>
                              <option value="اقدام‌شده">اقدام‌شده</option>
                              <option value="مختومه">مختومه</option>
                            </select>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedReportForPdf(rep)}
                                className="px-2.5 py-1.5 bg-[#244b3b] hover:bg-[#18372b] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                                title="مشاهده نسخه رسمی PDF"
                              >
                                <Printer className="w-3.5 h-3.5 shrink-0" />
                                <span>نسخه PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedReportDetails(rep)}
                                className="px-2.5 py-1.5 border border-[#d9e3dd] dark:border-[#284235] bg-white dark:bg-[#111c16] hover:bg-gray-50 dark:hover:bg-[#1a2b22] text-[#31493e] dark:text-[#c5d6cc] rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                                title="مشاهده جزئیات"
                              >
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                                <span>جزئیات</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE VIEW: Clean, Ergonomic Report Cards (Zero Horizontal Scroll) */}
                <div className="md:hidden space-y-3" data-testid="admin-mobile-cards">
                  {filteredReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3.5 rounded-2xl bg-[#fcfdfa] dark:bg-[#111c16] border border-[#dfe8e2] dark:border-[#22372c] space-y-2.5"
                    >
                      {/* Top Row: ID + Date + Status Select */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#eef3f0] dark:border-[#1e3127]">
                        <div className="min-w-0">
                          <span
                            className="font-mono tabular-nums text-xs font-extrabold text-[#244b3b] dark:text-[#a0dbbf] block truncate"
                            dir="ltr"
                          >
                            {rep.id}
                          </span>
                          <span className="text-[11px] text-[#606b65] dark:text-[#90a397] block mt-0.5">
                            {new Date(rep.created || Date.now()).toLocaleDateString('fa-IR')}
                            {' · '}
                            {rep.reporter?.province || 'تهران'}
                          </span>
                        </div>

                        <select
                          value={rep.status || 'جدید'}
                          onChange={(e) => handleStatusChange(rep.id, e.target.value)}
                          aria-label={`وضعیت گزارش ${rep.id}`}
                          className="min-h-[38px] text-xs px-2.5 py-1.5 rounded-xl border border-[#d9e3dd] dark:border-[#284235] bg-white dark:bg-[#15221b] font-bold text-[#18372b] dark:text-[#e7eee9] shrink-0"
                        >
                          <option value="جدید">جدید</option>
                          <option value="در حال بررسی">در حال بررسی</option>
                          <option value="در حال پیگیری">در حال پیگیری</option>
                          <option value="اقدام‌شده">اقدام‌شده</option>
                          <option value="مختومه">مختومه</option>
                        </select>
                      </div>

                      {/* Middle: Title & Narrative Summary */}
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-[#18372b] dark:text-[#e7eee9]">
                          {rep.title || 'گزارش خبری انتظامی'}
                        </h3>
                        <p className="text-xs text-[#606b65] dark:text-[#90a397] line-clamp-2 leading-relaxed mt-1">
                          {rep.text}
                        </p>
                      </div>

                      {/* Reporter Metadata Line (Unboxed clean metadata with separators) */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#606b65] dark:text-[#90a397]">
                        <span className="font-semibold text-[#31493e] dark:text-[#c5d6cc]">
                          {rep.reporter?.name || 'گزارشگر مردمی'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{rep.reporter?.rank || 'شهروند'}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {rep.files?.length
                            ? `${rep.files.length.toLocaleString('fa-IR')} پیوست`
                            : 'بدون پیوست'}
                        </span>
                      </div>

                      {/* Bottom Touch-Friendly Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedReportDetails(rep)}
                          className="min-h-[42px] px-3 py-2 rounded-xl border border-[#d9e3dd] dark:border-[#284235] bg-white dark:bg-[#15221b] text-[#31493e] dark:text-[#c5d6cc] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 shrink-0" />
                          <span>جزئیات کامل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedReportForPdf(rep)}
                          className="min-h-[42px] px-3 py-2 rounded-xl bg-[#244b3b] hover:bg-[#18372b] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                        >
                          <Printer className="w-4 h-4 shrink-0" />
                          <span>چاپ / PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: PERFORMANCE EVALUATION */}
        {tab === 'performance' && (
          <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-3.5 sm:p-5 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9]">
                ارزیابی عملکرد افراد و رده‌های گزارشگر
              </h2>
              <p className="text-xs text-[#606b65] dark:text-[#90a397] mt-0.5">
                سنجش کیفی و کمی بر اساس دقت تکمیل پارامترهای ۷گانه، پیوست مدارک و وضعیت اقدام
              </p>
            </div>

            {reporterPerformance.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-[#d9e3dd] dark:border-[#22372c] rounded-2xl">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-[#606b65] dark:text-[#90a397]">
                  هنوز داده‌ای برای ارزیابی عملکرد ثبت نشده است.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Performance Table */}
                <div className="hidden md:block overflow-x-auto border border-[#e5ece8] dark:border-[#22372c] rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#f8fbf9] dark:bg-[#111c16] text-[#31493e] dark:text-[#a0dbbf] border-b border-[#e5ece8] dark:border-[#22372c] font-bold">
                      <tr>
                        <th className="p-3.5">نام گزارشگر</th>
                        <th className="p-3.5">عنوان رده / یگان</th>
                        <th className="p-3.5">استان</th>
                        <th className="p-3.5 text-center">تعداد گزارش‌ها</th>
                        <th className="p-3.5 text-center">گزارش‌های مستنددار</th>
                        <th className="p-3.5 text-center">شاخص غنای اطلاعات</th>
                        <th className="p-3.5 text-center">سطح عملکرد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef3f0] dark:divide-[#22372c]">
                      {reporterPerformance.map((item, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-[#f8fbf9] dark:hover:bg-[#1a2f24]/30 transition"
                        >
                          <td className="p-3.5 font-bold">{item.name}</td>
                          <td className="p-3.5 text-[#606b65] dark:text-[#90a397]">{item.rank}</td>
                          <td className="p-3.5">{item.province}</td>
                          <td className="p-3.5 text-center font-mono tabular-nums font-bold">
                            {item.reportsCount.toLocaleString('fa-IR')}
                          </td>
                          <td className="p-3.5 text-center font-mono tabular-nums">
                            {item.hasFilesCount.toLocaleString('fa-IR')}
                          </td>
                          <td className="p-3.5 text-center font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {item.avgQuality.toLocaleString('fa-IR')}٪
                          </td>
                          <td className="p-3.5 text-center font-bold text-[#244b3b] dark:text-[#a0dbbf]">
                            {item.rankBadge}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Performance Cards */}
                <div className="md:hidden space-y-2.5">
                  {reporterPerformance.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[#fcfdfa] dark:bg-[#111c16] border border-[#dfe8e2] dark:border-[#22372c] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#18372b] dark:text-[#e7eee9]">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-[#606b65] dark:text-[#90a397]">
                            {item.rank} · {item.province}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {item.avgQuality.toLocaleString('fa-IR')}٪ ({item.rankBadge})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#606b65] dark:text-[#90a397] pt-1 border-t border-[#eef3f0] dark:border-[#1e3127]">
                        <span>تعداد گزارش: {item.reportsCount.toLocaleString('fa-IR')}</span>
                        <span aria-hidden="true">·</span>
                        <span>مستنددار: {item.hasFilesCount.toLocaleString('fa-IR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Official PDF Report Viewer Modal */}
      {selectedReportForPdf && (
        <OfficialPdfReport
          report={selectedReportForPdf}
          onClose={() => setSelectedReportForPdf(null)}
          isModal={true}
        />
      )}

      {/* Report Full Details Modal */}
      {selectedReportDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-arrive">
          <div className="bg-white dark:bg-[#15221b] rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border border-[#d9e3dd] dark:border-[#22372c] text-right">
            <div className="flex items-center justify-between p-4 border-b border-[#e5ece8] dark:border-[#22372c]">
              <div>
                <h3 className="text-sm font-bold text-[#18372b] dark:text-[#e7eee9]">
                  {selectedReportDetails.title || 'جزئیات کامل گزارش'}
                </h3>
                <span className="text-[11px] font-mono tabular-nums text-[#606b65] dark:text-[#90a397]">
                  {selectedReportDetails.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportDetails(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs text-[#31493e] dark:text-[#c5d6cc] leading-relaxed">
              <div className="p-3 bg-[#f8fbf9] dark:bg-[#0e1612] border border-[#e5ece8] dark:border-[#22372c] rounded-xl space-y-1">
                <div>
                  <strong className="text-[#18372b] dark:text-[#e7eee9]">گزارش‌دهنده: </strong>
                  <span>
                    {selectedReportDetails.reporter?.name || '—'} (
                    {selectedReportDetails.reporter?.rank || '—'} /{' '}
                    {selectedReportDetails.reporter?.post || '—'})
                  </span>
                </div>
                <div>
                  <strong className="text-[#18372b] dark:text-[#e7eee9]">استان: </strong>
                  <span>{selectedReportDetails.reporter?.province || 'تهران'}</span>
                  {' · '}
                  <strong className="text-[#18372b] dark:text-[#e7eee9]">تلفن همراه: </strong>
                  <span className="font-mono tabular-nums">
                    {selectedReportDetails.reporter?.mobile || '—'}
                  </span>
                </div>
              </div>

              <div>
                <strong className="text-[#18372b] dark:text-[#e7eee9] block mb-1">
                  متن و شرح گزارش:
                </strong>
                <p className="p-3 bg-[#fcfdfa] dark:bg-[#0e1612] border border-[#e5ece8] dark:border-[#22372c] rounded-xl whitespace-pre-wrap">
                  {selectedReportDetails.text}
                </p>
              </div>

              {selectedReportDetails.answers &&
                Object.keys(selectedReportDetails.answers).length > 0 && (
                  <div>
                    <strong className="text-[#18372b] dark:text-[#e7eee9] block mb-1">
                      پارامترهای تکمیلی ثبت‌شده:
                    </strong>
                    <div className="p-3 bg-[#f8fbf9] dark:bg-[#0e1612] border border-[#e5ece8] dark:border-[#22372c] rounded-xl space-y-1">
                      {Object.entries(selectedReportDetails.answers).map(([k, v]: [string, any]) => {
                        const valStr =
                          v && typeof v === 'object'
                            ? v.value ||
                              Object.values(v.fields || {})
                                .filter(Boolean)
                                .join(' — ')
                            : String(v || '');
                        if (!valStr) return null;
                        return (
                          <div key={k}>
                            <span className="font-bold text-[#244b3b] dark:text-[#a0dbbf]">
                              {k}:{' '}
                            </span>
                            <span>{valStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            <div className="p-3.5 border-t border-[#e5ece8] dark:border-[#22372c] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const rep = selectedReportDetails;
                  setSelectedReportDetails(null);
                  setSelectedReportForPdf(rep);
                }}
                className="min-h-[40px] px-4 py-2 bg-[#244b3b] hover:bg-[#18372b] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>نسخه رسمی PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReportDetails(null)}
                className="min-h-[40px] px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#111c16] dark:hover:bg-[#1c2e24] rounded-xl text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APK Download Modal for Both Standalone Systems */}
      {showApkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-arrive">
          <div className="bg-white dark:bg-[#15221b] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#d9e3dd] dark:border-[#22372c] text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5ece8] dark:border-[#22372c]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#244b3b] dark:text-[#a0dbbf]" />
                <h3 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9]">
                  دریافت فایل نصبی اندروید (APK)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowApkModal(false)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 flex items-center justify-center cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#606b65] dark:text-[#90a397] leading-relaxed">
              هر دو سامانه به‌صورت مجزا و مستقل برای سیستم‌عامل اندروید بسته‌بندی و امضا شده‌اند:
            </p>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#f8fbf9] dark:bg-[#111c16] border border-[#d9e3dd] dark:border-[#22372c] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#18372b] dark:text-[#e7eee9]">
                    ۱. اپلیکیشن سامانه ثبت گزارش راوی
                  </div>
                  <div className="text-[11px] text-[#606b65] dark:text-[#90a397] mt-0.5 font-mono">
                    ravi-citizen.apk · ir.faraja.ravi.citizen
                  </div>
                </div>
                <a
                  href="/download/ravi-citizen.apk"
                  download="ravi-citizen.apk"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#244b3b] hover:bg-[#18372b] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>دانلود APK</span>
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f8fbf9] dark:bg-[#111c16] border border-[#d9e3dd] dark:border-[#22372c] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#18372b] dark:text-[#e7eee9]">
                    ۲. اپلیکیشن پنل مدیریت و پایش فراجا
                  </div>
                  <div className="text-[11px] text-[#606b65] dark:text-[#90a397] mt-0.5 font-mono">
                    ravi-admin.apk · ir.faraja.ravi.admin
                  </div>
                </div>
                <a
                  href="/download/ravi-admin.apk"
                  download="ravi-admin.apk"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#18372b] hover:bg-[#244b3b] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>دانلود APK</span>
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#e5ece8] dark:border-[#22372c]">
              <button
                type="button"
                onClick={() => setShowApkModal(false)}
                className="min-h-[40px] px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#111c16] rounded-xl text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
