import {complaintContext,incidentNegationTail,hasInternalTradeNegation,isNonAlcoholic,endsWithSaleVerb} from './incident-language.js';
import {EXTENDED_EVENTS,EXTRA_RULES} from './extended-bank.js';
import {NUMBERED_TOPICS,NUMBERED_RULES} from './numbered-topics.js';
import {BANK_VERSION,inferCategories,CATEGORIES} from './question-bank.js';
import {foldIndexed,normalize} from './persian-normalize.js';
import {FRAME_GUARD,HEDGE,HYPOTHETICAL,DENIAL,RETRACTION,VEHICLE} from './lexicon.js';
import {CORE_RULES} from './core-rules.js';
import {TERM_RULES} from './topic-terms.js';
// Shared taxonomy and normalization for the browser and API. These are reporting
// topics, not legal findings. Multiple topics may apply to the same narrative.
export const POLICE_SECURITY_EVENTS = {
  // ۱. پلیس آگاهی (Criminal Investigation)
  armed_robbery: {
    title: 'سرقت مسلحانه (بانک، طلافروشی، منزل، خودرو)',
    detail: 'درباره سرقت مسلحانه و نوع سلاح مشاهده‌شده چه اطلاعاتی دارید؟',
    hint: 'نوع سلاح، تعداد سارقین، وسایل به سرقت رفته و نحوه ورود و فرار را توضیح دهید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'vehicle', 'object']
  },
  violent_theft: {
    title: 'سرقت به عنف و خفت‌گیری (زورگیری با سلاح سرد یا قمه)',
    detail: 'چه سرقت به عنف یا زورگیری‌ای رخ داد و چه سلاحی استفاده شد؟',
    hint: 'مشخصات زورگیران، وسیله تهدید (قمه، چاقو، شوکر) و اموال برده‌شده را شرح دهید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'vehicle', 'object']
  },
  pickpocketing: {
    title: 'قاپ‌زنی و جیب‌بری (کیف‌قاپی و موبایل‌قاپی)',
    detail: 'چه وسیله‌ای قاپیده شد و سارق از چه وسیله نقلیه‌ای استفاده کرد؟',
    hint: 'مشخصات موتورسیکلت یا خودروی سارق، پلاک و مسیر فرار را در صورت اطلاع بنویسید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'vehicle', 'object']
  },
  homicide: {
    title: 'قتل عمد و جنایات علیه تمامیت جسمانی',
    detail: 'درباره واقعه قتل یا درگیری مرگبار چه مشاهداتی دارید؟',
    hint: 'زمان، مکان، هویت مقتول یا ضارب و آلات قتاله را بدون حدس و با دقت بنویسید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'vehicle']
  },
  suspicious_death: {
    title: 'کشف جسد و مرگ‌های مشکوک',
    detail: 'در چه مکانی پیکر کشف شده و چه نشانه‌هایی از وضعیت آن وجود دارد؟',
    hint: 'موقعیت دقیق محل کشف و مشاهدات عینی را ثبت کنید؛ از اظهار نظر پزشکی خودداری فرمایید.',
    department: 'پلیس آگاهی',
    modules: ['place']
  },
  abduction: {
    title: 'آدم‌ربایی، گروگان‌گیری و حبس غیرقانونی',
    detail: 'چه کسی و در چه شرایطی ربوده یا به اجبار نگهداری شده است؟',
    hint: 'آخرین محل مشاهده، هویت فرد، وسیله انتقال و درخواست‌های احتمالی را بنویسید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'vehicle']
  },
  missing_person: {
    title: 'مفقودی مشکوک فرد',
    detail: 'فرد از چه تاریخی ناپدید شده و چه مشخصات ظاهری دارد؟',
    hint: 'سن، لباس بر تن، آخرین تماس یا مشاهده و سوابق پزشکی فرد مفقودشده را بیان کنید.',
    department: 'پلیس آگاهی',
    modules: ['person']
  },
  acid_attack: {
    title: 'اسیدپاشی و صدمات عمدی شدید',
    detail: 'حادثه اسیدپاشی در چه شرایطی رخ داد و عامل چه مشخصاتی داشت؟',
    hint: 'محل وقوع، مشخصات ضارب، وسیله نقلیه فرار و اقدامات امدادی اولیه را شرح دهید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'vehicle']
  },
  real_estate_fraud: {
    title: 'کلاهبرداری ملکی و فروش مال غیر',
    detail: 'کدام ملک، زمین یا پروژه پیش‌فروش مورد کلاهبرداری قرار گرفته است؟',
    hint: 'مبلغ پرداختی، هویت افراد متخلف و نحوه فریب و اسناد ارائه‌شده را توضیح دهید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'contact']
  },
  pyramid_scheme: {
    title: 'شرکت‌های هرمی و پروژه‌های پانزی',
    detail: 'چه ادعای سرمایه‌گذاری یا عضوگیری هرمی مطرح شده است؟',
    hint: 'نام شرکت یا پلتفرم، مبالغ دریافت‌شده و شیوه تبلیغات را بنویسید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'contact']
  },
  document_forgery: {
    title: 'جعل اسناد رسمی، هویتی و مدارک دولتی',
    detail: 'کدام سند، شناسنامه، کارت شناسایی یا مدرک دولتی جعل شده است؟',
    hint: 'محل استفاده از مدرک جعلی و هویت افراد دخیل در جعل را قید فرمایید.',
    department: 'پلیس آگاهی',
    modules: ['person', 'contact']
  },
  counterfeit_currency: {
    title: 'جعل اسکناس، چک‌پول، مسکوکات و ارز',
    detail: 'چه پول یا چک‌پول جعلی‌ای رد و بدل یا توزیع شده است؟',
    hint: 'مبلغ، محل دریافت یا مبادله و مشخصات فرد پرداخت‌کننده را بنویسید.',
    department: 'پلیس آگاهی',
    modules: ['person']
  },

  // ۲. پلیس امنیت عمومی و اطلاعات (Public Security & Intelligence)
  street_brawl: {
    title: 'نزاع دسته‌جمعی خیابانی و سلب آسایش عمومی',
    detail: 'تعداد افراد حاضر در درگیری، شروع‌کننده و ابزارهای مورد استفاده چه بودند؟',
    hint: 'محل دقیق نزاع، آسیب‌های وارده و مشخصات افراد سرکرده را ثبت فرمایید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person', 'vehicle']
  },
  knife_brawl: {
    title: 'نزاع فردی و چاقوکشی',
    detail: 'درگیری میان چه افرادی رخ داد و چه آسیب‌های جسمانی ایجاد شد؟',
    hint: 'هویت ضارب و مضروب، انگیزه درگیری و نوع سلاح را توضیح دهید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person']
  },
  thugs_and_hoodlums: {
    title: 'اراذل و اوباش، عربده‌کشی و قمه‌کشی',
    detail: 'چه رفتاری از قبیل قدرت‌نمایی، شکستن شیشه‌ها یا ارعاب اهالی مشاهده شد؟',
    hint: 'لقب یا اسامی افراد، سلاح‌های همراه، پلاک خودروها و محل تجمع آنان را بنویسید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person', 'vehicle']
  },
  extortion_racketeering: {
    title: 'باج‌گیری، اخاذی و حق‌حساب‌گیری محلی (شاخ‌شکنی)',
    detail: 'چه فرد یا گروهی از چه کسی و با چه تهدیدی طلب وجه یا منفعت کرده است؟',
    hint: 'مبلغ مطالبه‌شده، کسبه یا اشخاص قربانی و دفعات مراجعه را بیان کنید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person', 'contact']
  },
  illegal_firearms: {
    title: 'قاچاق، نگهداری و حمل سلاح گرم و مهمات غیرمجاز',
    detail: 'درباره خرید، فروش، نگهداری یا حمل سلاح گرم چه اطلاعاتی دارید؟',
    hint: 'نوع سلاح (کلت، شکاری، جنگی)، مهمات و محل اختفا یا جابه‌جایی را شرح دهید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person', 'vehicle']
  },
  illegal_shooting: {
    title: 'تیراندازی غیرمجاز و ایجاد رعب و وحشت',
    detail: 'شلیک گلوله در کجا و توسط چه فرد یا خودرویی انجام گرفت؟',
    hint: 'تعداد شلیک‌ها، خودروی تیراندازان و صدمات احتمالی را بنویسید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person', 'vehicle']
  },
  explosives_fireworks: {
    title: 'ساخت، نگهداری یا توزیع مواد منفجره و محترقه پرخطر',
    detail: 'چه مواد محترقه یا انفجاری غیرمجاز در کجا نگهداری یا تولید می‌شود؟',
    hint: 'آدرس انبار یا کارگاه، حجم مواد و خطرات احتمالی برای ساکنان را بنویسید.',
    department: 'پلیس امنیت عمومی',
    modules: ['place', 'person']
  },
  sabotage_infrastructure: {
    title: 'تعرض و خرابکاری در تأسیسات حساس، حیاتی و اماکن عمومی',
    detail: 'چه آسیب یا اقدامی علیه خطوط انرژی، تأسیسات دولتی یا خدمات شهری رخ داده است؟',
    hint: 'محل حادثه، نوع آسیب و ابزارهای خرابکاری مشاهده‌شده را ثبت نمایید.',
    department: 'ارگان‌های امنیتی و اطلاعاتی',
    modules: ['place', 'person']
  },
  espionage_security: {
    title: 'فعالیت‌های مشکوک به جاسوسی، جمع‌آوری اطلاعات و اقدام علیه امنیت',
    detail: 'چه اقدام غیرعادی، عکس‌برداری غیرمجاز یا تحرک مشکوکی مشاهده شده است؟',
    hint: 'محل حساس مورد نظر، تجهیزات مورد استفاده و مشخصات افراد را قید کنید.',
    department: 'ارگان‌های امنیتی و اطلاعاتی',
    modules: ['person', 'vehicle']
  },
  riot_disruption: {
    title: 'اغتشاش، تخریب اموال عمومی و تحریک به ناامنی',
    detail: 'چه تجمعات خشونت‌آمیز، مسدودسازی معابر یا تحریکاتی رخ داده است؟',
    hint: 'لیدرها، محرکان، راه‌های هدایت و اموال تخریب‌شده را مشخص نمایید.',
    department: 'پلیس امنیت عمومی',
    modules: ['person', 'place']
  },
  threat_national_security: {
    title: 'اقدامات تروریستی، خرابکارانه و ضد امنیت ملی',
    detail: 'چه تهدید یا اقدام تروریستی مستقیمی مشاهده یا گزارش شده است؟',
    hint: 'جزییات دقیق رویداد یا تهدید معتبر را بدون پیش‌داوری ثبت کنید.',
    department: 'ارگان‌های امنیتی و اطلاعاتی',
    modules: ['person', 'place']
  },
  vice_gambling: {
    title: 'قمارخانه، دایر کردن مراکز فساد و فحشا',
    detail: 'چه مرکزی برای قمار، شرط‌بندی یا اعمال خلاف عفت عمومی دایر شده است؟',
    hint: 'آدرس محل، تردد افراد و شیوه دعوت و فعالیت را شرح دهید.',
    department: 'پلیس امنیت اخلاقی و عمومی',
    modules: ['place', 'person']
  },
  bootlegging_alcohol: {
    title: 'قاچاق، تولید کارگاهی و توزیع عمده مشروبات الکلی',
    detail: 'درباره محل ساخت، انبارداری یا توزیع عمده مشروبات الکلی چه می‌دانید؟',
    hint: 'آدرس کارگاه یا انبار، خودروهای جابه‌جایی و حجم تقریبی را بنویسید.',
    department: 'پلیس امنیت عمومی',
    modules: ['place', 'vehicle']
  },

  // ۳. پلیس مبارزه با مواد مخدر (Anti-Narcotics)
  narcotics_trafficking: {
    title: 'قاچاق کلان و ترانزیت بین‌استانی مواد مخدر',
    detail: 'چه محموله‌ای، با چه خودرویی و در چه مسیری در حال انتقال است؟',
    hint: 'نوع مواد، خودروی حامل، پلاک و مسیر تردد را در صورت اطلاع وارد فرمایید.',
    department: 'پلیس مبارزه با مواد مخدر',
    modules: ['vehicle', 'person']
  },
  narcotics_distribution: {
    title: 'توزیع و خرده‌فروشی مواد مخدر (صنعتی و سنتی)',
    detail: 'چه کسی و در چه محلی اقدام به فروش و پخش مواد مخدر می‌کند؟',
    hint: 'نام ساقی، محل توزیع، نوع مواد (شیشه، گل، هروئین، تریاک) و زمان فروش را بنویسید.',
    department: 'پلیس مبارزه با مواد مخدر',
    modules: ['person', 'place']
  },
  narcotics_lab: {
    title: 'آشپزخانه و لابراتوار تولید مواد مخدر و روان‌گردان',
    detail: 'آدرس یا مشخصات کارگاه و بوی تند مواد شیمیایی در کدام محل مشاهده شده است؟',
    hint: 'محل کارگاه، مواد اولیه و رفت‌وآمدهای مشکوک را گزارش نمایید.',
    department: 'پلیس مبارزه با مواد مخدر',
    modules: ['place', 'person']
  },
  drug_den: {
    title: 'پاتوق مصرف، استعمال علنی و تجمع معتادان متجاهر',
    detail: 'تجمع معتادان در کدام پارک، کوچه یا خرابه مخل آسایش محله شده است؟',
    hint: 'آدرس دقیق محل و تأثیر آن بر ناامنی ساکنان را توضیح دهید.',
    department: 'پلیس مبارزه با مواد مخدر',
    modules: ['place']
  },

  // ۴. پلیس فتا (Cyber Police)
  phishing_banking: {
    title: 'فیشینگ، درگاه‌های جعلی پرداخت و سرقت اطلاعات حساب',
    detail: 'کدام لینک جعلی، پیامک یارانه یا سهام عدالت باعث برداشت غیرمجاز شد؟',
    hint: 'متن پیامک، لینک آلوده، مبلغ برداشتی و شماره حساب مقصد را درج کنید.',
    department: 'پلیس فتا',
    modules: ['contact']
  },
  cyber_hacking: {
    title: 'نفوذ، هک سامانه‌ها، پایگاه‌های داده و باج‌افزار',
    detail: 'کدام سرور، سامانه یا حساب کاربری هک شده و چه پیامی دریافت گردید؟',
    hint: 'آدرس وب‌سایت یا شناسه سامانه، پیام باج‌خواهی و تاریخ نفوذ را بنویسید.',
    department: 'پلیس فتا',
    modules: ['contact']
  },
  online_fraud_scam: {
    title: 'کلاهبرداری اینترنتی و خریدهای آنلاین غیرواقعی',
    detail: 'از کدام سایت، پیج اینستاگرام یا کانال خرید کردید و کالا ارسال نشد؟',
    hint: 'آدرس پیج یا کانال، شماره کارت واریزی، مبلغ و رسید را شرح دهید.',
    department: 'پلیس فتا',
    modules: ['contact']
  },
  cyber_blackmail: {
    title: 'اخاذی و باج‌گیری سایبری در شبکه‌های اجتماعی',
    detail: 'فرد ناشناس با چه تهدیدی اقدام به درخواست پول یا امتیاز کرده است؟',
    hint: 'آیدی یا شماره متخلف، بستر پیام‌رسان و نوع تهدید را بنویسید.',
    department: 'پلیس فتا',
    modules: ['contact', 'person']
  },
  reputation_damage: {
    title: 'هتک حیثیت و انتشار تصاویر و اطلاعات خصوصی در فضای مجازی',
    detail: 'چه تصاویر، صداها یا پیام‌های خصوصی و در کدام صفحه منتشر گردید؟',
    hint: 'نشانی صفحه یا کانال، هویت مظنون در صورت اطلاع و دامنه انتشار را ذکر فرمایید.',
    department: 'پلیس فتا',
    modules: ['contact', 'person']
  },
  false_rumors_cyber: {
    title: 'شایعه‌پراکنی و تشویش اذهان عمومی در بستر سایبری',
    detail: 'چه خبر جعلی یا فراخوان دروغینی در فضای مجازی دست به دست می‌شود؟',
    hint: 'کانال یا صفحه منتشرکننده و ادعای مطرح‌شده را بنویسید.',
    department: 'پلیس فتا',
    modules: ['contact']
  },

  // ۵. پلیس امنیت اقتصادی (Economic Security)
  goods_smuggling: {
    title: 'قاچاق سازمان‌یافته کالا، سوخت و ارز',
    detail: 'چه حجم کالا یا سوخت قاچاقی و در کدام انبار یا مسیر قرار دارد؟',
    hint: 'نوع کالای قاچاق، خودروها، انبار نگهداری و بارنامه‌های جعلی را بنویسید.',
    department: 'پلیس امنیت اقتصادی',
    modules: ['vehicle', 'place']
  },
  hoarding_monopoly: {
    title: 'احتکار عمده کالاهای اساسی، ارزاق و ملزومات پزشکی',
    detail: 'کدام انبار یا سردخانه اقدام به احتکار اقلام ضروری مردم کرده است؟',
    hint: 'نوع کالا، تناژ یا مقدار تقریبی و آدرس سوله یا انبار را ثبت کنید.',
    department: 'پلیس امنیت اقتصادی',
    modules: ['place']
  },
  currency_market_disruption: {
    title: 'اخلال در بازار ارز، طلا و نظام اقتصادی کشور',
    detail: 'معاملات فردایی غیرمجاز، دلالی کلان یا اتاق‌های قیمت‌سازی در کجا فعال است؟',
    hint: 'کانال‌ها، صرافی‌های غیرمجاز و سرشبکه‌های ارزی را معرفی فرمایید.',
    department: 'پلیس امنیت اقتصادی',
    modules: ['contact', 'person']
  },
  tax_evasion_bribery: {
    title: 'فرار مالیاتی کلان، ارتشاء و اختلاس در دستگاه‌ها',
    detail: 'چه رشوه، فاکتورسازی یا فرار مالیاتی عمده‌ای گزارش شده است؟',
    hint: 'ارگان، سمت مسئول و اسناد مرتبط با تخلف را به اختصار بیان کنید.',
    department: 'پلیس امنیت اقتصادی',
    modules: ['person', 'contact']
  },

  // ۶. پلیس پیشگیری و گشت‌های انتظامی (Patrols & Prevention)
  property_vandalism: {
    title: 'تخریب و آسیب به اموال عمومی، ایستگاه‌ها و نمادهای شهری',
    detail: 'چه خسارتی به اتوبوس، ایستگاه، دوربین شهری یا اموال عمومی وارد شد؟',
    hint: 'محل خسارت، زمان و مشخصات عاملان تخریب را توضیح دهید.',
    department: 'پلیس پیشگیری',
    modules: ['place', 'person']
  },
  street_harassment: {
    title: 'ایجاد مزاحمت خیابانی و سلب آسایش نوامیس',
    detail: 'چه خودرو یا موتورسواری اقدام به ایجاد مزاحمت و تعقیب کرده است؟',
    hint: 'پلاک وسیله نقلیه، محل وقوع و عبارات یا رفتار تهدیدآمیز را ثبت کنید.',
    department: 'پلیس پیشگیری',
    modules: ['vehicle', 'person']
  },
  land_grab: {
    title: 'تصرف عدوانی اراضی ملی، منابع طبیعی و زمین‌خواری',
    detail: 'چه زمین یا منبع طبیعی تصرف یا دیوارکشی غیرقانونی شده است؟',
    hint: 'موقعیت زمین، متراژ تقریبی و متصرفان را مشخص نمایید.',
    department: 'پلیس پیشگیری',
    modules: ['place']
  },
  suspicious_movement: {
    title: 'تردد و تجمع افراد و اتباع غیرمجاز مشکوک',
    detail: 'چه تجمع یا اقامت مشکوکی در منازل مخروبه یا حاشیه محله مشاهده می‌شود؟',
    hint: 'آدرس دقیق، تعداد افراد و رفتارهای مشکوک را بیان نمایید.',
    department: 'پلیس پیشگیری',
    modules: ['place', 'person']
  },

  // ۷. پلیس راهور (Traffic & Roads)
  hit_and_run: {
    title: 'تصادف فوتی یا جرحی و فرار از صحنه حادثه',
    detail: 'خودروی متواری چه مدل، رنگ یا پلاکی داشته و در چه مسیری گریخت؟',
    hint: 'نوع خودرو، پلاک کامل یا ناقص، رنگ و آثار آسیب روی بدنه را بنویسید.',
    department: 'پلیس راهور',
    modules: ['vehicle', 'place']
  },
  reckless_racing: {
    title: 'کورس شبانه و رانندگی پرخطر مخل جان شهروندان',
    detail: 'حرکات نمایشی، لایی‌کشی یا سرعت جنون‌آمیز در کدام اتوبان صورت می‌گیرد؟',
    hint: 'نام بزرگراه یا معبر، ساعات تکرار و پلاک خودروهای متخلف را ثبت فرمایید.',
    department: 'پلیس راهور',
    modules: ['vehicle', 'place']
  },
  tampered_plates: {
    title: 'پلاک مخدوش، دستکاری‌شده، پوشانده یا فاقد پلاک',
    detail: 'پلاک چه وسیله‌ای پوشانده یا ارقام آن دستکاری شده است؟',
    hint: 'مدل و رنگ خودرو یا موتور و محل تردد آن را شرح دهید.',
    department: 'پلیس راهور',
    modules: ['vehicle']
  }
};

export const EVENTS={
 ...NUMBERED_TOPICS,
 ...EXTENDED_EVENTS,
 ...POLICE_SECURITY_EVENTS,
 data_breach:{title:'دسترسی یا افشای بدون اجازهٔ اطلاعات',detail:'چه رفتار مشخصی از دسترسی یا افشای بدون اجازه مشاهده کرده‌اید؟',hint:'نشانهٔ مشاهده‌شده، حساب یا وسیلهٔ درگیر و نحوهٔ اطلاع را توضیح دهید؛ رمز، محتوای محرمانه یا اطلاعات خصوصی غیرضروری ننویسید.',modules:['person','contact']},
 trafficking:{title:'احتمال قاچاق انسان و بهره‌کشی',detail:'چه نشانه‌ای از اجبار، فریب یا بهره‌کشی مشاهده یا دریافت کرده‌اید؟',hint:'وعدهٔ اولیه، محدودیت رفت‌وآمد، گرفتن مدارک یا وادارکردن به کار را فقط در صورت اطلاع شرح دهید. انتقال افراد به‌تنهایی اثبات قاچاق نیست.',modules:['person','vehicle','contact']},
 confinement:{title:'ربایش یا نگهداری اجباری',detail:'دربارهٔ بردن یا نگه‌داشتن فرد برخلاف خواستش چه می‌دانید؟',hint:'ترتیب اتفاق‌ها، آخرین مشاهده و نحوهٔ اطلاع خود را جدا بنویسید.',modules:['person','vehicle','contact']},
 forgery:{title:'جعل یا استفاده از مدرک جعلی',detail:'کدام مدرک محل تردید است و چه چیزی دربارهٔ آن مشاهده کرده‌اید؟',hint:'نوع مدرک و نحوهٔ استفاده را بنویسید؛ اگر جعلی‌بودن فقط شنیده یا احتمال است، مشخص کنید.',modules:['person','contact']},
 assault:{title:'نزاع، درگیری یا آسیب بدنی',detail:'چه نوع درگیری رخ داد و چه رفتاری مشاهده کردید؟',hint:'درگیری لفظی یا فیزیکی و رفتار دیده‌شده را شرح دهید؛ آسیب، سلاح یا مقصر نامعلوم را حدس نزنید.',modules:['person','vehicle','contact']},
 theft:{title:'سرقت',detail:'چه چیزی به سرقت رفته است؟',hint:'نوع مال، مشخصات و آخرین زمان مشاهده را در صورت اطلاع بنویسید.',modules:['person','vehicle','contact']},
 fraud:{title:'کلاهبرداری',detail:'چه وعده یا معامله‌ای مطرح شد و چه اتفاقی افتاد؟',hint:'روش پرداخت و آنچه دریافت کرده‌اید را توضیح دهید. رمز یا اطلاعات بانکی کامل ننویسید.',modules:['person','contact']},
 damage:{title:'تخریب اموال',detail:'چه آسیبی به اموال وارد شده است؟',hint:'نوع مال و آسیب قابل مشاهده را شرح دهید؛ علت نامعلوم را حدس نزنید.',modules:['person','vehicle','contact']},
 fire:{title:'آتش‌سوزی',detail:'کدام بخش دچار آتش‌سوزی شده بود؟',hint:'آنچه مشاهده کردید و خسارت قابل مشاهده را شرح دهید.',modules:[]},
 accident:{title:'حادثه و تصادف',detail:'چه آسیب یا خسارتی مشاهده کردید؟',hint:'مشاهدات خود را توضیح دهید؛ تعیین مقصر لازم نیست.',modules:['person','vehicle','contact']},
 harassment:{title:'تهدید و مزاحمت',detail:'چه رفتار یا تهدید مشخصی رخ داده است؟',hint:'رفتار یا عبارت گفته‌شده و دفعات وقوع را در صورت اطلاع بنویسید.',modules:['person','contact']},
 service:{title:'خدمات شهری',detail:'مشکل مشاهده‌شده چیست؟',hint:'خرابی یا اختلال و تأثیر قابل مشاهدهٔ آن را شرح دهید.',modules:[]},
 other:{title:'گزارش عمومی و انتظامی',detail:'چه اتفاقی رخ داده و چه خسارت یا صدمه‌ای ایجاد شده است؟',hint:'آنچه می‌دانید را به زبان خودتان شرح دهید.',modules:[]}
};
export const eventIds=a=>{const values=Array.isArray(a?.events)?a.events:[a?.event];const ids=[...new Set(values.map(v=>typeof v==='string'?v:v?.type).filter(id=>Object.hasOwn(EVENTS,id)))];return ids.length?ids:['other']};
export const detailId=id=>`details_${id}`;
export const titleFor=a=>eventIds(a).map(id=>EVENTS[id].title).join(' + ');
export {normalize} from './persian-normalize.js';
// Split complete narrative clauses, preserving each verbatim span for review.
export const incidentClauses=text=>String(text).split(/(?<=[.؛!؟\n])\s*|\s+و\s+(?=یکی از)|\s+(?=(?:ماشین|خودرو|بعد از|هرچی|هر چه|اما |ولی |سپس |همچنین |هم\s*زمان ))/u).map(x=>x.trim().replace(/\s+و$/u,'')).filter(Boolean);
// A narrower label supersedes the general one it is a kind of: an investment
// scheme is a fraud, a phishing attack is an unauthorized access, and a channel
// teaching bomb-making is not itself a bombing. Both would otherwise be
// reported, which reads as two separate incidents.
const specificTopics={...NUMBERED_TOPICS,weapon_threat:{replaces:['harassment']},
 investment_fraud:{replaces:['fraud','financial_complaint']},
 online_fraud_scam:{replaces:['fraud','financial_complaint']},
 phishing_banking:{replaces:['fraud','data_breach','cyber_attack']},
 cyber_hacking:{replaces:['cyber_attack','data_breach']},
 cyber_blackmail:{replaces:['harassment','online_harm']},
 armed_robbery:{replaces:['theft']},
 violent_theft:{replaces:['theft']},
 pickpocketing:{replaces:['theft']},
 street_brawl:{replaces:['assault']},
 knife_brawl:{replaces:['assault']},
 thugs_and_hoodlums:{replaces:['assault','harassment']},
 illegal_shooting:{replaces:['shooting','weapon_threat']},
 narcotics_distribution:{replaces:['drug_supply']},
 drug_den:{replaces:['drug_use']},
 hit_and_run:{replaces:['accident']},
 cyber_attack:{replaces:['data_breach']},
 identity_misuse:{replaces:['impersonation']},
 dangerous_instruction:{replaces:['pdf_a13','online_harm']},
 stolen_goods:{replaces:[]},gambling:{replaces:[]},drone_sighting:{replaces:[]},
 bribery:{replaces:['official_complaint']},dereliction:{replaces:['official_complaint']},corrupt_network:{replaces:['official_complaint']},
 abuse_of_office:{replaces:['official_complaint','impersonation']},embezzlement:{replaces:['financial_complaint']},sexual_violence:{replaces:['assault','harassment']},online_harm:{replaces:['assault','harassment']},public_nuisance:{replaces:['harassment']}};

const POLICE_SECURITY_RULES = [
 ['online_fraud_scam', /(?:(?:فروشگاه\s+اینترنتی|خرید\s+اینترنتی|خرید\s+انلاین|از\s+(?:یک\s+|یه\s+)?(?:سایت|پیج|کانال|صفحه|اینستاگرام|تلگرام|دیوار|شیپور))[^\n.!؟]{0,95}?(?:خریدم|خریدیم|خرید|سفارش|پرداخت|واریز|بیعانه|ارسال\s+نشد|ارسال\s+نکرد|نفرستاد|پاسخ\s+نمی\s*دهد|جواب\s+نمی\s*دهد|بلاک|مسدود|کلاهبرداری)|(?:کالا|سفارش|محصول|بسته)\s+(?:را\s+)?(?:ارسال\s+نکرد|ارسال\s+نشده|نفرستاد|تحویل\s+نداد)[^\n.!؟]{0,65}?(?:پاسخ\s+نمی\s*دهد|جواب\s+نمی\s*دهد|تلفن\s+را\s+جواب|بلاک|مسدود)|(?:بعد\s+از\s+پرداخت|پس\s+از\s+پرداخت|پول\s+را\s+ریختم)[^\n.!؟]{0,45}?(?:بلاکم?\s+کرد|مسدودم?\s+کرد|جواب\s+نداد|ارسال\s+نکرد))/gu],
 ['phishing_banking', /(?:درگاه\s+جعلی|فیشینگ|لینک\s+(?:جعلی|الوده|مشکوک|ثبت\s+نام|یارانه|سهام\s+عدالت|ابلاغیه|ثنا|شکایت)|سرقت\s+اطلاعات\s+(?:بانکی|کارت|حساب)|برداشت\s+غیر\s*مجاز\s+از\s+حساب|خالی\s+(?:شدن|کردن)\s+حساب)/gu],
 ['cyber_hacking', /(?:هک\s+(?:شدن|کردن|شد|کردند|حساب|اکانت|تلگرام|اینستاگرام|واتساپ|سایت|سامانه|سرور)|نفوذ\s+سایبری|باج\s*افزار)/gu],
 ['cyber_blackmail', /(?:اخاذی\s+(?:سایبری|اینترنتی|در\s+تلگرام|در\s+اینستاگرام|مجازی)|تهدید\s+به\s+(?:انتشار|پخش)\s+(?:عکس|تصاویر|فیلم|اطلاعات)\s+(?:خصوصی|شخصی))/gu],
 ['armed_robbery', /(?:سرقت\s+مسلحانه|دزدی\s+مسلحانه|با\s+(?:سلاح\s+گرم|اسلحه|کلت|کلاشینکف|تفنگ)\s+[^\n.!؟]{0,45}?(?:سرقت|دزدی|بردند|زورگیری))/gu],
 ['violent_theft', /(?:سرقت\s+به\s+عنف|خفت\s*گیری|زورگیری|با\s+(?:قمه|چاقو|سلاح\s+سرد|شوکر)\s+[^\n.!؟]{0,45}?(?:سرقت|زورگیری|خفت|گرفتند|بردند))/gu],
 ['pickpocketing', /(?:کیف\s*قاپی|موبایل\s*قاپی|قاپ\s*زنی|جیب\s*بری|(?:گوشی|کیف|موبایل)\S*\s+را\s+(?:قاپید|قاپیدند|زدند\s+و\s+فرار))/gu],
 ['thugs_and_hoodlums', /(?:اراذل\s+و\s+اوباش|عربده\s*کشی|قمه\s*کشی|قدرت\s*نمایی\s+با\s+(?:قمه|شمشیر|چاقو))/gu],
 ['illegal_shooting', /(?:تیراندازی\s+(?:غیر\s*مجاز|هوایی|با\s+سلاح)|شلیک\s+(?:گلوله|تیر|اسلحه))/gu],
 ['narcotics_distribution', /(?:(?:فروش|پخش|توزیع|تولید\s+و\s+پخش|خرده\s*فروشی)\s+مواد\s*مخدر|باند\s+(?:تولید\s+و\s+)?(?:پخش|توزیع)\s+مواد|ساقی\s+مواد|(?:فروش|پخش|توزیع)\s+(?:شیشه|هروئین|تریاک|گل|حشیش|کراک))/gu],
 ['bootlegging_alcohol', /(?:(?:فروش|توزیع|پخش|قاچاق|تولید)\s+مشروبات\s+الکلی|مشروب\s*فروشی)/gu],
 ['drug_den', /(?:پاتوق\s+(?:معتادان|مصرف\s+مواد)|تجمع\s+معتادان\s+متجاهر|استعمال\s+علنی\s+مواد)/gu],
 ['goods_smuggling', /(?:قاچاق\s+(?:کالا|سوخت|ارز|گازوئیل|بنزین|سیگار|دام|مشروبات))/gu],
 ['hoarding_monopoly', /(?:احتکار\s+(?:کالا|ارزاق|برنج|روغن|دارو|اقلام\s+اساسی|ماحتاج))/gu],
 ['hit_and_run', /(?:تصادف\s+[^\n.!؟]{0,45}?(?:فرار|متواری\s+شد|گریخت)|زد\s+و\s+فرار\s+کرد)/gu],
 ['reckless_racing', /(?:کورس\s+(?:شبانه|خیابانی)|لایی\s*کشی\s+و\s+سرعت|حرکات\s+نمایشی\s+با\s+(?:خودرو|ماشین|موتور))/gu]
];

const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36)};
/**
 * The supplemental sections the narrative itself brings up: a vehicle, a
 * phone or online account, people. Only these (and the ones the topic
 * needs) are asked about; a car break-in is not asked for a web address.
 */
export function mentionedFollowups(text){
 const s=String(text||'').replace(/‌/g,' ');
 return [
  ...(/خودرو|ماشین|موتور|وسیله نقلیه|(?:^|\s)ون(?:\s|$|[،.])|کامیون|وانت|اتوبوس|تاکسی|پراید|پژو|سمند|تیبا|پیکان|دوچرخه|پلاک/.test(s)?['vehicle']:[]),
  ...(/تلگرام|واتساپ|واتس اپ|اینستاگرام|ایتا|روبیکا|پیام رسان بله|سروش|تماس گرفت|زنگ زد|تلفن|شماره|پیام رسان|پیام داد|پیامک|حساب کاربری|پیج|صفحه (?:اینستاگرام|مجازی)|سایت|وب سایت|لینک|ایمیل|آیدی|ایدی|اکانت|کارت به کارت|شماره کارت|شماره حساب|شبا|درگاه/.test(s)?['contact']:[]),
  ...(/(?:یک|دو|سه|چهار|پنج|چند|[۰-۹\d]+)\s*(?:تا\s*)?(?:نفر|مرد|زن|پسر|دختر|جوان)|سارق|دزد|مهاجم|ضارب|راننده|فروشنده|مامور|مأمور|کارمند|همسایه|شاهد|مردی|زنی|پسری|دختری|فردی/.test(s)?['person']:[])
 ];
}
const APPEARANCE_CLAUSE_MARKER =
  /(?:موهای?\s+(?:بلند|کوتاه|مش|فر|فرفری|صاف|رنگ\s*شده|سفید|مشکی|جوگندمی|بور|طلایی|قهوه\s*ای|کم\s*پشت|پرپشت)|موهاش\s+[آ-ی]+|(?:دست|پا|پای|صورت|گردن|بدن|سینه|بازو|ساعد|شانه|کمر|پشت)(?:\s+راستش?|\s+چپش?)?\s+(?:فول\s+)?(?:تتو|خالکوبی)|(?:تتو|خالکوبی)(?:\s+فول)?(?:\s+(?:روی|در)\s+[^\s،.؛!؟]+)?|(?:(?:پا|پای|دست)(?:\s+چپش?|\s+راستش?)?\s+)?(?:لنگ\s*می\s*زن(?:ه|د|ند)|می\s*لنگ(?:ه|د|ند)|لنگان(?:\s+است|\s+بود|\s+راه\s+می\s*رود|\s+راه\s+میره)?|شل\s*می\s*زن(?:ه|د))|(?:پا|پای|دست|چشم|گوش)(?:\s+چپش?|\s+راستش?)\s+(?:لنگ|معیوب|معلول|قطع|نابینا|کج|شکسته|آسیب\s*دیده|تیر\s*خورده|زخمی)|جای?\s+(?:زخم|چاقو|قمه|بخیه|سوختگی|گلوله|تیر|اسید)|نقص\s+عضو|با\s+عصا|قد\s+(?:بلند|کوتاه|متوسط|حدود\s*[\d۰-۹]+)|هیکل\s+(?:درشت|ورزشی|چاق|لاغر|چهارشانه)|چهارشانه|پوست\s+(?:سبزه|تیره|روشن|سفید)|ریش\s+(?:بلند|کوتاه|پروفسوری|بزی|پرپشت|سفید|مشکی)|کچل|طاس|(?:لباس|پیراهن|تیشرت|شلوار|کاپشن|هودی|مانتو|کلاه|عینک|ماسک)\s+(?:مشکی|سفید|تیره|روشن|قرمز|آبی|سبز|زرد|قهوه\s*ای|خاکی|طوسی|دودی|طبی|ورزشی))/u;

const NON_APPEARANCE_PREDICATE =
  /(?:آزار\s+جنسی|ازار\s+جنسی|سرقت\s+کرد|دزدی\s+کرد|دزدید|قاپید|کلاهبرداری|خریدم|خرید\s+کردم|پرداخت\s+کردم|باند\s+تولید|پخش\s+مواد|فروش\s+مشروبات|ملقب\s+به|مشخصاتی?\s+ندارم|در\s+فضای\s+مجازی\s+دیدم|توی?\s+فضای\s+مجازی\s+دیدم|خودم\s+دیدم)/u;

const APPEARANCE_SPAN_GLOBAL =
  /(?:[آ-ی]{2,}\s+)?(?:موهای?\s+(?:بلند|کوتاه|مش|فر|فرفری|صاف|رنگ\s*شده|سفید|مشکی|جوگندمی|بور|طلایی)(?:\s+دارد|\s+داره|\s+هستش|\s+است)?|موهاش\s+[آ-ی]+(?:\s+هستش|\s+است)?|(?:دست|پا|پای|صورت|گردن|بدن|سینه|بازو)(?:\s+راستش?|\s+چپش?)?\s+(?:فول\s+)?(?:تتو|خالکوبی)|(?:تتو|خالکوبی)\s+(?:روی|در)\s+[^\s،.؛!؟]+|(?:(?:پا|پای|دست)(?:\s+چپش?|\s+راستش?)?\s+)?(?:لنگ\s*می\s*زن(?:ه|د|ند)|می\s*لنگ(?:ه|د|ند)|لنگان(?:\s+راه\s+می\s*رود|\s+راه\s+میره)?|شل\s*می\s*زن(?:ه|د))(?:\s+(?:در\s+اثر|به\s+خاطر|به\s+دلیل|بر\s+اثر)\s+[^\n،.؛!؟\s]+(?:\s+[^\n،.؛!؟\s]+){0,3})?|(?:پا|پای|دست|چشم|گوش)(?:\s+چپش?|\s+راستش?)\s+(?:آسیب\s*دیده|شکسته|معلول|قطع|نابینا|تیر\s*خورده|زخمی)(?:\s+(?:در\s+اثر|به\s+خاطر|به\s+دلیل|بر\s+اثر)\s+[^\n،.؛!؟\s]+(?:\s+[^\n،.؛!؟\s]+){0,3})?|جای?\s+(?:زخم|چاقو|قمه|بخیه|سوختگی|گلوله|تیر|اسید)(?:\s+(?:روی|در)\s+[^\s،.؛!؟]+)?|نقص\s+عضو|با\s+عصا|قد\s+(?:بلند|کوتاه|متوسط|حدود\s*[\d۰-۹]+)|هیکل\s+(?:درشت|ورزشی|چاق|لاغر|چهارشانه)|چهارشانه|ریش\s+(?:بلند|کوتاه|پروفسوری|بزی|پرپشت)|کچل|طاس|(?:لباس|پیراهن|تیشرت|شلوار|کاپشن|هودی|مانتو|کلاه|عینک|ماسک)\s+(?:مشکی|سفید|تیره|روشن|قرمز|آبی|سبز|زرد|قهوه\s*ای|خاکی|طوسی|دودی|طبی|ورزشی))/gu;

export function extractAppearanceFromText(text = '') {
  const src = String(text || '');
  if (!src.trim()) return '';
  const { s, map } = foldIndexed(src);
  const from = (i) => map[Math.min(i, map.length - 1)];
  const upto = (i) => map[Math.max(0, Math.min(i, map.length - 1))];
  const quote = (index, length) => src.slice(from(index), upto(index + length - 1) + 1);
  const normKey = (str) => String(str || '').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();

  const appearanceParts = [];
  const addPart = (piece) => {
    const clean = String(piece || '').trim().replace(/^[،,؛.\s]+|[،,؛.\s]+$/gu, '');
    const cleanNorm = normKey(clean);
    if (!cleanNorm) return;
    if (!appearanceParts.some((existing) => normKey(existing).includes(cleanNorm))) {
      // If the new piece is a superset of an existing shorter piece, replace it
      const subIdx = appearanceParts.findIndex((existing) => cleanNorm.includes(normKey(existing)));
      if (subIdx >= 0) {
        appearanceParts[subIdx] = clean;
      } else {
        appearanceParts.push(clean);
      }
    }
  };

  // 1. Check line/clause-level descriptions (e.g. "دانیال موهای بلند داره دست راست فول تتو", "پدرام پای چپش لنگ میزنه در اثر تیر خوردن")
  const clauses = [...s.matchAll(/[^\n؛.!؟،]+/gu)];
  for (const cl of clauses) {
    const rawStr = cl[0];
    const leadWs = rawStr.match(/^\s*/)?.[0]?.length || 0;
    const trailWs = rawStr.match(/\s*$/)?.[0]?.length || 0;
    const trimmedLen = rawStr.length - leadWs - trailWs;
    if (trimmedLen <= 0) continue;
    const clauseFolded = rawStr.trim();
    const startIdx = cl.index + leadWs;

    if (clauseFolded.length <= 95 && APPEARANCE_CLAUSE_MARKER.test(clauseFolded) && !NON_APPEARANCE_PREDICATE.test(clauseFolded)) {
      const rawClause = quote(startIdx, trimmedLen).trim();
      addPart(rawClause);
    } else {
      // 2. For clauses not captured as a whole appearance clause, scan span-level matches
      const subMatches = [...clauseFolded.matchAll(APPEARANCE_SPAN_GLOBAL)];
      for (const am of subMatches) {
        const piece = quote(startIdx + am.index, am[0].length).trim();
        addPart(piece);
      }
    }
  }

  return appearanceParts.join(' ، ');
}

export function extractEntitiesFromNarrative(text = '', known = {}, events = [], rawEntities = []) {
  const s = String(text || '').replace(/\u200c/g, ' ');
  const list = [];
  const seenIds = new Set();

  const pushEntity = (ent) => {
    if (!ent || typeof ent !== 'object') return;
    const id = String(ent.id || ent.type || '').trim();
    if (!id || seenIds.has(id)) return;
    seenIds.add(id);
    list.push({
      id,
      type: String(ent.type || id),
      label: String(ent.label || id),
      value: String(ent.value || ''),
      stage: Number(ent.stage) || 2,
      needsCompletion: ent.needsCompletion !== undefined ? Boolean(ent.needsCompletion) : true,
      fieldLabel: String(ent.fieldLabel || ent.label || 'جزئیات تکمیلی'),
      placeholder: String(ent.placeholder || 'اطلاعات تکمیلی را وارد کنید...'),
      fields: ent.fields && typeof ent.fields === 'object' ? ent.fields : {},
    });
  };

  // 1. Detect and validate core entities from narrative & extracted known facts first
  const isOnlineOrFraud =
    Boolean(known?.isOnline) ||
    events.some((e) => ['online_fraud_scam', 'phishing_banking', 'fraud', 'investment_fraud'].includes(e)) ||
    /(?:پرداخت|واریز|کارت\s+به\s+کارت|شماره\s+کارت|شماره\s+حساب|شبا|حساب\s+بانکی|درگاه|خریدم|خرید\s+کردم)/u.test(s);

  const cardOrIbanMatch = s.match(/(?:IR\d{24}|\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b|(?:شماره\s+(?:حساب|کارت|شبا)\s*[:؛]?\s*[\d۰-۹-]{8,26}))/iu);
  const bankOwnerMatch = s.match(/(?:به\s+نام|صاحب\s+حساب)\s+([آ-ی]{2,}(?:\s+[آ-ی]{2,}){0,2})/u);
  const llmBank = Array.isArray(rawEntities) ? rawEntities.find((e) => e && (e.id === 'bank_account' || e.type === 'bank_account')) : null;
  if (isOnlineOrFraud || cardOrIbanMatch || llmBank) {
    const bankNumVal = cardOrIbanMatch ? cardOrIbanMatch[0].replace(/^شماره\s+(?:حساب|کارت|شبا)\s*[:؛]?\s*/u, '').trim() : (llmBank?.value || '');
    const bankOwnerVal = bankOwnerMatch ? bankOwnerMatch[1].trim() : '';
    const combinedBankVal = [bankNumVal, bankOwnerVal ? `به نام ${bankOwnerVal}` : ''].filter(Boolean).join(' — ') ||
      (known?.method && /کارت\s+به\s+کارت/u.test(known.method) ? 'پرداخت کارت به کارت' : '');
    pushEntity({
      id: 'bank_account',
      type: 'bank_account',
      label: 'اطلاعات بانکی',
      value: combinedBankVal,
      stage: 2,
      needsCompletion: true,
      fieldLabel: 'شماره حساب، شماره کارت یا شبای دریافت‌کننده وجه و نام صاحب حساب',
      placeholder: 'مثلاً: ۶۰۳۷۹۹... به نام علی رضایی (بانک ملی)',
      fields: {
        bankNumber: bankNumVal,
        bankOwner: bankOwnerVal,
      },
    });
  }

  const resolvedAppearance = [known?.appearance || '', extractAppearanceFromText(text)]
    .filter(Boolean)
    .reduce((acc, part) => {
      for (const item of part.split(' ، ').map((x) => x.trim()).filter(Boolean)) {
        if (!acc.some((existing) => existing.includes(item))) {
          const subIdx = acc.findIndex((existing) => item.includes(existing));
          if (subIdx >= 0) acc[subIdx] = item;
          else acc.push(item);
        }
      }
      return acc;
    }, [])
    .join(' ، ');

  const llmAppearance = Array.isArray(rawEntities) ? rawEntities.find((e) => e && (e.id === 'appearance' || e.type === 'appearance')) : null;
  if (resolvedAppearance || llmAppearance || APPEARANCE_CLAUSE_MARKER.test(s) || /(?:چهره|مشخصات\s+ظاهری|لنگ\s*می\s*زن|می\s*لنگ)/u.test(s)) {
    const appVal = resolvedAppearance || llmAppearance?.value || '';
    pushEntity({
      id: 'appearance',
      type: 'appearance',
      label: 'مشخصات ظاهری افراد',
      value: appVal,
      stage: 2,
      needsCompletion: true,
      fieldLabel: 'مشخصات ظاهری افراد (قد، سن، مدل مو، تتو، لباس، نقص عضو یا لنگ زدن)',
      placeholder: 'مثلاً: قد حدود ۱۸۰، موی بلند، تتو روی دست راست، پای چپ لنگ می‌زند...',
      fields: {
        personAppearance: appVal,
      },
    });
  }

  const plateMatch = s.match(/(?:پلاک\s*[:؛]?\s*)?([۰-۹\d]{2}\s*(?:الف|تشریفات|معلولین|گذرموقت|[آ-ی])\s*[۰-۹\d]{3}(?:\s*(?:ایران|-)?\s*[۰-۹\d]{2})?)/u);
  const vehicleModelMatch = s.match(/((?:خودروی?\s+|ماشین\s+)?(?:پژو(?:\s*۲۰۶|\s*۲۰۷|\s*۴۰۵|\s*پارس)?|پراید|سمند|تیبا|کوییک|ساینا|دنا|رانا|تارا|وانت|نیسان|موتور(?:\s*سیکلت)?(?:\s+هوندا)?)(?:\s+(?:سفید|مشکی|سیاه|نقره\s*ای|طوسی|خاکستری|قرمز|آبی|سبز|نوک\s*مدادی))?)/u);
  const llmPlate = Array.isArray(rawEntities) ? rawEntities.find((e) => e && (e.id === 'license_plate' || e.type === 'license_plate')) : null;
  if (
    plateMatch ||
    llmPlate ||
    events.some((e) => ['accident', 'hit_and_run', 'reckless_racing', 'tampered_plates', 'illegal_parking', 'vehicle_theft'].includes(e)) ||
    /(?:خودرو|ماشین|موتور|موتورسیکلت|پراید|پژو|سمند|تیبا|وانت|پلاک)/u.test(s)
  ) {
    const plateVal = plateMatch ? plateMatch[1].trim() : (llmPlate?.value || '');
    const modelVal = vehicleModelMatch ? vehicleModelMatch[1].trim() : '';
    const combinedPlateVal = [modelVal, plateVal ? `پلاک ${plateVal}` : ''].filter(Boolean).join(' — ') || plateVal;
    pushEntity({
      id: 'license_plate',
      type: 'license_plate',
      label: 'شماره پلاک خودرو',
      value: combinedPlateVal,
      stage: 7,
      needsCompletion: true,
      fieldLabel: 'شماره پلاک، مدل و رنگ خودرو یا موتورسیکلت',
      placeholder: 'مثلاً: پژو ۲۰۶ سفید - پلاک ۱۲ الف ۳۴۵ ایران ۶۶',
      fields: {
        vehicleModel: modelVal,
        vehiclePlate: plateVal,
      },
    });
  }

  if (known?.actor || /(?:متهم|متجاوز|سارق|دزد|ضارب|فروشنده|کلاهبردار|ملقب\s+به)/u.test(s)) {
    pushEntity({
      id: 'person_identity',
      type: 'person_identity',
      label: 'هویت و مشخصات فرد / فاعل',
      value: known?.actor || '',
      stage: 2,
      needsCompletion: !known?.actor,
      fieldLabel: 'نام، نام خانوادگی، لقب یا مشخصات هویتی فرد مرتبط',
      placeholder: 'نام، شهرت، لقب یا نقش فرد را وارد کنید...',
      fields: {
        personName: known?.actor || '',
      },
    });
  }

  const phoneOrHandleMatch = s.match(/(?:\b09\d{9}\b|\b۰۹[۰-۹]{9}\b|@[a-zA-Z0-9_.]{3,30})/u);
  if (
    phoneOrHandleMatch ||
    Boolean(known?.isOnline) ||
    /(?:تلفن|موبایل|شماره\s+تماس|پیج|صفحه|کانال|تلگرام|اینستاگرام|واتساپ|ایتا|روبیکا|آیدی|ایدی|بلاک)/u.test(s)
  ) {
    const contactVal = phoneOrHandleMatch ? phoneOrHandleMatch[0] : '';
    pushEntity({
      id: 'contact_info',
      type: 'contact_info',
      label: 'شماره تماس / آیدی یا صفحه مجازی',
      value: contactVal,
      stage: 2,
      needsCompletion: !phoneOrHandleMatch,
      fieldLabel: 'شماره تلفن همراه، آیدی (@id) یا نام صفحه مجازی',
      placeholder: 'مثلاً: 0912... یا @page_name در اینستاگرام/تلگرام',
      fields: {
        contactId: contactVal,
        contactChannel: known?.place && known?.isOnline ? known.place : '',
      },
    });
  }

  if (Boolean(known?.isOnline) || /(?:سایت|وب\s*سایت|فروشگاه\s+اینترنتی|دیوار|شیپور|درگاه|لینک)/u.test(s)) {
    const urlVal = known?.place && known?.isOnline ? known.place : '';
    pushEntity({
      id: 'website_url',
      type: 'website_url',
      label: 'نشانی سایت / فروشگاه اینترنتی',
      value: urlVal,
      stage: 4,
      needsCompletion: !(known?.place && known?.isOnline),
      fieldLabel: 'نام یا آدرس اینترنتی (URL) فروشگاه، سایت یا کانال',
      placeholder: 'مثلاً: https://example.ir یا نام پیج/کانال فروشگاهی',
      fields: {
        websiteUrl: urlVal,
      },
    });
  }

  if (known?.details || events.some((e) => ['theft', 'armed_robbery', 'violent_theft', 'pickpocketing', 'online_fraud_scam', 'fraud'].includes(e))) {
    pushEntity({
      id: 'item_or_amount',
      type: 'item_or_amount',
      label: 'کالا، مال یا مبلغ مورد نظر',
      value: known?.details || '',
      stage: 5,
      needsCompletion: !known?.details,
      fieldLabel: 'نوع کالا، اموال یا مبلغ دقیق خسارت / پرداختی (به تومان)',
      placeholder: 'مثلاً: گوشی موبایل سامسونگ / مبلغ ۲٬۵۰۰٬۰۰۰ تومان',
      fields: {
        custom_item_or_amount: known?.details || '',
      },
    });
  }

  // 2. Preserve any additional dynamic entities returned directly by LLM in JSON
  if (Array.isArray(rawEntities)) {
    for (const item of rawEntities) {
      if (item && (item.id || item.type) && item.label) {
        pushEntity(item);
      }
    }
  }

  return list;
}

export function normalizeAnalysis(raw={},text=''){
 const grounded=e=>typeof e==='string'&&e.trim().length>=3&&text.includes(e.trim());
 const rawEvents=Array.isArray(raw.events)?raw.events:[raw.event];
 const usable=rawEvents.filter(v=>typeof v==='string'||grounded(v?.evidence));
 const events=eventIds({events:usable});
 const allowed=['time','place','source',...events.map(detailId)];
 const seen=new Set();
 const prompts=(Array.isArray(raw.prompts)?raw.prompts:[]).filter(p=>allowed.includes(p.section)&&grounded(p.evidence)&&typeof p.title==='string'&&p.title.length<=240&&p.title.length>5&&!seen.has(p.section)&&seen.add(p.section)).map(p=>({...p,hint:String(p.hint||'').slice(0,400)}));
 const questions=(Array.isArray(raw.questions)?raw.questions:[]).filter(q=>events.includes(q.event)&&grounded(q.evidence)&&typeof q.title==='string'&&q.title.length>5&&q.title.length<=240).filter(q=>q.title.length<=120&&!/به کدام بخش|کدام دسته|عنوان فرد|نوع رخداد/.test(q.title)).slice(0,2).map(q=>({id:`custom_${hash(q.event+q.title)}`,title:q.title,hint:String(q.hint||'').slice(0,400),event:q.event,evidence:q.evidence})).filter((q,i,a)=>a.findIndex(x=>x.id===q.id)===i);
 const needsClarification=Boolean(raw.clarification?.needed)||(!raw.clarificationHandled&&events.every(id=>id==='other'));
 const observationOnly=events.every(id=>id==='other');
 const categoryEvidence=Object.fromEntries((Array.isArray(raw.categories)?raw.categories:[]).filter(c=>Object.hasOwn(CATEGORIES,c?.type)&&grounded(c.evidence)).map(c=>[c.type,c.evidence]));
 const categories=[...new Set([...(Array.isArray(raw.categories)?raw.categories:[]).filter(c=>typeof c==='string'&&Object.hasOwn(CATEGORIES,c)),...Object.keys(categoryEvidence)])];
 const knownKeys=['time','place','source','actor','appearance','peopleCount','victim','details','reason','method','otherPeople','otherInfo'];
 const extractedApp = extractAppearanceFromText(text);
 const rawApp = typeof raw.known?.appearance === 'string' ? raw.known.appearance : '';
 const mergedAppearance = [rawApp, extractedApp]
  .filter(Boolean)
  .reduce((acc, part) => {
   for (const item of part.split(' ، ').map(x => x.trim()).filter(Boolean)) {
    if (!acc.some(ex => ex.includes(item))) {
     const subIdx = acc.findIndex(ex => item.includes(ex));
     if (subIdx >= 0) acc[subIdx] = item;
     else acc.push(item);
    }
   }
   return acc;
  }, [])
  .join(' ، ');
 const known={
  ...Object.fromEntries(knownKeys.map(k=>[k,typeof raw.known?.[k]==='string'?raw.known[k]:''])),
  time: typeof raw.known?.time === 'string' ? raw.known.time : '',
  place: typeof raw.known?.place === 'string' ? raw.known.place : '',
  source: typeof raw.known?.source === 'string' ? raw.known.source : '',
  actor: typeof raw.known?.actor === 'string' ? raw.known.actor : '',
  peopleCount: typeof raw.known?.peopleCount === 'string' ? raw.known.peopleCount : '',
  victim: typeof raw.known?.victim === 'string' ? raw.known.victim : '',
  details: typeof raw.known?.details === 'string' ? raw.known.details : '',
  method: typeof raw.known?.method === 'string' ? raw.known.method : '',
  reason: typeof raw.known?.reason === 'string' ? raw.known.reason : '',
  otherInfo: typeof raw.known?.otherInfo === 'string' ? raw.known.otherInfo : '',
  otherPeople: typeof raw.known?.otherPeople === 'string' ? raw.known.otherPeople : '',
  appearance: mergedAppearance,
  lackOfOtherDetails: Boolean(raw.known?.lackOfOtherDetails),
  vaguePlace: Boolean(raw.known?.vaguePlace),
  isOnline: Boolean(raw.known?.isOnline),
  sourceConflict: Boolean(raw.known?.sourceConflict),
 };
 const entities = extractEntitiesFromNarrative(text, known, events, raw.entities);
 const structuredAnswers = { ...(raw.answers && typeof raw.answers === 'object' ? raw.answers : {}) };
 for (const ent of entities) {
  if (!ent || !ent.id) continue;
  if (['appearance', 'license_plate', 'bank_account', 'person_identity', 'contact_info', 'website_url', 'item_or_amount'].includes(ent.id) || ent.value) {
   structuredAnswers[ent.id] = {
    id: ent.id,
    type: ent.type || ent.id,
    category: ent.label,
    label: ent.label,
    stage: ent.stage || 2,
    value: ent.value || '',
    fields: ent.fields || {},
   };
  }
 }
 return {...raw,bankVersion:BANK_VERSION,categories:observationOnly?['event']:categories,categoryEvidence:{...raw.categoryEvidence,...categoryEvidence},needsClarification,observationOnly,events,event:events[0],title:titleFor({events}),known,entities,answers:structuredAnswers,prompts:observationOnly?[]:prompts,questions:observationOnly?[]:questions,followups:[...new Set((!observationOnly?[...(Array.isArray(raw.followups)?raw.followups:[]),...mentionedFollowups(text)]:[]).filter(x=>['person','vehicle','contact'].includes(x)))],eventEvidence:{...Object.fromEntries(Object.entries(raw.eventEvidence||{}).filter(([id,evidence])=>events.includes(id)&&grounded(evidence))),...Object.fromEntries(rawEvents.filter(e=>e?.type&&events.includes(e.type)&&grounded(e.evidence)).map(e=>[e.type,e.evidence]))}};
}
// Drug talk must be explicit in the same sentence: food, industrial materials
// and a remote mention elsewhere in the narrative do not qualify.
const drugContext=/(?:مواد\s+مخدر|مخدر|تریاک|حشیش|هروئین|شیشه|کراک|گل|ماری\s*جوانا|سرنگ|خمار|نشئه|ساقی|(?:کشیدن|مصرف|تزریق)\s+مواد(?!\s+(?:غذایی|اولیه|شیمیایی|شوینده))|تزریق(?!\s+(?:اشتباه|دارو|واکسن|سرم|انسولین|امپول))|(?:خرید|فروش|پخش|توزیع|قاچاق|حمل|مرکز\s+پخش)\s+مواد(?!\s+(?:غذایی|اولیه|شیمیایی|شوینده|محترقه|منفجره)))/u;
const onlineContext=/اینترنت|مجازی|انلاین|تلگرام|واتساپ|واتس\s*اپ|اینستاگرام|اینستا|توییتر|توئیتر|ایتا|روبیکا|پیام\s*رسان|شبکه\s*(?:ی\s+)?اجتماعی|کانال|گروه|وب\s*سایت|سایت|صفحه/u;

export function localAnalysis(text){
 const src=String(text);
 // One folded view for matching, one index map back into the untouched
 // narrative so every stored quote stays exactly as the reporter wrote it.
 const {s:folded,map}=foldIndexed(src);
 const s=folded;
 const from=i=>map[Math.min(i,map.length-1)];
 const upto=i=>map[Math.max(0,Math.min(i,map.length-1))];
 const quote=(index,length)=>src.slice(from(index),upto(index+length-1)+1);
 // Never join a subject in one sentence to a predicate in another.
 const sentences=[...s.matchAll(/[^؛.!؟\n]+/gu)];
 const rules=[...POLICE_SECURITY_RULES,...CORE_RULES,...EXTRA_RULES];
 const eventEvidence={},events=[],occurrences=new Map(),localEventOffsets={};
 // Shared acceptance test. A match only becomes a reported topic when the
 // narrative asserts it: not negated, not hedged, not hypothetical, not fiction
 // or a drill, and not withdrawn later in the same sentence.
 const accepts=(id,m)=>{
  const sentenceStart=m.sentenceStart,sentence=m.sentence;
  if(id==='pdf_a02'&&/تجمع|تظاهرات|اعتصاب|راهپیمایی|تحصن/.test(sentence))return false;
  if(id==='online_harm'&&!onlineContext.test(sentence))return false;
  if((id==='drug_supply'||id==='drug_use')&&!drugContext.test(sentence))return false;
  if(id==='official_complaint'&&!complaintContext(m,s))return false;
  const before=s.slice(Math.max(sentenceStart,m.index-70),m.index);
  const rest=s.slice(m.index+m[0].length);
  const after=incidentNegationTail(id,rest.split(/[،,؛.!؟\n]|\s+(?:اما|ولی|سپس|و|و سپس|بعد از|هم زمان|تا|که|چون|زیرا)\s/u)[0].slice(0,30));
  if(isNonAlcoholic(id,m[0],after))return false;
  if(id==='assault'&&/^\s*(?:ذهنی|فکری|درسی|نرم افزاری|سیاسی|لفظی با خودش)/u.test(after))return false;
  if(id==='theft'&&/(?:سوار|داخل|توی)\s+\S{0,14}$/u.test(before))return false;
  // An unspecified conflict inside the same public-nuisance phrase is not a second bodily-injury allegation.
  if(id==='assault'&&m[0]==='درگیری'&&/^\s+و\s+(?:ایجاد\s+)?مزاحمت\s+(?:برای|به)\s+(?:کسبه|رهگذران|مردم)/u.test(rest))return false;
  const lead=s.slice(sentenceStart,m.index);
  // Retold fiction, drills, precautions and cautionary framing are not reports.
  if(FRAME_GUARD.test(lead))return false;
  // An explicitly hypothetical or illustrative framing covers the whole sentence,
  // however far ahead of the phrase it was written.
  if(HYPOTHETICAL.test(lead))return false;
  // «اگر … چه کنیم؟» asks a question; it does not report an occurrence.
  if(/(?:^|[\s،])(?:اگر|اگه|چنانچه|در\s+صورتی?\s+که)/u.test(lead)&&(s[sentenceStart+sentence.length]==='؟'||/چ(?:ه|ی)\s*(?:کنیم|کنم|کار|باید)|چیکار|چکار|چطور|چجور|چگونه|چه\s+کسی/u.test(sentence)))return false;
  // A clause that withdraws the claim in the same sentence removes it.
  if(RETRACTION.test(rest.split(/[؛.!؟\n]/u)[0]))return false;
  // «صدای ترقه بود نه گلوله»: a contrastive «نه» denies the phrase after it.
  if(/(?:^|[\s،])نه\s*$/u.test(before))return false;
  // An explicit positive fight predicate survives a later denial of injury.
  const positiveConflict=['assault','pdf_a04'].includes(id)&&/^\s+(?:(?:لفظی|فیزیکی)\s+)?(?:کرد(?:ند|ن|م|یم|ی)?|شد(?:ند|ن|م|یم|ی)?|داشت(?:ند|م|یم|ی)?|رخ داد)(?=\s|$|[،؛.!؟])/.test(after);
  const denied=DENIAL.test(after)&&!positiveConflict&&!endsWithSaleVerb(m[0]);
  if(denied||hasInternalTradeNegation(id,m[0])||HEDGE.test(before))return false;
  // «بدون» inside the matched span negates it — «پرواز بدون تأخیر» reports no
  // delay. The exceptions are the phrases where «بدون X» IS the reported harm:
  // an unarmed theft, an access without permission, an act without consent.
  if(/(?:^|\s)(?:بدون|عدم|فاقد)\s/u.test(m[0])&&!/(?:بدون|عدم|فاقد)\s+(?:هیچ\s+|استفاده\s+از\s+)?(?:سلاح|اسلحه|چاقو|خشونت|مجوز|اجازه|رضایت|اطلاع|پروانه|رسیدگی|پیگیری|مزد|حقوق|دستمزد|یخچال|کلاه|کفش|تجهیزات|کمربند|ایمنی|بیمه|نظارت|بهداشت|الکل|سرنشین)/u.test(m[0]))return false;
  return !/(?:بدون|عدم)\s*$/.test(before);
 };
 const located=re=>sentences.flatMap(part=>[...part[0].matchAll(re)].map(m=>Object.assign(m,{index:m.index+part.index,sentenceStart:part.index,sentence:part[0]})));
 for(const [id,re] of [...rules,...NUMBERED_RULES]){
  const matches=located(re).filter(m=>accepts(id,m));
  if(matches.length){events.push(id);occurrences.set(id,matches);eventEvidence[id]=quote(matches[0].index,matches[0].length===undefined?matches[0][0].length:matches[0][0].length)}
 }
 // Second stage. The phrase rules above describe sentence structures; a
 // narrative that simply names the behaviour in words they do not cover would
 // otherwise fall through to «other». One unambiguous term is enough; an
 // ordinary term needs a second, different one in the same sentence. Every
 // candidate passes exactly the same acceptance test as a phrase rule, so a
 // negated, hedged or fictional mention still adds nothing.
 const replacedByFound=new Set(events.flatMap(id=>specificTopics[id]?.replaces||[]));
 const weakHits=new Map();
 for(const [id,re,strength] of TERM_RULES){
  if(occurrences.has(id)||replacedByFound.has(id))continue;
  const matches=located(re).filter(m=>accepts(id,m));
  if(!matches.length)continue;
  if(strength==='strong'){events.push(id);occurrences.set(id,matches);eventEvidence[id]=quote(matches[0].index,matches[0][0].length);continue}
  // Two DIFFERENT ordinary terms, in the SAME sentence, or it is not evidence.
  const bySentence=new Map();
  for(const m of matches){
   const group=bySentence.get(m.sentenceStart)||{terms:new Set(),first:m};
   group.terms.add(m[0]);
   if(m.index<group.first.index)group.first=m;
   bySentence.set(m.sentenceStart,group);
  }
  const confirmed=[...bySentence.values()].filter(g=>g.terms.size>=2);
  if(confirmed.length)weakHits.set(id,confirmed.map(g=>g.first));
 }
 for(const [id,matches] of weakHits){
  if(occurrences.has(id))continue;
  events.push(id);occurrences.set(id,matches);eventEvidence[id]=quote(matches[0].index,matches[0][0].length);
 }
 // Prefer a specific numbered topic over its generic template only when every
 // generic occurrence is inside that topic's evidence. Separate episodes survive.
 const covered=(id,m)=>events.some(specific=>specificTopics[specific]?.replaces.includes(id)&&occurrences.get(specific).some(n=>n.index<=m.index&&n.index+n[0].length>=m.index+m[0].length));
 const selected=events.filter(id=>!occurrences.get(id).every(m=>covered(id,m)));
 for(const id of selected){
  const match=occurrences.get(id).find(m=>!covered(id,m));
  eventEvidence[id]=quote(match.index,match[0].length);localEventOffsets[id]=from(match.index);
 }
 // A theft, told apart by where it happened. Each reported theft is read from
 // its own SENTENCE, not the whole account: a burglary and a car stolen the
 // next day are two thefts, and each keeps its own label and quote. The
 // vehicle wins inside one sentence — «موتورم را از پارکینگ خانه بردند» is a
 // vehicle theft that happened at home.
 const ti=selected.indexOf('theft');
 if(ti>=0){
  // Bounded on the left: «تلویزیون» ends in «ون» (van).
  const carRx=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+VEHICLE+')','u');
  const homeRx=/(?:^|\s)(?:خانه|خونه|منزل|اپارتمان|ویلا|واحد\s+مسکونی|حیاط|پشت\s*بام|انباری\s+خانه)/u;
  const kindOf=m=>carRx.test(m.sentence||'')?'vehicle_theft':homeRx.test(m.sentence||'')?'home_burglary':'theft';
  const groups=new Map();
  for(const m of occurrences.get('theft').filter(x=>!covered('theft',x)))groups.set(kindOf(m),[...(groups.get(kindOf(m))||[]),m]);
  if(groups.size&&!(groups.size===1&&groups.has('theft'))){
   const kinds=[...groups.keys()].filter(k=>k==='theft'||!selected.includes(k));
   selected.splice(ti,1,...kinds);
   const e=events.indexOf('theft');if(e>=0)events.splice(e,1,...kinds.filter(k=>!events.includes(k)||k==='theft'));
   const theftEvidence=eventEvidence.theft,theftOffset=localEventOffsets.theft;
   if(!groups.has('theft')){delete eventEvidence.theft;delete localEventOffsets.theft}
   for(const k of kinds){const first=groups.get(k)[0];occurrences.set(k,groups.get(k));eventEvidence[k]=quote(first.index,first[0].length);localEventOffsets[k]=from(first.index)}
   void theftEvidence;void theftOffset;
  }
 }
 // A narrower label replaces the general one it is a kind of, when both come
 // from the same sentence: «کارمند شهرداری رشوه خواست» is one bribe, not a
 // bribe plus a separate complaint about the municipality. In different
 // sentences they are different things and both stay.
 const NARROWS={bribery:['official_complaint','pdf_b22'],dereliction:['official_complaint'],corrupt_network:['official_complaint'],
  abuse_of_office:['official_complaint','impersonation'],embezzlement:['financial_complaint'],
  investment_fraud:['fraud','financial_complaint'],online_fraud_scam:['fraud','financial_complaint'],
  phishing_banking:['fraud','data_breach','cyber_attack'],cyber_hacking:['cyber_attack','data_breach'],
  armed_robbery:['theft','vehicle_theft','home_burglary'],violent_theft:['theft'],pickpocketing:['theft'],
  thugs_and_hoodlums:['assault','harassment'],narcotics_distribution:['drug_supply'],drug_den:['drug_use'],
  hit_and_run:['accident'],cyber_attack:['data_breach'],dangerous_instruction:['pdf_a13','online_harm','explosion','hazardous_supply'],identity_misuse:['impersonation']};
 for(const [narrow,generals] of Object.entries(NARROWS)){
  if(!selected.includes(narrow))continue;
  const where=new Set(occurrences.get(narrow).map(m=>m.sentenceStart));
  for(const g of generals){
   const gi=selected.indexOf(g);if(gi<0)continue;
   if(occurrences.get(g).every(m=>where.has(m.sentenceStart))){selected.splice(gi,1);delete eventEvidence[g];delete localEventOffsets[g]}
  }
 }
 let cursor=0;const spans=incidentClauses(src).map(value=>{const start=src.indexOf(value,cursor);cursor=start+value.length;return {value,start,end:cursor}});
 const localEpisodes=selected.flatMap(event=>occurrences.get(event).filter(m=>!covered(event,m)).map(m=>{
  const start=from(m.index),end=upto(m.index+m[0].length-1)+1;
  return {event,evidence:spans.find(p=>p.start<=start&&p.end>=end)?.value||src.slice(start,end)};
 })).filter((e,i,all)=>all.findIndex(p=>p.event===e.event&&p.evidence===e.evidence)===i);
 // Enhanced Time Extraction with 24-hour conversion & word numerals
 const dayMatch = s.match(/(?:امروز|دیروز|دیشب|شب گذشته|روز گذشته|پریروز|صبح امروز|امشب|هفته گذشته|هفته پیش|ماه گذشته)/u);
 const day = dayMatch ? quote(dayMatch.index, dayMatch[0].length) : '';
 
 const toEnDigits = str => str ? str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)) : '';
 const PERSIAN_NUMBER_WORDS = {
  'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6,
  'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10, 'یازده': 11, 'دوازده': 12,
  'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17,
  'هجده': 18, 'نوزده': 19, 'بیست': 20, 'بیست و یک': 21, 'بیست و دو': 22,
  'بیست و سه': 23, 'بیست و چهار': 24
 };
 const WORD_NUMERALS_RX = 'بیست و چهار|بیست و سه|بیست و دو|بیست و یک|چهارده|پانزده|شانزده|دوازده|یازده|سیزده|هفده|هجده|نوزده|بیست|چهار|هشت|هفت|پنج|شیش|شش|یک|دو|سه|نه|ده';
 
 let timeQuote = '';
 const colonM = s.match(/ساعت\s*([۰-۹\d]{1,2}):([۰-۹\d]{2})/u);
 if (colonM) {
  const h = parseInt(toEnDigits(colonM[1]), 10);
  const m = toEnDigits(colonM[2]);
  const formattedClock = `ساعت ${h}:${m}`;
  timeQuote = day ? `${day}، ${formattedClock}` : formattedClock;
 } else {
  const fullRe = new RegExp('(?:ساعت\\s+)([۰-۹\\d]{1,2}|' + WORD_NUMERALS_RX + ')(?:\\s+و\\s+(نیم|ربع|[\\d۰-۹]{1,2}\\s+دقیقه))?(?:\\s+(ظهر|شب|عصر|غروب|صبح|بامداد|بعد\\s+از\\s+ظهر|بعدازظهر|نیمه\\s+شب|سر\\s+شب))?', 'u');
  const periodFirstRe = new RegExp('([۰-۹\\d]{1,2}|' + WORD_NUMERALS_RX + ')(?:\\s+و\\s+(نیم|ربع|[\\d۰-۹]{1,2}\\s+دقیقه))?\\s+(ظهر|شب|عصر|غروب|صبح|بامداد|بعد\\s+از\\s+ظهر|بعدازظهر|نیمه\\s+شب|سر\\s+شب)', 'u');
  const m = s.match(fullRe) || s.match(periodFirstRe);

  if (m) {
   const rawH = m[1];
   let hour = PERSIAN_NUMBER_WORDS[rawH] !== undefined ? PERSIAN_NUMBER_WORDS[rawH] : parseInt(toEnDigits(rawH), 10);
   if (!isNaN(hour)) {
    let min = '';
    const rawMin = m[2];
    if (rawMin) {
     if (rawMin.includes('نیم')) min = '30';
     else if (rawMin.includes('ربع')) min = '15';
     else {
      const d = rawMin.match(/[\d۰-۹]+/);
      if (d) min = toEnDigits(d[0]).padStart(2, '0');
     }
    }
    const period = (m[3] || '').trim();
    let formattedClock = '';
    if (/شب|عصر|غروب|بعد\s*از\s*ظهر|بعدازظهر/.test(period)) {
     if (hour < 12) hour += 12;
     else if (hour === 12 && /شب|نیمه\s*شب/.test(period)) hour = 0;
     formattedClock = `ساعت ${hour}${min ? ':' + min : ''}`;
    } else if (/ظهر/.test(period)) {
     if (hour < 11 && hour > 0) hour += 12;
     formattedClock = `ساعت ${hour}${min ? ':' + min : ''} (ظهر)`;
    } else if (/صبح|بامداد/.test(period)) {
     formattedClock = `ساعت ${hour}${min ? ':' + min : ''} (صبح)`;
    } else {
     formattedClock = `ساعت ${hour}${min ? ':' + min : ''}`;
    }
    timeQuote = day ? `${day}، ${formattedClock}` : formattedClock;
   } else if (day) {
    timeQuote = day;
   }
  } else if (day) {
   timeQuote = day;
  }
 }

 // Detect whether the primary incident occurred in online / cyber space
 const hasCyberEvent = selected.some(e => ['online_fraud_scam','phishing_banking','cyber_hacking','cyber_blackmail','reputation_damage','false_rumors_cyber','online_harm','data_breach','cyber_attack','identity_misuse'].includes(e));
 const hasExplicitOnlineTx = /(?:فروشگاه\s+اینترنتی|خرید\s+اینترنتی|خرید\s+انلاین|درگاه\s+پرداخت|درگاه\s+بانکی|فیشینگ|هک\s+حساب|لینک\s+جعلی|پیج\s+فروشگاهی)/u.test(s);
 const hasOnlyVirtualSighting = /(?:اینو|این\s+را|این\s+مورد\s+را)?\s*(?:در|تو|توی)\s+فضای\s+مجازی\s+دیدم/u.test(s) && !hasExplicitOnlineTx && !hasCyberEvent;
 const isOnline = !hasOnlyVirtualSighting && (hasCyberEvent || hasExplicitOnlineTx || /(?:سایت|وب\s*سایت|پیج|اینستاگرام|اینستا|تلگرام|واتساپ|ایتا|روبیکا|بله|دیوار|شیپور|اکانت|حساب\s+کاربری)/u.test(s));

 // Enhanced Compound & Multi-Part Place Extraction
 const COMPOUND_TAIL = '(?:آباد|اباد|نو|مرکزی|شمالی|جنوبی|شرقی|غربی|قدیم|جدید|اول|دوم|سوم|چهارم|پنجم|پارس|ری|خندان|تیر|قلهک|پونک|ونک|صادقیه|اکباتان|تهرانپارس|یافت|حسن|عباس|احمد|خانی|جنت|سعادت|یوسف|شمس|نازی|دولت|شهرک|فرش)';
 const PLACE_PREFIX = '(?:خیابان|کوچه|میدان|بلوار|بزرگراه|اتوبان|محله|شهرک|روستای|روستا|جاده|پاساژ|بازار|ایستگاه|پارک|ترمینال|فرودگاه|تقاطع|چهارراه)';
 const compoundRe = new RegExp(PLACE_PREFIX + '\\s+(?:شهید\\s+|امام\\s+|دکتر\\s+|سردار\\s+|آیت\\s*الله\\s+)?[^\\s،,.؛!؟]+(?:\\s+' + COMPOUND_TAIL + ')?', 'u');
 const placeMatch = s.match(compoundRe);
 let placeQuote = placeMatch ? quote(placeMatch.index, placeMatch[0].length).trim() : '';

 // Additional physical locations such as "پارکی نزدیک فرمانیه" or "زیر زمین شهرفرش"
 const extraPlaces = [];
 const relParkMatch = s.match(/(?:پارکی?|بوستانی?|باغی?)\s+(?:در\s+|نزدیک\s+|حوالی\s+|روبروی\s+|جنب\s+)[^\s،.؛!؟]+/u);
 if (relParkMatch) {
  extraPlaces.push(quote(relParkMatch.index, relParkMatch[0].length).trim());
 }
 const subPlaceMatches = [...s.matchAll(/(?:زیر\s*زمین|طبقه\s+[^\s،.؛!؟]+|پاساژ|مجتمع)\s+[^\s،.؛!؟]+(?:\s+فرش)?/gu)];
 for (const sm of subPlaceMatches) {
  const val = quote(sm.index, sm[0].length).trim();
  if (val && !extraPlaces.includes(val)) extraPlaces.push(val);
 }
 if (extraPlaces.length > 0) {
  const allPlaces = [...new Set([placeQuote, ...extraPlaces].filter(Boolean))];
  placeQuote = allPlaces.join(' — ');
 }

 if (!placeQuote && isOnline) {
  const specificUrlOrHandle = src.match(/(?:@[A-Za-z0-9_.]{3,}|https?:\/\/[^\s،]+|[A-Za-z0-9-]+\.(?:ir|com|org|net)\b)/i);
  const namedPlatform = s.match(/(?:سایت|وب\s*سایت|پیج|صفحه|کانال|فروشگاه\s+اینترنتی)\s+(?!(?:یک|یه|این|آن|اون|جعلی|فیک|ناشناس|نامعتبر|مذکور|فروشگاهی|اینترنتی|انلاین|آنلاین|مجازی|در|که|و|با|را|به|از|خرید|خریدم|لباس|گوشی|کفش|کیف|لوازم|کالا|محصول|سفارش|پرداخت|واریز|دیدم|اشنا|آشنا|ثبت)(?=$|[\s،.؛!؟]))([^\s،.؛!؟]{3,})/u);
  if (specificUrlOrHandle) {
   placeQuote = specificUrlOrHandle[0].trim();
  } else if (namedPlatform) {
   placeQuote = quote(namedPlatform.index, namedPlatform[0].length).trim();
  }
 }

 // Explicit check for vague neighborhood like محله ما, محلمون, کوچه ما, کوچمون, خونمون, etc.
 const vagueStemRe = /(?:محله|محلم|کوچه|کوچ|خیابان|خیابون|شهرک|روستا|منزل|خونه|خون|ساختمان|ساختمون|محل)(?:\s*ما|\s*مون|مون|\s*مان|مان)(?=$|[\s،.؛!؟])/u;
 const isVagueNeighborhood = vagueStemRe.test(s) || vagueStemRe.test(placeQuote);
 if (isVagueNeighborhood || /محله\s*ما|کوچه\s*ما|خیابان\s*ما|محلمون|کوچمون/u.test(placeQuote)) {
  placeQuote = '';
 }

 // People Count (e.g., "مجموع افراد 5 نفر" or "سه نفر زن و مرد")
 const countMatch = s.match(/(?:مجموع\s+افراد(?:[^\n،.؛!؟]+)?|تعداد\s+افراد|حضور)\s*([\d۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|چند)\s*نفر/u);
 const generalCountMatch = !countMatch ? s.match(/([\d۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|چند)\s*نفر(?:\s+(?:زن\s+و\s+مرد|مرد|زن|جوان|موتورسوار|مسلح))?/u) : null;
 const peopleCountQuote = countMatch
  ? `${countMatch[1]} نفر`
  : generalCountMatch
  ? quote(generalCountMatch.index, generalCountMatch[0].length).trim()
  : '';

 // Actor / Initiator / Named Suspects with Aliases (ملقب به)
 let actorQuote = '';
 const initiatorMatch = s.match(/به\s+جز\s+([^،.؛!؟]+?)\s+که\s+(?:شروع\s*کننده|عامل|ضارب|سارق)/u);
 const aliasMatches = [...s.matchAll(/([آ-ی]{2,}\s+[آ-ی]{2,})\s+ملقب\s+به\s+([آ-ی]{2,}(?:\s+طلا)?)/gu)];
 if (initiatorMatch) {
  actorQuote = `${initiatorMatch[1].trim()} (شروع‌کننده نزاع)`;
 } else if (aliasMatches.length > 0) {
  actorQuote = aliasMatches.map(m => `${m[1].trim()} (ملقب به ${m[2].trim()})`).join(' ، ');
 } else {
  const directActor = s.match(/(?:شروع\s*کننده(?:ی)?\s*(?:نزاع|درگیری|حادثه)?|عامل اصلی|ضارب|سارق|مشخصات\s+(?:متهمان|سارقان|ضاربان|عاملان|متخلفان))\s*[:؛-]?\s*([^،.؛!؟\n]+)/u);
  if (directActor) actorQuote = directActor[1].trim();
 }

 // Physical Appearance of Suspects (موهای بلند، تتو، خالکوبی، لنگ زدن، جراحت، لباس و ...)
 const appearanceQuote = extractAppearanceFromText(src);

 // Victim / Affected party info
 let victimQuote = '';
 const victimM = s.match(/به\s+((?:دو\s*تا|یک|دو|سه|چند)\s+(?:بچه|کودک|نوجوان|نفر|زن|مرد|پسر|دختر))/u);
 if (victimM) {
  victimQuote = quote(victimM.index + 3, victimM[1].length).trim();
  if (/از\s+(?:بچه\s*ها|کودکان|قربانیان|آسیب\s*دیدگان)\s+مشخصاتی?\s+ندارم/u.test(s)) {
   victimQuote += ' (فاقد مشخصات هویتی طبق اظهار گزارش‌دهنده)';
  }
 }

 // Extracted Details (What item/incident) & Method (How) & Secondary Info
 let detailsQuote = '';
 let methodQuote = '';
 let otherInfoQuote = '';

 const onlinePurchaseItem = s.match(/از\s+(?:یک\s+|یه\s+)?فروشگاه\s+اینترنتی\s+([^\n،.؛!؟]{2,35}?)\s+(?:خریدم|خریدیم|خرید\s+کردم|سفارش\s+دادم)/u);
 if (onlinePurchaseItem) {
  const item = onlinePurchaseItem[1].trim();
  const blocked = /بلاکم?\s+کرد|مسدودم?\s+کرد/u.test(s);
  const notSent = /ارسال\s+نشد|ارسال\s+نکرد|نفرستاد/u.test(s);
  detailsQuote = `خرید اینترنتی (${item})${notSent ? ' — عدم ارسال کالا' : ''}${blocked ? ' و مسدود کردن خریدار پس از پرداخت' : ''}`;
 }

 if (/بعد\s+از\s+پرداخت\s+بلاکم?\s+کرد/u.test(s)) {
  methodQuote = 'دریافت وجه و مسدود کردن (بلاک) خریدار پس از پرداخت';
 } else if (/کارت\s+به\s+کارت/u.test(s)) {
  methodQuote = 'انتقال وجه کارت به کارت';
 }

 const extraNotes = [];
 if (/باند\s+(?:تولید\s+و\s+)?پخش\s+مواد\s+مخدر/u.test(s)) {
  extraNotes.push('فعالیت در باند تولید و پخش مواد مخدر');
 }
 if (/فروش\s+مشروبات\s+الکلی/u.test(s)) {
  extraNotes.push('فروش مشروبات الکلی در محل کسب');
 }
 if (/(?:هر\s*ی?\s*چی|هرچه)\s+(?:هم\s+)?به\s+پلیس\s+فتا\s+گزارش\s+می\s*کنم\s+پیگیری\s+نمی\s*شه/u.test(s)) {
  extraNotes.push('عدم پیگیری گزارش قبلی در پلیس فتا (طبق اظهار گزارش‌دهنده)');
 }
 if (extraNotes.length > 0) {
  otherInfoQuote = extraNotes.join(' ، ');
 }

 // Reason
 let reasonQuote = '';
 const reasonM = s.match(/علت\s+(?:نزاع|درگیری|حادثه|اتفاق|حادثه|ماجرا|قضیه)?\s*(?:هم|نیز)?\s*[:؛-]?\s*([^\s،.؛!؟]+(?:\s+[^\s،.؛!؟]+){0,3}?)(?=\s+(?:بود|شد|است|می‌باشد|میباشد)|[،.؛!؟\n]|$)/u);
 if (reasonM) {
  reasonQuote = reasonM[1].trim().replace(/\s+(?:بود|شد|است|می‌باشد|میباشد)$/u, '').trim();
 }

 // Lack of information about other individuals
 const lackOfOtherDetails = /(?:از\s+هیچکدام|از\s+بقیه|از\s+سایرین|از\s+دیگران|از\s+بچه\s*ها)\s*(?:مشخصات|اطلاعات)?\s*(?:خاصی|دیگری)?\s*ندارم|نمی\s*شناسم|نشناختم/u.test(s);

 const HEARD='(?:به\\s+من\\s+گفت(?:ند|ه)?|بهم\\s+گفت(?:ن|ند)?|برایم\\s+تعریف\\s+کرد(?:ند)?|برام\\s+تعریف\\s+کرد(?:ن)?|خبر\\s+داد(?:ند|ن)?|تعریف\\s+کرد(?:ند|ن)?|شنیدم)';
 const heard=s.match(new RegExp('(?<=(?:^|[،,.؛!؟\\n])\\s*)[^،,.؛!؟\\n]{0,60}?'+HEARD,'u'))||s.match(new RegExp(HEARD,'u'));
 const saw=s.match(/(?:خودم\s+(?:دیدم|شاهد\s+بودم)|با\s+چشم\s+خودم\s+دیدم|شاهد\s+بودم|جلوی\s+چشمم)/u);
 const online=s.match(/(?:در|تو|توی)\s+(?:اینستاگرام|اینستا|تلگرام|واتساپ|ایتا|روبیکا|بله|کانال|صفحه|فضای\s+مجازی)\S*\s+(?:\S+\s+){0,2}(?:دیدم|خواندم|خوندم)/u);
 const firstPersonVictim=/(?:خریدم|خریدیم|خرید\s+کردم|سفارش\s+دادم|پرداخت\s+کردم|پرداختم|واریز\s+کردم|بلاکم\s+کرد|مسدودم\s+کرد|کارت\s+کشیدم|ثبت\s*نام\s+کردم|کلیک\s+کردم|برگشتم|پارک\s+کرده?\s+بودم|متوجه\s+شدم|به\s+من\s+حمله|با\s+من\s+درگیر|از\s+من\s+(?:سرقت|دزدی|اخاذی|کلاهبرداری|گرفتند|بردند|قاپیدند)|سرم\s+کلاه|کیفم|گوشیم|موبایلم|ماشینم|خودرویم|خودروم|موتورم|دوچرخه\s*ام|حسابم|کارتم|پولم|طلایم|طلاهام|خانه\s*ام|خونم|منزلم|مغازه\s*ام|شرکتم|لباسم|ساعتم|مدارکم|بهم\s+زد|به\s+ماشینم\s+زد|مزاحمم\s+شد|تهدیدم\s+کرد|فحشم\s+داد)/u.test(s);

 // Detect conflicting sources (e.g., user says BOTH "خودم دیدم" AND "توی فضای مجازی دیدم" / "شنیدم")
 const sourceConflict = Boolean((saw && online) || (saw && heard));
 const sourceHit = heard || online || saw;
 const sourceQuote = sourceConflict
  ? 'نیاز به شفاف‌سازی: هم «مشاهده مستقیم (خودم دیدم)» و هم «دیدن در فضای مجازی / شنیده‌ها» ذکر شده است'
  : sourceHit
  ? quote(sourceHit.index, sourceHit[0].length).trim()
  : firstPersonVictim
  ? 'برای خودم اتفاق افتاده'
  : '';

 const known = {
  time: timeQuote,
  place: placeQuote,
  vaguePlace: isVagueNeighborhood,
  isOnline,
  source: sourceQuote,
  sourceConflict,
  peopleCount: peopleCountQuote,
  actor: actorQuote,
  appearance: appearanceQuote,
  victim: victimQuote,
  details: detailsQuote,
  method: methodQuote,
  reason: reasonQuote,
  otherInfo: otherInfoQuote,
  otherPeople: lackOfOtherDetails ? 'مشخصات خاصی ندارد (طبق گفته کاربر)' : '',
  lackOfOtherDetails,
 };

 return normalizeAnalysis({eventEvidence,localEventOffsets,localEpisodes,events:selected.length?selected:['other'],known,categories:inferCategories(s,selected.length?selected:['other']),followups:mentionedFollowups(s),mode:'preview'},text);
}
