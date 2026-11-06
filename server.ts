import express from 'express';
import http from 'http';
import crypto from 'crypto';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { localAnalysis } from './src/lib/scenarios.js';
import {
  interviewStepsFor,
  extractDynamicEntities,
  validateLLMEntitiesAndBuildAnswers,
  createSmartConversationInitialState,
  evaluateSmartConversationTurn,
} from './src/lib/domain.js';
import {
  synthesizeIranianPersianNeuralTts,
  prepareNaturalIranianSpeechText,
} from './src/lib/persian-tts.ts';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  saveReportToDb,
  listReportsFromDb,
  updateReportStatusInDb,
} from './src/db/reports.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Check if Gemini API key is provided and looks valid
const rawKey = process.env.GEMINI_API_KEY?.trim();
const hasApiKey = Boolean(rawKey && rawKey.length > 5 && rawKey !== 'undefined');

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
if (hasApiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: rawKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch {
    ai = null;
  }
}

// API Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    ai: true,
    provider: hasApiKey ? 'gemini' : 'local',
    interview: true,
    model: hasApiKey ? 'gemini-3.8-flash' : 'local-faraja-engine',
    transcription: hasApiKey,
    sttLocal: false,
    central: false,
    loaded: true,
    error: '',
  });
});

// Serve signed Android APK packages from the project's /download directory
app.get('/download/ravi-citizen.apk', (req, res) => {
  const apkPath = path.resolve('download/ravi-citizen.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="ravi-citizen.apk"');
  res.sendFile(apkPath);
});

app.get('/download/ravi-admin.apk', (req, res) => {
  const apkPath = path.resolve('download/ravi-admin.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="ravi-admin.apk"');
  res.sendFile(apkPath);
});

// API Connectivity Check
app.get('/api/check', async (req, res) => {
  if (!hasApiKey || !ai) {
    return res.json({
      ok: true,
      status: 'local_active',
      message: 'موتور پردازش داخلی فراجا فعال و آماده است.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'سلام',
    });
    res.json({ ok: true, status: 'active', text: response.text });
  } catch (error: any) {
    res.json({
      ok: true,
      status: 'local_fallback',
      message: 'موتور پردازش داخلی فراجا فعال است.',
    });
  }
});

// Incident Report Analysis
app.post('/api/analyze', async (req, res) => {
  const { text, region } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'متن گزارش ارائه نشده است.' });
  }

  // Base local analysis is always calculated and validated
  const baseLocal = validateLLMEntitiesAndBuildAnswers(localAnalysis(text), text);

  if (!hasApiKey || !ai) {
    return res.json(baseLocal);
  }

  try {
    const prompt = `شما یک دستیار تحلیلگر تخصصی برای سامانه ثبت گزارش‌های انتظامی و شهروندی «راوی» (سازمان رزم سوم فراجا) هستید.
وظیفه شما تحلیل دقیق متن فارسی گزارش کاربر، استخراج حقایق مستند، تعیین موضوعات و دسته‌بندی کیفی و حوزه‌ای گزارش است.

متن گزارش ارائه‌شده توسط کاربر:
"""
${text}
"""
${region ? `منطقه / استان: ${region}` : ''}

 دستورالعمل‌ها:
 1. استخراج دقیق موضوعات (events): از قبیل theft (سرقت), assault (نزاع و درگیری), fraud (کلاهبرداری), accident (تصادف و حادثه), damage (تخریب اموال), harassment (تهدید و مزاحمت), cyber_attack (حملات سایبری), data_breach (افشای اطلاعات), service (خدمات شهری), drug_supply (توزیع مواد), drug_use (مصرف مواد), weapon_threat (تهدید با سلاح), official_complaint (شکایت از عملکرد), other (سایر).
 2. برای هر موضوع شناسایی‌شده، باید عینا بخشی از متن گزارش کاربر به عنوان سند (evidence) نقل قول شود (حداقل ۳ حرف، بدون هیچ دستکاری یا جعل).
 3. استخراج اطلاعات اولیه مستند (known):
    - مکان وقوع (place): نام کامل مکان یا محله با تمامی پیشوندها و پسوندها (مثلاً عینا «محله دولت آباد» یا «خیابان سعادت آباد»؛ هرگز نام را نصفه مثلا «محله دولت» ننویسید).
    - زمان وقوع (time): با دقت در بازه شبانه‌روز. اگر کاربر گفته «۱۱ شب»، باید بر مبنای قالب ۲۴ ساعته «ساعت ۲۳» یا «امروز، ساعت ۲۳» نوشته شود. اگر گفته «۱۱ ظهر»، عینا «ساعت ۱۱ (ظهر)» یا «امروز، ساعت ۱۱» نوشته شود.
    - تعداد افراد (peopleCount): مثلا «۵ نفر».
    - فاعل یا شروع‌کننده (actor): نام و نقش فرد در صورت ذکر (مثلا «احمد میثاقی (شروع‌کننده نزاع)»).
    - مشخصات ظاهری افراد (appearance): تمامی ویژگی‌های ظاهری و جسمی افراد شامل قد، مدل و رنگ مو، تتو و خالکوبی، لباس، لنگ زدن پا، نقص عضو یا جراحت (مثلا «پای چپش لنگ می‌زند در اثر تیر خوردن»).
    - علت یا انگیزه (reason): انگیزه وقوع حادثه (مثلا «ناموسی»).
    - عدم اطلاع از سایر افراد (lackOfOtherDetails): آیا کاربر گفته از دیگران مشخصاتی ندارد؟ (boolean).
    - نحوه اطلاع (source): مستقیم، شنیده، فضای مجازی یا نامشخص.
 4. تعیین حوزه خبری پیشنهادی (domain) شامل گزینه‌هایی چون: "انتظامی", "حوادث", "قضایی", "پلیس فتا", "پلیس راهور", "امنیت اجتماعی", "اقتصادی", "خدمات عمومی".
 5. تعیین درجه کیفی گزارش (quality_grade): عالی، خیلی خوب، خوب، متوسط، ضعیف.
 6. تعیین کمیت گزارش (quantity_note): جامع، کامل، متوسط، خلاصه.
 7. استخراج پویا و کامل موجودیت‌های شناسایی‌شده (entities) در قالب لیست JSON استاندارد:
    به جای محدود شدن به یک لیست ثابت، تمامی موجودیت‌های مرتبط با گزارش (به ویژه 'مشخصات ظاهری افراد' appearance، 'شماره پلاک خودرو' license_plate، 'اطلاعات بانکی' bank_account، هویت و القاب افراد person_identity، شماره تماس یا آیدی مجازی contact_info، نشانی سایت یا پیج website_url، کالا یا مبلغ item_or_amount، یا هر موجودیت اختصاصی دیگر در متن) را شناسایی کرده و برای هر کدام یک آبجکت شامل id، type، label، value (مقدار موجود در متن)، stage (شماره مرحله ۱ تا ۷)، fieldLabel (عنوان فیلد ورودی پویا برای مرحله تکمیل اطلاعات) و placeholder برگردانید.
 8. اگر متن مبهم یا کلی است، نیاز به توضیح تکمیلی (needsClarification) را مشخص کنید.

پاسخ را دقیقاً در قالب ساختار JSON مطابق با الگو ارائه دهید.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'عنوان خلاصه و گویای گزارش' },
            events: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'کلید موضوعات گزارش مثلا theft, fraud, assault, ...',
            },
            eventEvidence: {
              type: Type.OBJECT,
              description: 'برای هر موضوع، بخش عینی از متن کاربر',
            },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'دسته‌های اصلی شامل person, place, event, object',
            },
            known: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING, description: 'زمان مستخرج از متن، تبدیل ساعت شب به ۲۴ ساعته' },
                place: { type: Type.STRING, description: 'نام کامل مکان یا محله بدون ناقص کردن' },
                source: { type: Type.STRING, description: 'نحوه اطلاع مستخرج از متن' },
                peopleCount: { type: Type.STRING, description: 'تعداد افراد حاضر، مثلا ۵ نفر' },
                actor: { type: Type.STRING, description: 'نام و نقش فاعل یا شروع‌کننده' },
                appearance: { type: Type.STRING, description: 'مشخصات ظاهری افراد (قد، مدل مو، تتو، لباس، لنگ زدن، نقص عضو یا جراحت)' },
                victim: { type: Type.STRING, description: 'مشخصات آسیب‌دیدگان یا مالباخته' },
                details: { type: Type.STRING, description: 'شرح موضوع، کالا یا خسارت (چه چیزی)' },
                method: { type: Type.STRING, description: 'شیوه و ابزار انجام کار (چگونه)' },
                reason: { type: Type.STRING, description: 'علت یا انگیزه رخداد، مثلا ناموسی' },
                otherInfo: { type: Type.STRING, description: 'سایر تخلفات یا نکات مهم در گزارش' },
                otherPeople: { type: Type.STRING, description: 'وضعیت اطلاعات سایر افراد' },
                lackOfOtherDetails: { type: Type.BOOLEAN, description: 'عدم اطلاع از سایر افراد' },
              },
            },
            entities: {
              type: Type.ARRAY,
              description: 'لیست موجودیت‌های شناسایی‌شده در متن گزارش (مشخصات ظاهری افراد، شماره پلاک خودرو، اطلاعات بانکی، هویت، شماره تماس و غیره) جهت ایجاد فیلد پویا در مرحله تکمیل اطلاعات',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'شناسه یکتا مانند bank_account, appearance, license_plate, person_identity, contact_info, website_url' },
                  type: { type: Type.STRING, description: 'نوع موجودیت' },
                  label: { type: Type.STRING, description: 'عنوان فارسی موجودیت' },
                  value: { type: Type.STRING, description: 'مقدار استخراج‌شده از متن گزارش در صورت وجود' },
                  stage: { type: Type.INTEGER, description: 'شماره مرحله مرتبط از ۱ تا ۷' },
                  needsCompletion: { type: Type.BOOLEAN, description: 'آیا نیازمند تکمیل جزئیات بیشتر در مرحله تکمیل اطلاعات است' },
                  fieldLabel: { type: Type.STRING, description: 'عنوان فیلد ورودی پویا در مرحله تکمیل اطلاعات' },
                  placeholder: { type: Type.STRING, description: 'متن راهنمای داخل فیلد پویا' },
                },
                required: ['id', 'type', 'label'],
              },
            },
            newsDomain: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'حوزه یا حوزه‌های خبری پیشنهادی',
            },
            qualityGrade: { type: Type.STRING, description: 'عالی، خیلی خوب، خوب، متوسط یا ضعیف' },
            quantityNote: { type: Type.STRING, description: 'جامع، کامل، متوسط یا خلاصه' },
            prefills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  field: { type: Type.STRING },
                  value: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                },
                required: ['section', 'field', 'value', 'evidence'],
              },
            },
            needsClarification: { type: Type.BOOLEAN },
            clarificationQuestion: { type: Type.STRING },
          },
          required: ['title', 'events', 'categories', 'newsDomain', 'qualityGrade', 'quantityNote'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    // Merge Gemini AI results with base local analysis to guarantee complete facts
    const rawMerged = Array.from(new Set([...(baseLocal.events || []), ...(parsed.events || [])]));
    const mergedEvents = rawMerged.length > 1 ? rawMerged.filter((e) => e !== 'other') : rawMerged;
    const safeEvidence = { ...baseLocal.eventEvidence, ...(parsed.eventEvidence || {}) };

    const validEvidence: Record<string, string> = {};
    for (const [k, ev] of Object.entries(safeEvidence)) {
      if (typeof ev === 'string' && ev.length >= 2 && text.includes(ev)) {
        validEvidence[k] = ev;
      } else if (baseLocal.eventEvidence?.[k]) {
        validEvidence[k] = baseLocal.eventEvidence[k];
      }
    }

    const vagueRe = /(?:محله|محلم|کوچه|کوچ|خیابان|خیابون|شهرک|روستا|منزل|خونه|خون|ساختمان|ساختمون|محل)(?:\s*ما|\s*مون|مون|\s*مان|مان)(?=$|[\s،.؛!؟])/u;
    const isVague = Boolean(baseLocal.known?.vaguePlace || (parsed.known?.place && vagueRe.test(parsed.known.place)));
    const resolvedPlace = isVague
      ? ''
      : (baseLocal.known?.place && baseLocal.known.place.length >= (parsed.known?.place?.length || 0)
          ? baseLocal.known.place
          : (parsed.known?.place || baseLocal.known?.place || ''));

    const mergedKnown = {
      ...baseLocal.known,
      ...(parsed.known || {}),
      place: resolvedPlace,
      vaguePlace: isVague,
      isOnline: Boolean(baseLocal.known?.isOnline),
      sourceConflict: Boolean(baseLocal.known?.sourceConflict),
      source: baseLocal.known?.sourceConflict
        ? baseLocal.known.source
        : (baseLocal.known?.source || parsed.known?.source || ''),
      time: baseLocal.known?.time || parsed.known?.time || '',
      actor: baseLocal.known?.actor || parsed.known?.actor || '',
      appearance: baseLocal.known?.appearance || parsed.known?.appearance || '',
      peopleCount: baseLocal.known?.peopleCount || parsed.known?.peopleCount || '',
      victim: baseLocal.known?.victim || parsed.known?.victim || '',
      details: baseLocal.known?.details || parsed.known?.details || '',
      method: baseLocal.known?.method || parsed.known?.method || '',
      reason: baseLocal.known?.reason || parsed.known?.reason || '',
      otherInfo: baseLocal.known?.otherInfo || parsed.known?.otherInfo || '',
      otherPeople: baseLocal.known?.otherPeople || parsed.known?.otherPeople || '',
      lackOfOtherDetails: Boolean(baseLocal.known?.lackOfOtherDetails || parsed.known?.lackOfOtherDetails),
    };

    const validatedResult = validateLLMEntitiesAndBuildAnswers(
      {
        ...baseLocal,
        ...parsed,
        events: mergedEvents.length ? mergedEvents : baseLocal.events,
        event: (mergedEvents.length ? mergedEvents : baseLocal.events)[0],
        eventEvidence: validEvidence,
        known: mergedKnown,
        title: baseLocal.event !== 'other' ? baseLocal.title : (parsed.title || baseLocal.title),
        newsDomain: parsed.newsDomain?.length ? parsed.newsDomain : ['انتظامی'],
        qualityGrade: parsed.qualityGrade || 'خوب',
        quantityNote: parsed.quantityNote || 'متوسط',
        prefills: parsed.prefills || baseLocal.prefills || [],
      },
      text
    );

    res.json(validatedResult);
  } catch {
    // Seamless fallback to offline rule-based analysis without exposing errors
    res.json(baseLocal);
  }
});

// Interactive AI Interview Assistant
app.post('/api/interview', async (req, res) => {
  const { text, history } = req.body;
  const historyList = Array.isArray(history) ? history : [];
  const localFactCheck = localAnalysis(text || '');

  // Local fallback logic using the personalized 7-stage questions from src/lib/domain.js
  const fallbackInterview = () => {
    const baseSteps = interviewStepsFor(text || '', []);
    const activeSteps =
      !text?.trim() && historyList.length > 0
        ? interviewStepsFor('', historyList.slice(0, 1))
        : baseSteps;

    const stepIdx = historyList.length;
    if (stepIdx >= activeSteps.length || activeSteps.length === 0) {
      const narrative = historyList
        .filter((h: any) => h.a && !h.a.includes('اطلاعی ندارم') && !h.a.includes('نمی‌دانم'))
        .map((h: any) => h.a)
        .join(' ');
      return {
        done: true,
        narrative: narrative ? `${text ? text + '\n\n' : ''}${narrative}` : (text || 'گزارش ثبت شد.'),
        domain: localFactCheck.known?.isOnline ? 'پلیس فتا (سایبری)' : 'انتظامی',
        quality_grade: 'خوب',
        quantity_note: 'کامل',
      };
    }

    const nextStep = activeSteps[stepIdx];
    return {
      done: false,
      question: nextStep.title,
      hint: nextStep.hint || '',
      options: nextStep.options || [],
    };
  };

  if (!hasApiKey || !ai) {
    return res.json(fallbackInterview());
  }

  try {
    const prompt = `شما دستیار هوشمند، محترمانه و دقیق مصاحبه و تکمیل گزارش در سامانه فراجا هستید.
کاربر می‌خواهد یک رویداد یا گزارش را شرح دهد، اما ممکن است اطلاعات را کامل نگفته باشد.

ترتیب سوالات حتماً و بدون استثنا باید به این شکل باشد:
۱. نحوه اطلاع (آیا خودتان دیدید، شنیدید، در فضای مجازی بود؟)
۲. چه کسی یا فاعل (تعداد افراد، نام یا مشخصات فاعل و شروع‌کننده)
۳. چه زمانی (ساعت و تاریخ دقیق یا بازه شبانه‌روز با دقت ۲۴ ساعته)
۴. چه مکانی (نام کامل محله یا خیابان؛ اگر کاربر نوشته "محله ما" یا "کوچه ما"، حتماً بپرسید: «نام محله و جزئیات آدرس چیست؟»)
۵. چه چیزی (اتفاق، صدمات، خسارات)
۶. چرا (علت، انگیزه یا دلیل)
۷. چگونه (روش، سلاح، ابزار یا وسیله نقلیه)

قانون بسیار مهم و حیاتی:
اگر کاربر در شرح اولیه یا در پاسخ‌های قبلی به موضوعی اشاره کرده، یا صراحتاً گفته «نمی‌دانم»، «اطلاعی ندارم»، «مشخصات خاصی ندارم»، به هیچ عنوان دوباره درباره آن موضوع سوال نپرسید! فقط مواردی را که کاربر هنوز هیچ اطلاعاتی درباره آنها نداده است بپرسید. اگر تمام موارد پاسخ داده شده‌اند، done: true بازگردانید.

شرح اولیه کاربر: "${text || ''}"
تاریخچه سوال و جواب‌های قبلی مصاحبه:
${JSON.stringify(historyList)}

پاسخ را به صورت JSON ارائه دهید.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            done: { type: Type.BOOLEAN, description: 'آیا مصاحبه تمام شده است' },
            question: { type: Type.STRING, description: 'سوال بعدی از کاربر' },
            hint: { type: Type.STRING, description: 'راهنمایی کوتاه برای کاربر' },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '۳ تا ۵ گزینه پیشنهادی آماده',
            },
            narrative: { type: Type.STRING, description: 'شرح منسجم تدوین‌شده نهایی در صورت پایان' },
            domain: { type: Type.STRING, description: 'حوزه خبری' },
            quality_grade: { type: Type.STRING, description: 'درجه کیفی' },
            quantity_note: { type: Type.STRING, description: 'کمیت' },
          },
          required: ['done'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch {
    // If Gemini API fails, smoothly use local interview fallback
    res.json(fallbackInterview());
  }
});

// Contextual Help Assistant
app.post('/api/help', async (req, res) => {
  const { question, answer } = req.body;
  const defaultHelp = 'در صورت اطلاع، جزئیاتی مانند رنگ، مدل، ساعت تقریبی، یا نشانی را بنویسید یا گزینه «نمی‌دانم» را انتخاب کنید.';

  if (!hasApiKey || !ai) {
    return res.json({ text: defaultHelp });
  }

  try {
    const prompt = `شما دستیار ثبت گزارش راوی هستید.
کاربر در حال پاسخ به این سوال است: "${question}"
و ممکن است پاسخی اولیه نوشته باشد: "${answer || ''}"
یک توصیه کوتاه و سازنده به زبان فارسی (حداکثر دو جمله) بنویسید که چه جزئیاتی به تکمیل گزارش کمک می‌کند.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    res.json({ text: response.text?.trim() || defaultHelp });
  } catch {
    res.json({ text: defaultHelp });
  }
});

// Audio Speech-to-Text Transcription via Gemini or Local STT Server
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایل صوتی یافت نشد.' });
  }

  const mimeType = req.file.mimetype || 'audio/webm';
  const base64Data = req.file.buffer.toString('base64');
  const fileName = req.file.originalname || 'recording.webm';

  // Helper to try local STT server (e.g. ravi-model on 127.0.0.1:11434 or STT_URL in /etc/ravi.env)
  const tryLocalStt = async (): Promise<string | null> => {
    const rawBase =
      process.env.STT_URL ||
      process.env.RAVI_STT_URL ||
      process.env.WHISPER_URL ||
      process.env.OPENAI_BASE_URL ||
      process.env.OLLAMA_HOST ||
      'http://127.0.0.1:11434';
    const base = rawBase.replace(/\/+$/, '');
    const endpoints = [
      `${base}/v1/audio/transcriptions`,
      `${base}/api/transcribe`,
      `${base}/inference`,
      ...(base.endsWith('/v1') ? [`${base}/audio/transcriptions`] : []),
    ];

    for (const url of endpoints) {
      try {
        const form = new FormData();
        const blob = new Blob([req.file!.buffer], { type: mimeType });
        form.append('file', blob, fileName);
        form.append('model', process.env.STT_MODEL || 'whisper-1');
        form.append('language', 'fa');
        const r = await fetch(url, { method: 'POST', body: form });
        if (r.ok) {
          const data: any = await r.json().catch(() => null);
          if (typeof data?.text === 'string' && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch {}

      try {
        const rJson = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64Data, mimeType, language: 'fa' }),
        });
        if (rJson.ok) {
          const data: any = await rJson.json().catch(() => null);
          if (typeof data?.text === 'string' && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch {}
    }
    return null;
  };

  if (!hasApiKey || !ai) {
    const localText = await tryLocalStt();
    if (localText) {
      return res.json({ text: localText, model: 'local-stt' });
    }
    return res.status(400).json({
      error: 'سرویس تبدیل فایل صوتی پاسخ نداد؛ لطفاً از دکمه دیکته زنده مرورگر استفاده کنید یا شرح را بنویسید.',
    });
  }

  const transcriptionPrompt = 'این فایل صوتی حاوی شرح گزارش انتظامی یا شهروندی به زبان فارسی است. لطفاً گفتار فارسی را دقیقاً، بدون حذف یا تحریف، با املای استاندارد فارسی به متن تبدیل کنید. اسامی خاص، ساعت‌ها، نام محله‌ها، شماره‌ها و پلاک‌ها را با دقت بنویسید و فقط متن پیاده‌شده را برگردانید.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: transcriptionPrompt,
        },
      ],
    });

    const text = response.text?.trim() || '';
    res.json({ text, model: 'gemini-3.5-transcribe' });
  } catch {
    try {
      const fallbackRes = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: transcriptionPrompt,
          },
        ],
      });
      const text = fallbackRes.text?.trim() || '';
      res.json({ text, model: 'gemini-3.8-flash' });
    } catch {
      const localText = await tryLocalStt();
      if (localText) {
        return res.json({ text: localText, model: 'local-stt' });
      }
      res.status(500).json({ error: 'تبدیل صوت به متن با خطا مواجه شد. لطفاً متن را دستی وارد کنید.' });
    }
  }
});

// AI Speech Synthesis (TTS) for Live Voice Smart Conversation — Native Iranian Persian (fa-IR)
app.post('/api/tts', async (req, res) => {
  const { text, voice } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'متن برای خوانش صوتی ارسال نشده است.' });
  }

  const preferredVoice =
    voice === 'female' || voice === 'fa-IR-DilaraNeural'
      ? 'fa-IR-DilaraNeural'
      : 'fa-IR-FaridNeural';

  // 1. Primary: Native Iranian Persian (Tehrani standard fa-IR) Male Neural TTS (fa-IR-FaridNeural)
  const neuralMp3Base64 =
    (await synthesizeIranianPersianNeuralTts(text, preferredVoice)) ||
    (await synthesizeIranianPersianNeuralTts(
      text,
      preferredVoice === 'fa-IR-FaridNeural' ? 'fa-IR-DilaraNeural' : 'fa-IR-FaridNeural'
    ));

  if (neuralMp3Base64) {
    return res.json({
      audio: neuralMp3Base64,
      mimeType: 'audio/mpeg',
      voice: preferredVoice,
      locale: 'fa-IR',
    });
  }

  // 2. Secondary: Gemini 3.8 TTS with explicit Iranian Persian (fa-IR) Tehrani accent & natural human prosody
  if (hasApiKey && ai) {
    const naturalText = prepareNaturalIranianSpeechText(text);
    for (const modelName of ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: naturalText,
                  speechMetadata: {
                    style:
                      'Native Iranian Persian speaker from Tehran (fa-IR, standard Iranian Farsi accent), warm, human, natural conversational intonation, strictly NOT Afghan Dari (fa-AF) and NOT robotic',
                  },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({
            audio: base64Audio,
            mimeType: 'audio/wav',
            voice: modelName,
            locale: 'fa-IR',
          });
        }
      } catch {
        // Try next model
      }
    }
  }

  return res.json({ fallback: true, locale: 'fa-IR' });
});

// Smart Conversation Turn Controller (strict AI-led interview without chitchat)
app.post('/api/smart-chat', async (req, res) => {
  const { state, answer } = req.body || {};

  // Initialize state if not provided (AI initiates conversation)
  if (!state) {
    return res.json(createSmartConversationInitialState(answer || ''));
  }

  // First run deterministic validation & stage progression
  const deterministicNext = evaluateSmartConversationTurn(state, answer || '');

  // If deterministic validation already rejected off-topic / empty / vague input, return immediately
  if (!deterministicNext.lastValidation?.valid || !hasApiKey || !ai) {
    return res.json(deterministicNext);
  }

  // When Gemini is active, perform an additional semantic check on whether the user's answer is logical & convincing for the asked question
  try {
    const askedQuestion = state.currentQuestion?.title || 'دقیقاً چه اتفاقی افتاده است؟';
    const stageId = state.currentQuestion?.id || 'incident';
    const verifyPrompt = `شما بازرس کنترل کیفی «گفتگوی هوشمند» سامانه ثبت گزارش فراجا هستید.
سوال پرسیده‌شده از کاربر: «${askedQuestion}» (مرحله: ${stageId})
پاسخ کاربر: «${answer}»

قواعد سخت‌گیرانه:
1. آیا پاسخ کاربر منطقی، قانع‌کننده و مرتبط با سوال پرسیده‌شده است؟ (اگر کاربر «اطلاعی ندارم» یا «نمی‌دانم» را در مراحلی به جز اصل اتفاق و نحوه اطلاع گفته، منطقی محسوب می‌شود).
2. اگر کاربر پاسخ بی‌ربط، شوخی، احوال‌پرسی یا جملات بی‌معنی نوشته، isLogical باید false باشد و در rejectionFeedback بنویسید: «لطفاً پاسخ درست و مربوط دهید.» همراه با توضیح کوتاه.
3. از هرگونه تعارف یا طولانی کردن کلام خودداری کنید.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: verifyPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isLogical: { type: Type.BOOLEAN },
            cleanedFact: { type: Type.STRING, description: 'خلاصه خالص اطلاعات مفید بدون حاشیه و تعارف' },
            rejectionFeedback: { type: Type.STRING, description: 'پیام کوتاه اخطار در صورت غیرمنطقی یا نامرتبط بودن پاسخ' },
          },
          required: ['isLogical'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.isLogical === false) {
      const rawFeedback = String(parsed.rejectionFeedback || '').trim();
      const finalFeedback = rawFeedback.includes('پاسخ درست و مربوط')
        ? rawFeedback
        : `لطفاً پاسخ درست و مربوط دهید. ${rawFeedback}`.trim();
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user',
        stageId,
        text: String(answer || '').trim(),
        valid: false,
      };
      const retryAiMsg = {
        id: `ai-retry-${Date.now()}`,
        role: 'ai',
        stageId,
        isWarning: true,
        text: `${finalFeedback}\nسوال فعلی: ${askedQuestion}`,
      };
      return res.json({
        ...state,
        messages: [...(state.messages || []), userMsg, retryAiMsg],
        lastValidation: {
          valid: false,
          reason: 'llm_unconvincing',
          cleanedAnswer: '',
          feedback: finalFeedback,
        },
      });
    }

    return res.json(deterministicNext);
  } catch {
    return res.json(deterministicNext);
  }
});

// Synchronize authenticated Firebase user into Cloud SQL users table
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'کاربر احراز هویت نشده است.' });
    }
    const dbUser = await getOrCreateUser(req.user.uid, req.user.email || '');
    res.json({ user: dbUser });
  } catch (error: any) {
    console.error('Failed to sync user:', error);
    res.status(500).json({ error: error.message || 'خطا در همگام‌سازی حساب کاربری' });
  }
});

// Cloud SQL: Fetch all submitted reports for the Admin Panel & synchronization
app.get('/api/reports', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user) {
      await getOrCreateUser(req.user.uid, req.user.email || '').catch(() => {});
    }
    const allReports = await listReportsFromDb();
    res.json({ reports: allReports });
  } catch (error: any) {
    console.error('Failed to fetch reports from Cloud SQL:', error);
    res.status(500).json({ error: error.message || 'خطا در دریافت فهرست گزارش‌ها', reports: [] });
  }
});

// Cloud SQL: Submit & persist a citizen report so it immediately appears in the Admin Panel
app.post('/api/reports', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    if (!body.id || typeof body.text !== 'string') {
      return res.status(400).json({ error: 'اطلاعات گزارش ناقص است.' });
    }

    let userUid: string | null = null;
    if (req.user) {
      userUid = req.user.uid;
      await getOrCreateUser(req.user.uid, req.user.email || '').catch(() => {});
    }

    const saved = await saveReportToDb({
      ...body,
      userUid,
    });

    res.status(201).json({ report: saved });
  } catch (error: any) {
    console.error('Failed to save report to Cloud SQL:', error);
    res.status(500).json({ error: error.message || 'خطا در ثبت گزارش در پایگاه داده' });
  }
});

// Cloud SQL: Update report status from the Admin Panel
app.patch('/api/reports/:reportId/status', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body || {};
    if (!reportId || !status) {
      return res.status(400).json({ error: 'شناسه گزارش و وضعیت جدید الزامی است.' });
    }

    if (req.user) {
      await getOrCreateUser(req.user.uid, req.user.email || '').catch(() => {});
    }

    const updated = await updateReportStatusInDb(reportId, String(status));
    if (!updated) {
      return res.status(404).json({ error: 'گزارش مورد نظر یافت نشد.' });
    }
    res.json({ report: updated });
  } catch (error: any) {
    console.error('Failed to update report status in Cloud SQL:', error);
    res.status(500).json({ error: error.message || 'خطا در به‌روزرسانی وضعیت گزارش' });
  }
});

// Mount Vite or serve static and attach Gemini 3.8 Live WebSocket server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.use((req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost:3000').pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    if (!hasApiKey || !ai) {
      clientWs.send(
        JSON.stringify({
          fallbackMode: true,
          message: 'حالت گفتگوی صوتی هوشمند محلی فعال شد.',
        })
      );
      return;
    }

    let liveSession: any = null;
    try {
      const liveSystemInstruction = `شما مصاحبه‌گر رسمی «گفتگوی هوشمند» سامانه ثبت گزارش راوی (سازمان رزم سوم فراجا) هستید.
قوانین قطعی شما:
1. لهجه و گویش صوتی شما باید منحصراً فارسی معیار ایران (لهجه طبیعی، صمیمی و انسانی تهرانی - fa-IR) باشد. اکیداً از لهجه دری، افغانستانی یا لحن خشک و رباتی خودداری کنید.
2. شما شروع‌کننده مکالمه هستید و بلافاصله سوال اول را می‌پرسید: «دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟»
3. سوالات را یک‌به‌یک و به ترتیب استاندارد بپرسید:
   - اصل اتفاق (چه شده است)
   - نحوه اطلاع (آیا خودتان دیدید، برای خودتان رخ داد، شنیدید یا در فضای مجازی دیدید)
   - چه کسی (مشخصات فاعل، تعداد افراد و مشخصات ظاهری مانند قد، مو، تتو، لباس یا لنگ زدن پا)
   - چه زمانی (روز و ساعت دقیق)
   - چه مکانی (در گزارش حضوری: نام دقیق محله و خیابان؛ در گزارش اینترنتی: نام سایت، آیدی پیج یا کانال)
   - چه چیزی (جزئیات مال، مبلغ یا خسارت)
   - چرا (علت یا انگیزه)
   - چگونه (شیوه انجام، سلاح، شماره کارت/حساب یا شماره پلاک خودرو)
4. هر سوالی که کاربر در جملات قبلی پاسخ داده است را هرگز دوباره نپرسید.
5. فقط زمانی به سوال بعدی بروید که پاسخ کاربر منطقی، مشخص و قانع‌کننده باشد. اگر پاسخ مبهم (مثلاً «محله ما») یا غیرمرتبط بود، قاطعانه بخواهید دقیقاً به همان سوال پاسخ دهد.
6. از طولانی کردن مکالمه، تعارفات و حرف‌های غیرمرتبط اکیداً خودداری کنید و اجازه ندهید کاربر بحث را به حاشیه ببرد. به محض تکمیل سوالات، پایان گفتگو را اعلام کنید.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: liveSystemInstruction,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== 1) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: () => {
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ fallbackMode: true }));
            }
          },
        },
      });

      liveSession = await sessionPromise;
      // Trigger the AI to initiate the voice conversation immediately
      liveSession.sendRealtimeInput({
        text: 'مکالمه را همین الان به عنوان شروع‌کننده با لهجه فارسی طبیعی ایران (تهرانی) و لحن گرم و غیررباتی آغاز کن و سوال اول را بپرس: دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟',
      });

      clientWs.on('message', (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.audio) {
            sessionPromise.then((s) =>
              s.sendRealtimeInput({
                audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
              })
            );
          } else if (payload.text) {
            sessionPromise.then((s) =>
              s.sendRealtimeInput({
                text: String(payload.text),
              })
            );
          }
        } catch {}
      });

      clientWs.on('close', () => {
        try {
          liveSession?.close?.();
        } catch {}
      });
    } catch {
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            fallbackMode: true,
            message: 'حالت گفتگوی صوتی هوشمند محلی فعال شد.',
          })
        );
      }
    }
  });

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
    // Pre-warm Iranian Persian Male Neural TTS cache for instant response on first greeting
    synthesizeIranianPersianNeuralTts(
      'سلام، من دستیار صوتی راوی هستم. دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟',
      'fa-IR-FaridNeural'
    ).catch(() => {});
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
