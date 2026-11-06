import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield,
  FileText,
  Mic,
  MicOff,
  Edit3,
  Upload,
  Camera,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  Search,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Settings as SettingsIcon,
  BookOpen,
  Info,
  Lock,
  Plus,
  Play,
  Square,
  AlertTriangle,
  RotateCcw,
  Sun,
  Moon,
  Printer,
  Eye,
} from 'lucide-react';

import { questionsFor, EVENTS, stripQuestionPrefix, validateLLMEntitiesAndBuildAnswers } from './lib/domain.js';
import { localAnalysis } from './lib/scenarios.js';
import { newsDomain } from './lib/guidance.js';
import { createDictation, appendSpeech, speechSupported } from './lib/speech.js';
import { TriageBanner } from './components/TriageBanner.tsx';
import { AnalysisReview } from './components/AnalysisReview.tsx';
import { QuestionFlow } from './components/QuestionFlow.tsx';
import { GuideInterview } from './components/GuideInterview.tsx';
import { SmartConversationView } from './components/SmartConversationView.tsx';
import { ReporterIdentityModal } from './components/ReporterIdentityModal.tsx';
import { OfficialPdfReport } from './components/OfficialPdfReport.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import {
  TopicSelectorModal,
  QuestionBankModal,
  HelpModal,
  AboutModal,
  SettingsModal,
  PrivacyModal,
} from './components/Modals.tsx';

// Sample scenarios
const SAMPLES = {
  theft: 'دیروز وقتی به محل پارک خودرو در تجریش برگشتم، متوجه شدم شیشهٔ خودرو شکسته و کیف داخل آن به سرقت رفته است.',
  fraud: 'از یک فروشگاه اینترنتی خرید کردم و هزینه را پرداخت کردم، اما کالا ارسال نشده و فروشنده پاسخ نمی‌دهد.',
  service: 'چراغ‌های روشنایی بخشی از پیاده‌رو در محلهٔ ما چند شب است خاموش هستند و دید کافی وجود ندارد.',
};

export default function App() {
  const checkIsAdmin = () => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hostname === 'admin.frgserver.ir' ||
      window.location.pathname === '/admin' ||
      window.location.pathname.startsWith('/admin') ||
      window.location.hash === '#/admin' ||
      window.location.hash === '#admin'
    );
  };

  const [view, setView] = useState<'welcome' | 'home' | 'smart-chat' | 'reports' | 'success' | 'admin'>(() => {
    if (checkIsAdmin()) return 'admin';
    return 'welcome';
  });

  useEffect(() => {
    const handleRoute = () => {
      const isAdminRoute = checkIsAdmin();
      if (isAdminRoute) {
        setView('admin');
      } else if (view === 'admin') {
        setView('welcome');
      }
      const manifestEl = document.querySelector('link[rel="manifest"]');
      if (manifestEl) {
        manifestEl.setAttribute(
          'href',
          isAdminRoute ? '/manifest-admin.json' : '/manifest-citizen.json'
        );
      }
      document.title = isAdminRoute
        ? 'سامانه مستقل مدیریت و پایش گزارش‌ها | فراجا'
        : 'راوی — سامانه هوشمند ثبت گزارش‌های مردمی';
    };
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    handleRoute();
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, [view]);

  const [step, setStep] = useState<number>(0);
  const [pdfReportModal, setPdfReportModal] = useState<any | null>(null);

  // Core report state
  const [text, setText] = useState<string>('');
  const [voiceTab, setVoiceTab] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [needsReview, setNeedsReview] = useState<boolean>(false);
  const [isInterviewing, setIsInterviewing] = useState<boolean>(false);
  const [interviewHighlight, setInterviewHighlight] = useState<boolean>(false);
  const [interviewTurns, setInterviewTurns] = useState<Array<{ q: string; a: string }>>([]);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Array<{ name: string; size: number; type: string; url?: string }>>([]);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Reporter Identity with localStorage persistence
  const [reporter, setReporter] = useState(() => {
    try {
      const saved = localStorage.getItem('faraja_reporter_identity');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: '',
      province: 'تهران',
      mobile: '',
      rank: '',
      post: '',
    };
  });
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(false);

  // Dark mode theme preference
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('ravi_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ravi_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, [theme]);

  // Saved reports & draft
  const [reports, setReports] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ravi_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [savedId, setSavedId] = useState<string>('');
  const [draftExists, setDraftExists] = useState<boolean>(false);

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Voice recording & transcription (Dual-Engine: Live Persian SpeechRecognition + MediaRecorder + Gemini Transcribe)
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [partialSpeech, setPartialSpeech] = useState<string>('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const dictationRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Loading & status
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReportModal, setSelectedReportModal] = useState<any | null>(null);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.id?.toLowerCase().includes(q) ||
        (r.text || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.reporter?.name || '').toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

  // Show Toast
  const toast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Check draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem('ravi_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.text?.trim() || parsed.files?.length) {
          setDraftExists(true);
        }
      }
    } catch {}
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (view === 'home') {
      try {
        if (text.trim() || files.length) {
          localStorage.setItem(
            'ravi_draft',
            JSON.stringify({
              text,
              step,
              answers,
              extra,
              files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
              reporter,
              updated: Date.now(),
            })
          );
          setDraftExists(true);
        }
      } catch {}
    }
  }, [text, step, answers, extra, files, reporter, view]);

  // Helper to transcribe a recorded audio blob on the server
  const transcribeAudioBlob = async (blob: Blob) => {
    if (!blob || blob.size < 200) return;
    setTranscribing(true);
    toast('در حال تبدیل گفتار فارسی به متن…');
    try {
      const formData = new FormData();
      const ext = blob.type?.includes('mp4') ? 'm4a' : 'webm';
      const fileName = (blob as File).name || `voice_report.${ext}`;
      formData.append('file', blob, fileName);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.text) {
        setText((prev) => appendSpeech(prev, data.text));
        toast('صوت با موفقیت به متن تبدیل شد.');
      } else if (data.error) {
        toast(data.error);
      } else {
        toast('متن مشخصی از صوت شناسایی نشد.');
      }
    } catch {
      toast('تبدیل صوت انجام نشد؛ لطفاً متن را دستی وارد کنید.');
    } finally {
      setTranscribing(false);
    }
  };

  // Start MediaRecorder for audio capture (used directly on desktop or as fallback on mobile)
  const startMediaRecorderOnly = async (autoTranscribeOnStop: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm')
          ? 'audio/webm'
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/mp4')
          ? 'audio/mp4'
          : '';
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        setRecordedAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        if (autoTranscribeOnStop && audioBlob.size > 200) {
          transcribeAudioBlob(audioBlob);
        }
      };

      mr.start(500);
      setIsRecording(true);
      setRecordingTime(0);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 180) {
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setIsRecording(false);
      toast('دسترسی به میکروفون داده نشد یا میکروفون در دسترس نیست؛ می‌توانید فایل صوتی بارگذاری کنید.');
    }
  };

  // Voice recording handlers (Prevents SpeechRecognition + getUserMedia hardware conflict on mobile phones)
  const startRecording = async () => {
    setPartialSpeech('');
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    if (isMobile) {
      // On mobile OSes (Android/iOS), calling getUserMedia while SpeechRecognition is active kills SpeechRecognition.
      // Dedicate the microphone to live SpeechRecognition first; if unsupported or blocked, switch to MediaRecorder + auto-transcribe.
      if (speechSupported()) {
        try {
          let recognizedAny = false;
          const dict = createDictation({
            lang: 'fa-IR',
            onPartial: (interim: string) => {
              recognizedAny = true;
              setPartialSpeech(interim);
            },
            onFinal: (finalSentence: string) => {
              recognizedAny = true;
              setPartialSpeech('');
              setText((prev) => appendSpeech(prev, finalSentence));
            },
            onError: (msg: string, code?: string) => {
              dictationRef.current = null;
              if (code === 'not-allowed') {
                setIsRecording(false);
                clearInterval(timerRef.current);
                toast(msg);
              } else if (!recognizedAny) {
                // Switch seamlessly to MediaRecorder + server transcription
                startMediaRecorderOnly(true);
              }
            },
          });
          dictationRef.current = dict;
          dict.start();
          setIsRecording(true);
          setRecordingTime(0);
          clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setRecordingTime((prev) => {
              if (prev >= 180) {
                stopRecording();
                return 180;
              }
              return prev + 1;
            });
          }, 1000);
          return;
        } catch {
          await startMediaRecorderOnly(true);
          return;
        }
      } else {
        await startMediaRecorderOnly(true);
        return;
      }
    }

    // Desktop browsers: can run SpeechRecognition + MediaRecorder together
    if (speechSupported()) {
      try {
        const dict = createDictation({
          lang: 'fa-IR',
          onPartial: (interim: string) => setPartialSpeech(interim),
          onFinal: (finalSentence: string) => {
            setPartialSpeech('');
            setText((prev) => appendSpeech(prev, finalSentence));
          },
          onError: () => {},
        });
        dictationRef.current = dict;
        dict.start();
      } catch {}
    }

    await startMediaRecorderOnly(false);
  };

  const stopRecording = () => {
    if (dictationRef.current) {
      try {
        dictationRef.current.stop();
      } catch {}
      dictationRef.current = null;
    }
    if (partialSpeech.trim()) {
      const leftover = partialSpeech.trim();
      setPartialSpeech('');
      setText((prev) => appendSpeech(prev, leftover));
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast('حجم فایل صوتی نباید بیشتر از ۲۵ مگابایت باشد.');
      return;
    }
    const url = URL.createObjectURL(file);
    setRecordedAudioUrl(url);
    setRecordedAudioBlob(file);
    // Also attach to report files list so it's preserved in evidence
    setFiles((prev) => {
      if (prev.some((f) => f.name === file.name && f.size === file.size)) return prev;
      return [...prev, { name: file.name, size: file.size, type: file.type || 'audio/webm', url }];
    });
    toast('فایل صوتی بارگذاری شد؛ می‌توانید آن را به متن تبدیل کنید.');
  };

  const transcribeRecording = async () => {
    if (!recordedAudioBlob) return;
    setTranscribing(true);
    toast('در حال تبدیل گفتار فارسی به متن…');

    try {
      const formData = new FormData();
      const fileName = (recordedAudioBlob as File).name || 'voice_report.webm';
      formData.append('file', recordedAudioBlob, fileName);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.text) {
        setText((prev) => appendSpeech(prev, data.text));
        toast('صوت با موفقیت به متن تبدیل شد.');
      } else if (data.error) {
        toast(data.error);
      } else {
        toast('متن مشخصی از صوت شناسایی نشد.');
      }
    } catch {
      toast('تبدیل صوت انجام نشد؛ لطفاً متن را دستی وارد کنید.');
    } finally {
      setTranscribing(false);
    }
  };

  // Perform Analysis (with Gemini + local fallback)
  const handleAnalyze = async () => {
    if (!text.trim() || text.length < 3) {
      toast('لطفاً شرح رویداد را بنویسید.');
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, region: reporter.province }),
      });
      const data = await res.json();
      const validated = validateLLMEntitiesAndBuildAnswers(data, text);
      setAnalysis(validated);
      if (validated.answers && typeof validated.answers === 'object') {
        setAnswers((prev) => ({ ...validated.answers, ...prev }));
      }
      if (validated.extra && typeof validated.extra === 'object') {
        setExtra((prev) => ({ ...validated.extra, ...prev }));
      }
      setNeedsReview(true);
      setStep(1);
    } catch (err) {
      // Fallback to offline rule-based local analysis
      const local = validateLLMEntitiesAndBuildAnswers(localAnalysis(text), text);
      setAnalysis(local);
      if (local.answers && typeof local.answers === 'object') {
        setAnswers((prev) => ({ ...local.answers, ...prev }));
      }
      if (local.extra && typeof local.extra === 'object') {
        setExtra((prev) => ({ ...local.extra, ...prev }));
      }
      setNeedsReview(true);
      setStep(1);
    } finally {
      setAnalyzing(false);
    }
  };

  // File attachments
  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: Array<{ name: string; size: number; type: string; url?: string }> = [];
    let currentTotalSize = files.reduce((acc, f) => acc + f.size, 0);

    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      if (files.length + newFiles.length >= 10) {
        toast('حداکثر ۱۰ فایل می‌توانید پیوست کنید.');
        break;
      }
      if (currentTotalSize + f.size > 100 * 1024 * 1024) {
        toast('مجموع حجم فایل‌ها از ۱۰۰ مگابایت بیشتر است.');
        break;
      }
      currentTotalSize += f.size;
      const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
      newFiles.push({ name: f.name, size: f.size, type: f.type, url });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Restore draft
  const handleResumeDraft = () => {
    try {
      const draft = localStorage.getItem('ravi_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setText(parsed.text || '');
        setStep(parsed.step || 0);
        setAnswers(parsed.answers || {});
        setExtra(parsed.extra || {});
        setFiles(parsed.files || []);
        if (parsed.reporter) setReporter(parsed.reporter);
        setView('home');
        toast('پیش‌نویس شما بازیابی شد.');
      }
    } catch {
      toast('بازیابی پیش‌نویس با خطا مواجه شد.');
    }
  };

  // Reset & Start new report
  const handleStartNewReport = () => {
    localStorage.removeItem('ravi_draft');
    setText('');
    setAnalysis(null);
    setAnswers({});
    setExtra({});
    setFiles([]);
    setStep(0);
    setConfirmed(false);
    setNeedsReview(false);
    setIsInterviewing(false);
    setInterviewTurns([]);
    setDraftExists(false);
    setView('home');
  };

  // Start AI-initiated Smart Conversation
  const handleStartSmartConversation = () => {
    // Unlock Web Audio API & SpeechSynthesis directly inside user click gesture
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const w = window as any;
        if (!w.__raviSharedAudioCtx || w.__raviSharedAudioCtx.state === 'closed') {
          w.__raviSharedAudioCtx = new AudioCtx();
        }
        if (w.__raviSharedAudioCtx.state === 'suspended') {
          w.__raviSharedAudioCtx.resume().catch(() => {});
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    } catch {}

    localStorage.removeItem('ravi_draft');
    setText('');
    setAnalysis(null);
    setAnswers({});
    setExtra({});
    setFiles([]);
    setStep(0);
    setConfirmed(false);
    setNeedsReview(false);
    setIsInterviewing(false);
    setInterviewTurns([]);
    setDraftExists(false);
    setView('smart-chat');
  };

  // Submit report and persist to Cloud SQL
  const handleFinalSubmit = async (identityData: typeof reporter) => {
    setReporter(identityData);
    setShowIdentityModal(false);
    try {
      localStorage.setItem('faraja_reporter_identity', JSON.stringify(identityData));
    } catch {}

    // Generate unique Tracking ID matching Faraja official format (RPT-FA4008ABC12984838A9D)
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newId = `RPT-FA${Math.floor(1000 + Math.random() * 9000)}${randomHex}`;

    const newRecord = {
      id: newId,
      created: Date.now(),
      title: analysis?.title || 'گزارش انتظامی / شهروندی',
      text,
      newsDomain: analysis?.newsDomain || newsDomain(text),
      qualityGrade: analysis?.qualityGrade || 'خوب',
      quantityNote: analysis?.quantityNote || 'کامل',
      analysis,
      answers,
      extra,
      files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      reporter: identityData,
      interview: { turns: interviewTurns },
      status: 'جدید',
    };

    const updated = [newRecord, ...reports];
    setReports(updated);
    try {
      localStorage.setItem('ravi_reports', JSON.stringify(updated));
      localStorage.removeItem('ravi_draft');
      setDraftExists(false);
    } catch {}

    // Persist report in Cloud SQL so it immediately appears in the Admin Panel
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });
    } catch {}

    setSavedId(newId);
    setView('success');
  };

  // Sync reports with Cloud SQL on mount and when entering admin/reports view
  useEffect(() => {
    let cancelled = false;
    const syncReportsWithCloudSql = async () => {
      try {
        const res = await fetch('/api/reports');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const dbReports: any[] = Array.isArray(data.reports) ? data.reports : [];
        const dbMap = new Map<string, any>();
        for (const r of dbReports) {
          if (r?.id) dbMap.set(r.id, r);
        }

        // Push any local reports not yet in Cloud SQL
        let localList: any[] = [];
        try {
          const raw = localStorage.getItem('ravi_reports');
          if (raw) localList = JSON.parse(raw);
        } catch {}

        for (const loc of localList) {
          if (loc?.id && !dbMap.has(loc.id)) {
            dbMap.set(loc.id, loc);
            fetch('/api/reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(loc),
            }).catch(() => {});
          }
        }

        if (!cancelled && dbMap.size > 0) {
          const merged = Array.from(dbMap.values()).sort(
            (a, b) => (Number(b.created) || 0) - (Number(a.created) || 0)
          );
          setReports(merged);
          try {
            localStorage.setItem('ravi_reports', JSON.stringify(merged));
          } catch {}
        }
      } catch {}
    };

    syncReportsWithCloudSql();
    return () => {
      cancelled = true;
    };
  }, [view]);

  // Download official police report text
  const downloadReportText = (rep: any) => {
    const lines = [
      'سازمان رزم سوم فراجا — سامانه ثبت گزارش راوی',
      '==================================================',
      `شناسه رهگیری گزارش: ${rep.id}`,
      `تاریخ و ساعت ثبت: ${new Date(rep.created).toLocaleString('fa-IR')}`,
      `حوزه خبری پیشنهادی: ${Array.isArray(rep.newsDomain) ? rep.newsDomain.join('، ') : rep.newsDomain || '—'}`,
      `درجه کیفی گزارش: ${rep.qualityGrade || 'خوب'} | کمیت: ${rep.quantityNote || 'کامل'}`,
      '--------------------------------------------------',
      'مشخصات گزارش‌دهنده:',
      `نام و نام خانوادگی: ${rep.reporter?.name || '—'}`,
      `استان: ${rep.reporter?.province || '—'}`,
      `شماره همراه: ${rep.reporter?.mobile || '—'}`,
      `عنوان رده: ${rep.reporter?.rank || '—'}`,
      `عنوان سمت: ${rep.reporter?.post || '—'}`,
      '--------------------------------------------------',
      'شرح موقعیت (بخش اصلی):',
      rep.text,
      '',
      'پاسخ‌های ثبت‌شده:',
      ...Object.entries(rep.answers || {})
        .map(([k, v]: [string, any]) => {
          const valStr =
            v && typeof v === 'object'
              ? v.value ||
                Object.values(v.fields || {})
                  .map((x) => String(x || '').trim())
                  .filter(Boolean)
                  .join(' — ')
              : String(v || '');
          const labelStr = v && typeof v === 'object' && v.label ? v.label : k;
          return valStr ? `${labelStr}: ${valStr}` : '';
        })
        .filter(Boolean),
      '',
      ...(rep.interview?.turns?.length
        ? [
            'پرسش و پاسخ دستیار هوشمند:',
            ...rep.interview.turns.map((t: any) => `• ${t.q}\n  پاسخ: ${t.a}`),
            '',
          ]
        : []),
      'پیوست‌ها و مستندات:',
      rep.files?.length
        ? rep.files.map((f: any) => `• ${f.name} (${Math.ceil(f.size / 1024)} کیلوبایت)`).join('\n')
        : 'بدون مستندات پیوست',
      '==================================================',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rep.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic question list
  const currentQuestions = analysis ? questionsFor(analysis) : [];

  if (view === 'admin') {
    return (
      <AdminPanel
        reports={reports}
        onUpdateReportStatus={(id, st) => {
          setReports((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: st } : r))
          );
        }}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f6f8f7] dark:bg-[#0d1611] text-[#17221d] dark:text-[#e7eee9] flex flex-col font-vazir selection:bg-[#244b3b] selection:text-white relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 bg-[#18372b] text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 animate-arrive">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Stationary Top Page Header */}
      <header className="w-full max-w-3xl mx-auto px-3 sm:px-4 pt-2.5 pb-1 flex items-center justify-between gap-2">
        <div>
          {view !== 'welcome' && (
            <button
              type="button"
              onClick={() => setView('welcome')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[#15221b] border border-[#dbe5df] dark:border-[#22372c] text-[#31493e] dark:text-[#c5d6cc] rounded-xl text-xs font-bold shadow-2xs hover:bg-[#edf5f0] dark:hover:bg-[#1a2c22] transition whitespace-nowrap"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span>صفحه نخست</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {view === 'reports' && (
            <button
              type="button"
              onClick={() => setView('home')}
              className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap bg-[#244b3b] text-white border-[#244b3b]"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>ثبت گزارش</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-[#1a2b22] border border-[#dbe5df] dark:border-[#284235] text-[#244b3b] dark:text-[#a0dbbf] shadow-2xs flex items-center justify-center focus:outline-none cursor-pointer select-none shrink-0"
            title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
            aria-label="تغییر حالت شب و روز"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-[#244b3b]" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 py-2 sm:py-4 flex flex-col min-h-0 ${
          view === 'welcome' ? 'justify-center' : 'justify-start'
        }`}
      >
        {/* VIEW 1: WELCOME SCREEN (Original Layout + Smart Conversation Button) */}
        {view === 'welcome' && (
          <div className="w-full max-w-md mx-auto py-4 sm:py-8 flex flex-col items-center text-center animate-arrive">
            {/* Brand Logo & Organization */}
            <img
              src="/assets/faraja.webp"
              alt="لوگوی فراجا"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain mb-2 drop-shadow-sm"
            />
            <span className="text-xs sm:text-sm font-bold text-[#6b756f] dark:text-[#90a397] tracking-wide mb-2">
              سازمان رزم سوم فراجا
            </span>

            {/* Quranic Verse */}
            <p
              lang="ar"
              className="text-base sm:text-lg font-bold text-[#244b3b] dark:text-[#6ee7b7] tracking-wide mb-3.5"
            >
              كُونُوا قَوَّامِينَ لِلَّهِ شُهَدَاءَ بِالْقِسْطِ
            </p>

            {/* Quote Banner */}
            <div className="w-full bg-gradient-to-r from-white via-[#f4f9f6] to-white border border-[#dbe5df] dark:border-[#22372c] rounded-xl px-4 py-2.5 mb-5 shadow-2xs">
              <p className="text-xs sm:text-sm font-semibold text-[#2d5846] dark:text-[#c4ded0]">
                امنیت پایدار، بدون مشارکت و همراهی مردم امکان‌پذیر نیست.
              </p>
            </div>

            {/* Welcome Card */}
            <div className="w-full p-6 sm:p-7 border border-[#e4ebe7] dark:border-[#22372c] rounded-2xl bg-white dark:bg-[#15221b] shadow-sm mb-6 flex flex-col items-center">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#18372b] dark:text-[#e7eee9] mb-2.5">
                سامانهٔ ثبت گزارش
              </h1>
              <p className="text-xs sm:text-sm text-[#606b65] dark:text-[#90a397] leading-7 max-w-sm">
                هر گزارش مسئولانهٔ شما، گامی مؤثر در پاسداری از امنیت است.
                <br />
                از همراهی و مسئولیت‌پذیری شما سپاسگزاریم.
              </p>
              <div className="mt-4 pt-3 border-t border-[#eef3f0] dark:border-[#22372c] w-full text-[11px] sm:text-xs font-bold text-[#8a948e] dark:text-[#789284]">
                فرماندهی انتظامی جمهوری اسلامی ایران
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid gap-3">
              <button
                type="button"
                onClick={handleStartNewReport}
                className="w-full min-h-[48px] px-5 py-3.5 rounded-xl bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] dark:hover:bg-[#23503e] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>ثبت گزارش جدید</span>
              </button>

              <button
                type="button"
                data-testid="start-smart-chat-btn"
                onClick={handleStartSmartConversation}
                className="w-full min-h-[48px] px-5 py-3.5 rounded-xl bg-[#18372b] hover:bg-[#244b3b] dark:bg-[#1f4736] dark:hover:bg-[#2c624c] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>گفتگوی هوشمند</span>
              </button>

              {draftExists && (
                <button
                  type="button"
                  onClick={handleResumeDraft}
                  className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-[#edf5f0] hover:bg-[#dfece4] dark:bg-[#1a2f24] dark:hover:bg-[#203a2c] border border-[#cfe0d6] dark:border-[#284635] text-[#244b3b] dark:text-[#a0dbbf] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>ادامهٔ گزارش قبلی</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setView('reports')}
                className="w-full min-h-[46px] px-5 py-3 rounded-xl bg-white hover:bg-gray-50 dark:bg-[#15221b] dark:hover:bg-[#1a2c22] border border-[#dbe5df] dark:border-[#22372c] text-[#31493e] dark:text-[#c5d6cc] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>گزارش‌های من</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 1.5: SMART CONVERSATION */}
        {view === 'smart-chat' && (
          <SmartConversationView
            initialText={text}
            onCompleteReport={({ narrative, analysis: finalAnalysis, answers: finalAnswers, extra: finalExtra, turns }) => {
              setText(narrative);
              setAnalysis(finalAnalysis);
              setAnswers(finalAnswers);
              setExtra(finalExtra);
              setInterviewTurns(turns);
              setNeedsReview(true);
              setStep(1);
              setView('home');
              toast('گزارش شما تدوین شد.');
            }}
            onBack={() => setView('welcome')}
          />
        )}

        {/* VIEW 2: REPORT CREATION FLOW */}
        {view === 'home' && (
          <div className="w-full animate-arrive">
            {/* Linear Horizontal Stepper Header (Mobile & Desktop) */}
            <div
              data-testid="linear-roadmap"
              className="flex items-center justify-between sm:justify-center gap-1 sm:gap-2 mb-2.5 text-xs select-none max-w-lg mx-auto"
            >
              {[
                { idx: 0, title: 'شرح ماجرا' },
                { idx: 1, title: 'سؤالات' },
                { idx: 2, title: 'مستندات' },
                { idx: 3, title: 'ثبت نهایی' },
              ].map(({ idx, title }, i) => (
                <React.Fragment key={idx}>
                  {i > 0 && (
                    <div
                      className={`h-0.5 flex-1 min-w-[8px] max-w-[28px] rounded-full transition-colors ${
                        step >= idx
                          ? 'bg-[#244b3b] dark:bg-[#2c624c]'
                          : 'bg-[#dce3d4] dark:bg-[#22372c]'
                      }`}
                    />
                  )}
                  <div
                    className={`flex items-center justify-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl font-bold transition text-[11px] sm:text-xs text-center whitespace-nowrap shrink-0 ${
                      step === idx
                        ? 'bg-[#244b3b] dark:bg-[#2c624c] text-white shadow-2xs'
                        : step > idx
                        ? 'bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf]'
                        : 'bg-white dark:bg-[#15221b] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-[#22372c]'
                    }`}
                  >
                    <span>{title}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {needsReview && analysis ? (
              /* Review Gate: Reviewing AI Extracted Facts & Topics */
              <AnalysisReview
                analysis={analysis}
                text={text}
                onEditTopics={() => setActiveModal('topics')}
                onConfirm={() => setNeedsReview(false)}
                onBack={() => {
                  setNeedsReview(false);
                  setStep(0);
                }}
              />
            ) : step === 0 ? (
              /* STEP 0: Narrative Composer */
              <div className="space-y-3">
                {/* Emergency Triage Banner */}
                <TriageBanner text={text} />

                {isInterviewing ? (
                  <GuideInterview
                    initialText={text}
                    onTurnUpdate={(draftNarrative) => {
                      setText(draftNarrative);
                    }}
                    onFinish={(narrative, turns) => {
                      setText(narrative);
                      setInterviewTurns(turns);
                      setIsInterviewing(false);
                      setInterviewHighlight(true);
                      setTimeout(() => setInterviewHighlight(false), 2200);
                      toast('شرح گزارش آماده شد.');
                    }}
                    onCancel={() => setIsInterviewing(false)}
                  />
                ) : (
                  /* Composer Card */
                  <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl shadow-xs overflow-hidden text-right">
                    {/* Compact Toolbar */}
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#e5ece8] dark:border-[#22372c] bg-[#f8fbf9] dark:bg-[#121d17]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setVoiceTab(false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                            !voiceTab
                              ? 'bg-white dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] shadow-2xs border border-gray-200 dark:border-[#284635]'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0" />
                          <span>متن</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setVoiceTab(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                            voiceTab
                              ? 'bg-white dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] shadow-2xs border border-gray-200 dark:border-[#284635]'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5 shrink-0" />
                          <span>صدا</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsInterviewing(true)}
                        className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-[#244b3b] dark:text-[#a0dbbf] bg-[#edf5f0] dark:bg-[#1a2f24] hover:bg-[#dfece4] dark:hover:bg-[#223d2f] transition whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>راهنمای گام‌به‌گام</span>
                      </button>
                    </div>

                    {/* Voice recording & audio upload panel */}
                    {voiceTab && (
                      <div className="p-4 bg-[#fcfdfa] dark:bg-[#121d17] border-b border-[#e5ece8] dark:border-[#22372c] flex flex-col items-center justify-center text-center animate-arrive">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm transition-all ${
                              isRecording
                                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100 dark:ring-red-950'
                                : 'bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] hover:bg-[#dfece4]'
                            }`}
                            title={isRecording ? 'توقف ضبط' : 'شروع ضبط صدا'}
                          >
                            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-6 h-6" />}
                          </button>

                          <label className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#15221b] border border-[#d9e3dd] dark:border-[#22372c] hover:bg-gray-50 dark:hover:bg-[#1a2c22] text-xs font-bold text-[#244b3b] dark:text-[#a0dbbf] cursor-pointer flex items-center gap-1.5 transition whitespace-nowrap">
                            <Upload className="w-4 h-4 shrink-0" />
                            <span>بارگذاری فایل صوتی</span>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={handleAudioFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <p className="text-xs font-semibold text-[#18372b] dark:text-[#e7eee9] mt-2.5">
                          {isRecording
                            ? `در حال ضبط… ${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, '0')}`
                            : 'برای تبدیل گفتار به متن، روی میکروفون بزنید'}
                        </p>

                        {partialSpeech && (
                          <div className="mt-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 font-medium max-w-md">
                            {partialSpeech}
                          </div>
                        )}

                        {recordedAudioUrl && (
                          <div className="w-full max-w-sm mt-3 p-2.5 bg-white dark:bg-[#15221b] border border-[#d9e3dd] dark:border-[#22372c] rounded-xl flex flex-col items-center gap-2">
                            <audio src={recordedAudioUrl} controls className="w-full h-8" />
                            <button
                              type="button"
                              disabled={transcribing}
                              onClick={transcribeRecording}
                              className="w-full py-2 bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span>{transcribing ? 'در حال تبدیل…' : 'تبدیل فایل صوتی به متن'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Textarea */}
                    <div className="p-3.5 sm:p-5">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="شرح ماجرا را به زبان ساده بنویسید…"
                        rows={4}
                        maxLength={6000}
                        className={`w-full text-sm sm:text-base text-[#18372b] dark:text-[#e7eee9] leading-relaxed resize-y focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[100px] sm:min-h-[125px] p-1 bg-transparent ${
                          interviewHighlight ? 'ring-2 ring-[#244b3b]/20 rounded-xl p-2' : ''
                        }`}
                      />

                      <div className="flex items-center justify-end pt-2.5 border-t border-gray-100 dark:border-[#22372c] mt-1.5">
                        <button
                          type="button"
                          disabled={text.trim().length < 3 || analyzing || isRecording}
                          onClick={handleAnalyze}
                          className="w-full sm:w-auto px-6 py-2.5 bg-[#244b3b] hover:bg-[#18372b] dark:bg-[#2c624c] dark:hover:bg-[#23503e] disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
                        >
                          <span>{analyzing ? 'در حال بررسی…' : 'ثبت و ادامه'}</span>
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : step === 1 ? (
              /* STEP 1: Progressive Questionnaire */
              <QuestionFlow
                questions={currentQuestions}
                answers={answers}
                extra={extra}
                analysis={analysis}
                onUpdateAnswer={(qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }))}
                onUpdateExtra={(sec, val) => setExtra((prev) => ({ ...prev, [sec]: val }))}
                onComplete={() => setStep(2)}
                onBackToNarrative={() => setStep(0)}
              />
            ) : step === 2 ? (
              /* STEP 2: Evidence & Documents Upload */
              <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-4 sm:p-5 shadow-xs my-1 text-right animate-arrive">
                <div className="mb-3">
                  <h2 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9] mb-0.5">افزودن مستندات</h2>
                  <p className="text-xs text-[#6b756f] dark:text-[#90a397]">
                    تصویر، فیلم، فایل صوتی یا سند مرتبط را بارگذاری کنید.
                  </p>
                </div>

                {/* Dropzone */}
                <label className="border-2 border-dashed border-[#bacaa7] dark:border-[#2c4c3b] hover:border-[#244b3b] bg-[#f8fbf3] dark:bg-[#111c16] hover:bg-[#f0f6e8] rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center cursor-pointer transition text-center mb-3">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,application/pdf"
                    onChange={handleAddFiles}
                    className="hidden"
                  />
                  <div className="w-9 h-9 rounded-xl bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <strong className="text-xs sm:text-sm font-bold text-[#18372b] dark:text-[#e7eee9]">
                    انتخاب فایل یا رها کردن در این قسمت
                  </strong>
                  <span className="text-[11px] text-[#6b756f] dark:text-[#90a397] mt-0.5">
                    تصویر، ویدئو، صوت یا PDF
                  </span>
                </label>

                {/* Files list */}
                {files.length > 0 && (
                  <div className="space-y-1.5 mb-3 max-h-[24vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {files.map((file, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-[#fcfdfa] dark:bg-[#111c16] border border-[#d9e3dd] dark:border-[#22372c] rounded-xl flex items-center justify-between gap-2"
                        >
                          {file.url ? (
                            <img src={file.url} alt={file.name} className="w-8 h-8 object-cover rounded-lg" />
                          ) : (
                            <div className="w-8 h-8 bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-xs font-bold text-[#18372b] dark:text-[#e7eee9] truncate" dir="auto">
                              {file.name}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                            title="حذف فایل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-[#e5ece8] dark:border-[#22372c] gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3.5 py-2 border border-[#dbe5df] dark:border-[#22372c] bg-white dark:bg-[#15221b] text-[#31493e] dark:text-[#c5d6cc] rounded-xl text-xs font-semibold hover:bg-gray-50 flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>مرحله قبل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 bg-[#244b3b] text-white rounded-xl text-xs font-bold hover:bg-[#18372b] flex items-center gap-1.5 shadow-xs"
                  >
                    <span>{files.length ? 'تأیید و ادامه' : 'ادامه بدون پیوست'}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 3: Final Review & Confirmation */
              <div className="bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-4 sm:p-5 shadow-xs my-1 text-right animate-arrive space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-[#18372b] dark:text-[#e7eee9]">بررسی و ثبت نهایی</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setPdfReportModal({
                        id: 'پیش‌نویس نهایی',
                        created: Date.now(),
                        title: analysis?.title || 'گزارش انتظامی',
                        text,
                        reporter,
                        analysis,
                        answers,
                        files,
                      })
                    }
                    className="px-2.5 py-1.5 bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] rounded-lg text-xs font-bold hover:bg-[#dfece4] flex items-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>پیش‌نمایش PDF</span>
                  </button>
                </div>

                {/* Narrative Summary */}
                <div className="p-2.5 bg-[#f8fbf9] dark:bg-[#111c16] border border-[#dfe9e3] dark:border-[#22372c] rounded-xl max-h-[16vh] overflow-y-auto">
                  <span className="text-xs font-bold text-[#244b3b] dark:text-[#a0dbbf] block mb-0.5">شرح ماجرا:</span>
                  <p className="text-xs text-[#18372b] dark:text-[#e7eee9] leading-relaxed whitespace-pre-wrap">{text}</p>
                </div>

                {/* Unified Extracted & Answered Facts */}
                {(() => {
                  const unifiedFacts: Array<{ label: string; value: string }> = [];

                  const sVal = answers.source || analysis?.known?.source;
                  if (sVal) unifiedFacts.push({ label: 'نحوه اطلاع', value: String(sVal) });

                  if (analysis?.known?.actor) {
                    unifiedFacts.push({ label: 'فاعل یا متهم', value: String(analysis.known.actor) });
                  }
                  if (analysis?.known?.peopleCount) {
                    const countStr = String(analysis.known.peopleCount).includes('نفر')
                      ? String(analysis.known.peopleCount)
                      : `${analysis.known.peopleCount} نفر`;
                    unifiedFacts.push({ label: 'تعداد افراد', value: countStr });
                  }
                  if (answers.person && answers.person !== 'خیر') {
                    unifiedFacts.push({ label: 'افراد مرتبط', value: String(answers.person) });
                  }

                  const tVal = answers.time || analysis?.known?.time;
                  if (tVal) unifiedFacts.push({ label: 'زمان وقوع', value: String(tVal) });

                  const pVal = answers.place || analysis?.known?.place;
                  if (pVal) unifiedFacts.push({ label: 'مکان وقوع', value: String(pVal) });

                  const rVal = answers.reason || analysis?.known?.reason;
                  if (rVal) unifiedFacts.push({ label: 'علت رخداد', value: String(rVal) });

                  if (answers.method) {
                    unifiedFacts.push({ label: 'روش یا ابزار', value: String(answers.method) });
                  }
                  if (answers.vehicle && answers.vehicle !== 'خیر') {
                    unifiedFacts.push({ label: 'وسیله نقلیه', value: String(answers.vehicle) });
                  }
                  if (answers.object && answers.object !== 'خیر') {
                    unifiedFacts.push({ label: 'اموال مرتبط', value: String(answers.object) });
                  }
                  if (answers.contact && answers.contact !== 'خیر') {
                    unifiedFacts.push({ label: 'راه ارتباطی', value: String(answers.contact) });
                  }

                  const getPersianLabel = (key: string, valObj?: any): string => {
                    if (valObj && typeof valObj === 'object' && valObj.label) {
                      return String(valObj.label);
                    }
                    const clean = stripQuestionPrefix(key);
                    const dict: Record<string, string> = {
                      details: 'جزئیات رخداد',
                      clarify: 'مشاهدات',
                      appearance: 'مشخصات ظاهری',
                      license_plate: 'شماره پلاک',
                      bank_account: 'اطلاعات بانکی',
                      person_identity: 'مشخصات فرد',
                      contact_info: 'اطلاعات تماس',
                      website_url: 'نشانی اینترنتی',
                      item_or_amount: 'کالا یا مبلغ',
                    };
                    if (dict[clean]) return dict[clean];
                    if (clean.startsWith('details_')) {
                      const ev = clean.slice(8);
                      return EVENTS[ev]?.title ? `جزئیات ${EVENTS[ev].title}` : 'جزئیات';
                    }
                    return clean;
                  };

                  Object.entries(answers).forEach(([k, v]) => {
                    if (
                      !['source', 'person', 'time', 'place', 'reason', 'method', 'vehicle', 'object', 'contact'].includes(k) &&
                      v &&
                      v !== 'خیر' &&
                      v !== 'اطلاعات بیشتری ندارم'
                    ) {
                      const formattedVal =
                        typeof v === 'object'
                          ? String(
                              v.value ||
                                Object.values(v.fields || {})
                                  .map((x) => String(x || '').trim())
                                  .filter(Boolean)
                                  .join(' — ') ||
                                ''
                            ).trim()
                          : String(v).trim();
                      if (formattedVal) {
                        unifiedFacts.push({
                          label: getPersianLabel(k, v),
                          value: formattedVal,
                        });
                      }
                    }
                  });

                  return unifiedFacts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs max-h-[24vh] overflow-y-auto">
                      {unifiedFacts.map((fact, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-gray-50 dark:bg-[#111c16] border border-gray-200 dark:border-[#22372c] rounded-xl"
                        >
                          <span className="font-bold text-[#244b3b] dark:text-[#a0dbbf] ml-1">
                            {fact.label}:
                          </span>
                          <span className="text-gray-900 dark:text-[#e7eee9] leading-relaxed">
                            {fact.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Saved Reporter Info Box */}
                <div className="p-3 bg-gray-50 dark:bg-[#111c16] border border-gray-200 dark:border-[#22372c] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#244b3b] dark:text-[#a0dbbf] ml-1.5">
                      گزارش‌دهنده:
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {reporter.name ? `${reporter.name} — ${reporter.province || 'تهران'}` : 'ثبت نشده'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIdentityModal(true)}
                    className="text-[#244b3b] dark:text-[#a0dbbf] hover:underline text-xs font-bold shrink-0"
                  >
                    ویرایش
                  </button>
                </div>

                {/* Consent checkbox */}
                <label className="flex items-center gap-2.5 p-3 bg-[#edf5f0] dark:bg-[#15271e] border border-[#cfe0d6] dark:border-[#244234] rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="accent-[#244b3b] w-4 h-4 shrink-0"
                  />
                  <span className="text-xs text-[#18372b] dark:text-[#e7eee9] font-medium">
                    اطلاعات ثبت‌شده را بررسی کرده‌ام و صحت آن را تأیید می‌کنم.
                  </span>
                </label>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-[#e5ece8] dark:border-[#22372c] gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2.5 border border-[#dbe5df] dark:border-[#22372c] bg-white dark:bg-[#15221b] text-[#31493e] dark:text-[#c5d6cc] rounded-xl text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>مرحله قبل</span>
                  </button>

                  <button
                    type="button"
                    disabled={!confirmed}
                    onClick={() => {
                      if (reporter.name?.trim() && reporter.mobile?.trim() && reporter.rank?.trim() && reporter.post?.trim()) {
                        handleFinalSubmit(reporter);
                      } else {
                        setShowIdentityModal(true);
                      }
                    }}
                    className="px-6 py-2.5 bg-[#244b3b] hover:bg-[#18372b] disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>ثبت نهایی گزارش</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: SUCCESS SCREEN */}
        {view === 'success' && (
          <div className="w-full max-w-md mx-auto py-8 bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl p-6 shadow-xs text-center animate-arrive">
            <div className="w-14 h-14 rounded-full bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold text-[#18372b] dark:text-[#e7eee9] mb-1">گزارش با موفقیت ثبت شد</h2>
            <p className="text-xs text-[#6b756f] dark:text-[#90a397] mb-5">
              شناسه پیگیری خود را یادداشت فرمایید.
            </p>

            {/* Tracking ID card */}
            <div className="p-3.5 bg-[#f8fbf9] dark:bg-[#111c16] border border-[#dfe9e3] dark:border-[#22372c] rounded-xl inline-flex items-center gap-3 mb-5">
              <div className="text-right">
                <span className="text-[10px] text-gray-500 block">شناسه رهگیری:</span>
                <strong className="text-base font-mono font-bold text-[#244b3b] dark:text-[#a0dbbf] tracking-wider">{savedId}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(savedId);
                  toast('شناسه کپی شد.');
                }}
                className="p-2 text-gray-500 hover:text-[#244b3b] rounded-lg border border-gray-200 dark:border-[#284235] bg-white dark:bg-[#15221b]"
                title="کپی شناسه"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const rep = reports.find((r) => r.id === savedId) || reports[0];
                  if (rep) setPdfReportModal(rep);
                }}
                className="px-4 py-2.5 bg-[#244b3b] hover:bg-[#18372b] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>فایل PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setView('reports')}
                className="px-4 py-2.5 bg-gray-100 dark:bg-[#1f372a] text-[#18372b] dark:text-[#e7eee9] rounded-xl text-xs font-bold hover:bg-gray-200 flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>گزارش‌های من</span>
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-[#22372c]">
              <button
                type="button"
                onClick={handleStartNewReport}
                className="text-xs text-[#244b3b] dark:text-[#a0dbbf] font-bold hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ثبت گزارش جدید</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: MY REPORTS HISTORY */}
        {view === 'reports' && (
          <div className="w-full flex-1 min-h-0 flex flex-col animate-arrive space-y-3 sm:space-y-4 text-right h-[calc(100dvh-4.75rem)] sm:h-auto">
            {/* Header: Title, Count Badge, and New Report Action */}
            <div className="shrink-0 flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#18372b] dark:text-[#e7eee9]">گزارش‌های من</h2>
                {reports.length > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] text-[11px] font-bold">
                    {reports.length} مورد
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleStartNewReport}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#244b3b] text-white rounded-xl text-xs font-bold hover:bg-[#18372b] flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>گزارش جدید</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="shrink-0 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجو بر اساس شناسه، عنوان یا شرح گزارش…"
                className="w-full bg-white dark:bg-[#15221b] border border-[#d9e3dd] dark:border-[#22372c] rounded-xl pl-9 pr-3.5 py-2 sm:py-2.5 text-xs text-[#18372b] dark:text-[#e7eee9] focus:outline-none focus:ring-2 focus:ring-[#244b3b]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reports List - Internally scrollable without outer page scroll */}
            {reports.length === 0 ? (
              <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center p-6 sm:p-10 text-center bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl shadow-2xs">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">هنوز گزارشی ثبت نکرده‌اید</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">با کلیک بر روی دکمه زیر اولین گزارش خود را ثبت نمایید.</p>
                <button
                  type="button"
                  onClick={handleStartNewReport}
                  className="px-5 py-2 bg-[#244b3b] text-white rounded-xl text-xs font-bold hover:bg-[#18372b] transition"
                >
                  ثبت گزارش جدید
                </button>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex-1 min-h-[180px] flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] rounded-2xl">
                <Search className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">گزارشی با این مشخصات یافت نشد</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">عبارت جست‌وجو را تغییر دهید یا دکمه زیر را بزنید.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 bg-gray-100 dark:bg-[#1a2f24] text-xs font-bold text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200"
                >
                  پاک کردن جست‌وجو
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2.5 pr-1 pl-0.5 pb-2">
                {filteredReports.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedReportModal(rep)}
                    className="p-3 sm:p-4 bg-white dark:bg-[#15221b] border border-[#e1e9e4] dark:border-[#22372c] hover:border-[#244b3b] dark:hover:border-[#38765c] rounded-xl sm:rounded-2xl shadow-2xs hover:shadow-sm cursor-pointer transition flex items-center justify-between gap-3 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#edf5f0] dark:bg-[#1a2f24] text-[#244b3b] dark:text-[#a0dbbf] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-[#18372b] dark:text-[#e7eee9] truncate">
                          {rep.title || 'گزارش ثبت‌شده'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-[11px] text-gray-500 dark:text-[#90a397] mt-1">
                          <span>{new Date(rep.created).toLocaleDateString('fa-IR')}</span>
                          <span>·</span>
                          <span>{rep.files?.length || 0} پیوست</span>
                          <span>·</span>
                          <span className="font-mono text-[#244b3b] dark:text-[#a0dbbf] font-bold">{rep.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfReportModal(rep);
                        }}
                        className="p-1.5 sm:p-2 text-gray-500 hover:text-[#244b3b] dark:text-gray-400 dark:hover:text-[#a0dbbf] bg-gray-50 dark:bg-[#111c16] hover:bg-gray-100 dark:hover:bg-[#1a2c22] rounded-lg transition"
                        title="مشاهده نسخه رسمی PDF (قالب فراجا)"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReportText(rep);
                        }}
                        className="p-1.5 sm:p-2 text-gray-500 hover:text-[#244b3b] dark:text-gray-400 dark:hover:text-[#a0dbbf] bg-gray-50 dark:bg-[#111c16] hover:bg-gray-100 dark:hover:bg-[#1a2c22] rounded-lg transition"
                        title="دریافت متن"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <ChevronLeft className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Selected Report Details Modal */}
      {selectedReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-arrive">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#dbe5df] text-right">
            <div className="flex items-center justify-between p-5 border-b border-[#e5ece8]">
              <div>
                <h3 className="text-base font-bold text-[#18372b]">{selectedReportModal.title}</h3>
                <span className="text-xs font-mono text-gray-500">{selectedReportModal.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportModal(null)}
                className="text-gray-400 hover:text-gray-700 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#31493e] leading-relaxed">
              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <div>
                  <strong>گزارش‌دهنده: </strong>
                  {selectedReportModal.reporter?.name || '—'} ({selectedReportModal.reporter?.rank || '—'} /{' '}
                  {selectedReportModal.reporter?.post || '—'})
                </div>
                <div>
                  <strong>استان: </strong>
                  {selectedReportModal.reporter?.province || '—'} | <strong>شماره همراه: </strong>
                  {selectedReportModal.reporter?.mobile || '—'}
                </div>
                <div>
                  <strong>حوزه خبری: </strong>
                  {Array.isArray(selectedReportModal.newsDomain)
                    ? selectedReportModal.newsDomain.join('، ')
                    : selectedReportModal.newsDomain || '—'}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#18372b] mb-1">شرح گزارش:</h4>
                <p className="p-3 bg-[#fcfdfa] border border-gray-200 rounded-xl whitespace-pre-wrap">
                  {selectedReportModal.text}
                </p>
              </div>

              {Object.keys(selectedReportModal.answers || {}).length > 0 && (
                <div>
                  <h4 className="font-bold text-[#18372b] dark:text-[#e7eee9] mb-1">پاسخ‌های ثبت‌شده:</h4>
                  <div className="space-y-1 p-2.5 bg-gray-50 dark:bg-[#0e1612] rounded-xl border border-gray-100 dark:border-[#22372c]">
                    {Object.entries(selectedReportModal.answers).map(([k, v]) => {
                      const cleanK = stripQuestionPrefix(k);
                      const labelMap: Record<string, string> = {
                        source: 'نحوه اطلاع',
                        person: 'فاعل و افراد',
                        time: 'زمان وقوع',
                        place: 'مکان وقوع',
                        reason: 'علت و انگیزه',
                        method: 'روش و سلاح / ابزار',
                        vehicle: 'وسیله نقلیه',
                        object: 'اموال و اشیاء',
                        contact: 'راه‌های ارتباطی',
                      };
                      return (
                        <div key={k} className="leading-relaxed">
                          <span className="font-bold text-[#244b3b] dark:text-[#a0dbbf]">
                            {labelMap[cleanK] || cleanK}:
                          </span>{' '}
                          <span>{String(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-bold text-[#18372b] dark:text-[#e7eee9] mb-1">
                  مستندات ({selectedReportModal.files?.length || 0}):
                </h4>
                {selectedReportModal.files?.length ? (
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
                    {selectedReportModal.files.map((f: any, i: number) => (
                      <li key={i}>
                        {f.name} ({Math.round(f.size / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">بدون مستندات</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-[#e5ece8] dark:border-[#22372c] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPdfReportModal(selectedReportModal)}
                className="px-4 py-2 bg-[#244b3b] hover:bg-[#18372b] text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                نسخه رسمی PDF
              </button>
              <button
                type="button"
                onClick={() => downloadReportText(selectedReportModal)}
                className="px-4 py-2 border border-gray-200 dark:border-[#22372c] bg-white dark:bg-[#15221b] text-[#31493e] dark:text-[#c5d6cc] rounded-xl font-bold flex items-center gap-1.5 text-xs hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5" />
                دریافت متن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official PDF Report Modal */}
      {pdfReportModal && (
        <OfficialPdfReport
          report={pdfReportModal}
          onClose={() => setPdfReportModal(null)}
          isModal={true}
        />
      )}

      {/* Mandatory Reporter Identity Modal before submission */}
      {showIdentityModal && (
        <ReporterIdentityModal
          initialData={reporter}
          onClose={() => setShowIdentityModal(false)}
          onSubmit={handleFinalSubmit}
        />
      )}

      {/* Global Modals */}
      {activeModal === 'topics' && (
        <TopicSelectorModal
          currentEvents={analysis?.events || ['other']}
          onApply={(newEvents) => {
            setAnalysis((prev: any) => ({
              ...prev,
              events: newEvents,
              event: newEvents[0],
            }));
            toast('موضوعات جدید با موفقیت اعمال شدند.');
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'bank' && <QuestionBankModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'help' && <HelpModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings' && <SettingsModal aiConfig={{}} onClose={() => setActiveModal(null)} />}
      {activeModal === 'privacy' && <PrivacyModal onClose={() => setActiveModal(null)} />}

      {/* Footer */}
      {view === 'welcome' && (
        <footer className="mt-auto py-4 border-t border-[#e5ece8] dark:border-[#22372c] bg-white dark:bg-[#121d17] text-center text-xs text-[#6b756f] dark:text-[#90a397]">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <span>تمامی حقوق این سامانه متعلق به سازمان رزم سوم فراجا میباشد.</span>
          </div>
        </footer>
      )}
    </div>
  );
}
