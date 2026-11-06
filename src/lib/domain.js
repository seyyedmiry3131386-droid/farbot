import {categoryForSection,sectionRequired,sectionRelevant} from './question-bank.js';
import {YES,NO,relevantExtraIds} from './details.js';
import {EVENTS,localAnalysis,eventIds,detailId,extractEntitiesFromNarrative,extractAppearanceFromText,normalizeAnalysis} from './scenarios.js';
export {EVENTS,localAnalysis,normalize,normalizeAnalysis,eventIds,detailId,extractEntitiesFromNarrative,extractAppearanceFromText} from './scenarios.js';

// The 7 mandatory stages in strict order:
// 1. نحوه اطلاع (source)
// 2. چه کسی - فاعل (who/person)
// 3. چه زمانی (when/time)
// 4. چه مکانی (where/place)
// 5. چه چیزی (what/details/object)
// 6. چرا (why/reason)
// 7. چگونه (how/method/vehicle)
const STAGE_ORDER = {
  source: 1,
  person: 2,
  who: 2,
  time: 3,
  when: 3,
  place: 4,
  where: 4,
  details: 5,
  clarify: 5,
  object: 5,
  reason: 6,
  why: 6,
  method: 7,
  how: 7,
  vehicle: 7,
  contact: 7,
};

export function getQuestionStage(id) {
  if (id.startsWith('details_')) return 5;
  if (id.startsWith('custom_')) return 5;
  return STAGE_ORDER[id] || 5;
}

export function stripQuestionPrefix(title) {
  if (!title) return '';
  return title.replace(/^(نحوه اطلاع|چه کسی|چه زمانی|چه مکانی|چه چیزی|چرا|چگونه)\s*:\s*/, '').trim();
}

/**
 * هفت پارامتر حیاتی پرسش‌گری در ترتیب استاندارد (۱ تا ۷):
 * ۱. نحوه اطلاع (source)
 * ۲. فاعل / چه کسی (person)
 * ۳. زمان / چه زمانی (time)
 * ۴. مکان / چه مکانی (place)
 * ۵. چه چیزی (details)
 * ۶. چرا / علت و انگیزه (reason)
 * ۷. چگونه / روش و ابزار (method)
 */
export const VITAL_PARAMETERS = ['source', 'person', 'time', 'place', 'details', 'reason', 'method'];

/**
 * بانک کلمات کلیدی برای تشخیص ماهیت رخداد از روی متن و شواهد
 */
export const SCENARIO_KEYWORDS = {
  online_shopping:
    /(?:فروشگاه\s*اینترنتی|خرید\s*اینترنتی|خرید\s*آنلاین|خرید\s*انلاین|سفارش\s*(?:آنلاین|اینترنتی|کالا)|کالا\s*ارسال\s*نشد|ارسال\s*نکرد|فروشنده\s*(?:پاسخ|جواب)\s*نمی|بعد\s*از\s*پرداخت\s*بلاک|بلاکم?\s*کرد|بیعانه|پیج\s*فروشگاهی|درگاه\s*پرداخت)/u,
  cyber:
    /(?:فیشینگ|هک|دسترسی\s*غیرمجاز|برداشت\s*غیرمجاز|لینک\s*(?:جعلی|آلوده)|اکانت|حساب\s*کاربری|اینستاگرام|تلگرام|واتساپ|ایتا|روبیکا|بله|دیوار|شیپور|سایت|وب\s*سایت|پیج|کانال)/u,
  fraud:
    /(?:کلاهبرداری|فریب|جعل|پیش\s*فروش|وعده\s*سود|سرمایه\s*گذاری\s*جعلی|سفته|چک\s*برگشتی|مالباخته|اخاذی)/u,
  fight:
    /(?:نزاع|درگیری|دعوا|ضرب\s*و\s*جرح|کتک|چاقوکشی|قمه\s*کشی|اراذل|اوباش|اسیدپاشی|قتل|حمله\s*ور)/u,
  theft:
    /(?:سرقت|دزدی|سارق|دزد|ربودن|زورگیری|خفت\s*گیری|کیف\s*قاپی|جیب\s*بری|سرقت\s*مسلحانه)/u,
  narcotics:
    /(?:مواد\s*مخدر|روانگردان|شیشه|هروئین|تریاک|حشیش|گل|معتاد|پاتوق\s*مواد|ساقی|توزیع\s*مواد|تولید\s*و\s*پخش\s*مواد)/u,
  traffic:
    /(?:تصادف|سانحه\s*رانندگی|کورس|لایی\s*کشی|سرعت\s*غیرمجاز|پلاک\s*مخدوش|فرار\s*از\s*صحنه|واژگونی\s*خودرو)/u,
  weapon:
    /(?:تیراندازی|سلاح\s*گرم|کلانش|کلت|تفنگ|فشنگ|مواد\s*محترقه|مواد\s*منفجره|قدرت\s*نمایی\s*با\s*سلاح)/u,
  economic:
    /(?:احتکار|قاچاق|رشوه|اختلاس|فرار\s*مالیاتی|اخلال\s*در\s*بازار|تخلف\s*صنفی|گرانفروشی|انبار\s*احتکار)/u,
  service:
    /(?:آتش\s*سوزی|حریق|تخریب\s*اموال|خرابی|قطعی\s*برق|قطعی\s*آب|محیط\s*زیست|پسماند|سد\s*معبر)/u,
};

/**
 * بانک کلمات کلیدی برای بررسی پوشش هر یک از ۷ پارامتر حیاتی در متن گزارش کاربر
 */
export const STAGE_COVERAGE_KEYWORDS = {
  source:
    /(?:خودم\s+(?:دیدم|شاهد\s+بودم)|با\s+چشم\s+خودم\s+دیدم|شاهد\s+بودم|شنیدم|به\s+من\s+گفتند|در\s+فضای\s+مجازی\s+دیدم|توی?\s+فضای\s+مجازی\s+دیدم|خریدم|خریدیم|خرید\s+کردم|سفارش\s+دادم|پرداختم|پرداخت\s+کردم|واریز\s+کردم|بلاکم\s+کرد|مسدودم\s+کرد|کارت\s+کشیدم|ثبت\s*نام\s+کردم|کلیک\s+کردم|برگشتم|متوجه\s+شدم|به\s+من\s+حمله|با\s+من\s+درگیر|از\s+من\s+(?:سرقت|دزدی|اخاذی|کلاهبرداری|گرفتند|بردند)|سرم\s+کلاه|کیفم|گوشیم|موبایلم|ماشینم|خودرویم|موتورم|حسابم|کارتم|پولم|خانه\s*ام|منزلم|مغازه\s*ام)(?=$|[\s،.؛!؟])/u,
  directObservation:
    /(?:خودم\s+(?:دیدم|شاهد\s+بودم)|با\s+چشم\s+خودم\s+دیدم|شاهد\s+بودم|جلوی\s+چشمم)/u,
  indirectOrVirtualObservation:
    /(?:(?:در|تو|توی)\s+(?:فضای\s+مجازی|اینستاگرام|اینستا|تلگرام|واتساپ|کانال|صفحه)\s+(?:\S+\s+){0,2}دیدم|شنیدم|به\s+من\s+گفتند|بهم\s+گفتند)/u,
  person:
    /(?:(?:از\s+هیچکدام|از\s+بقیه|از\s+سایرین)\s*(?:مشخصات|اطلاعات)\s*(?:خاصی|دیگری)?\s*ندارم|سارق\s+ناشناس\s+بود|شروع\s*کننده\s+ناشناس\s+بود|فروشنده\s+ناشناس\s+است|ملقب\s+به\s+[آ-ی]{2,}|به\s+نام\s+[آ-ی]{2,}|صاحب\s+حساب\s+[آ-ی]{2,}|شماره\s+کارت\s*\d{12,16}|شماره\s+تماس\s*09\d{9})/u,
  time:
    /(?:امروز|دیروز|دیشب|پریروز|ساعت\s*(?:\d+|[۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده)|(?:\d+|[۰-۹]+)\s*روز\s*پیش|چند\s*روز\s*پیش|هفته\s*(?:پیش|گذشته)|ماه\s*(?:پیش|گذشته)|صبح\s*زود|حوالی\s*ظهر|بعد\s*از\s*ظهر|غروب|نیمه\s*شب|بامداد)(?=$|[\s،.؛!؟])/u,
  onlinePlace:
    /(?:اینستاگرام|تلگرام|واتساپ|دیوار|شیپور|ایتا|روبیکا|بله|دیجی\s*کالا|باسلام|@[a-zA-Z0-9_.]{3,}|https?:\/\/\S+|\b[a-zA-Z0-9-]+\.(?:ir|com|org|net|shop)\b|(?:سایت|پیج|کانال)\s+(?!(?:فروشگاهی|اینترنتی|معتبر|جعلی|ناشناس)(?=$|[\s،.؛!؟]))[آ-یa-zA-Z0-9_-]{3,})/u,
  physicalPlace:
    /(?:(?:محله|خیابان|بلوار|میدان|بزرگراه|اتوبان|چهارراه|تقاطع|شهرک|فلکه|پل|زیر\s*زمین)\s+(?!(?:ما|من|خودمان|خودم)(?=$|[\s،.؛!؟]))[آ-ی0-9۰-۹\s]{2,}|پارکی?\s+(?:در\s+|نزدیک\s+|حوالی\s+|روبروی\s+)[آ-ی0-9۰-۹\s]{2,})/u,
  vaguePlace:
    /(?:محله\s*ما|محله\s*من|محله\s*مون|محلمون|محله\s*مان|محله\s*خودمان|کوچه\s*ما|کوچه\s*مون|کوچمون|خیابان\s*ما)(?=$|[\s،.؛!؟])/u,
  reason:
    /(?:علت\s+(?:نزاع|درگیری|حادثه|اتفاق)|به\s+(?:دلیل|خاطر|علت)\s+[آ-ی]{3,}|انگیزه\s+[آ-ی]{3,}|سر\s+(?:اختلاف|مسائل\s+مالی|ملک|بدهی|پارک\s+خودرو)|ناموسی)(?=$|[\s،.؛!؟])/u,
  method:
    /(?:کارت\s*به\s*کارت|درگاه\s*پرداخت|لینک\s*پرداخت|شماره\s*شبا|پایا|ساتنا|بعد\s+از\s+پرداخت\s+بلاکم?\s+کرد|با\s+(?:سلاح\s*گرم|سلاح\s*سرد|قمه|چاقو|شمشیر|چوب|چماق|کلت|تفنگ|اسلحه)|تخریب\s*قفل|شکستن\s*قفل|شاه\s*کلید)(?=$|[\s،.؛!؟])/u,
};

/**
 * تشخیص ماهیت رخداد با ترکیب کدهای رویداد و بررسی کلمات کلیدی متن گزارش
 */
export function detectScenarioByKeywords(analysis = {}, extraText = '') {
  const ev = analysis?.event || 'other';
  const allEvents = Array.isArray(analysis?.events) ? analysis.events : [ev];
  const hasEvent = (list) => allEvents.some((e) => list.includes(e));

  const combinedText = [
    extraText || '',
    analysis?.title || '',
    analysis?.text || '',
    ...Object.values(analysis?.eventEvidence || {}),
  ]
    .join(' ')
    .replace(/\u200c/g, ' ');

  const isOnlineShopping =
    hasEvent(['online_fraud_scam']) ||
    SCENARIO_KEYWORDS.online_shopping.test(combinedText);

  const hasPhysicalLocation = STAGE_COVERAGE_KEYWORDS.physicalPlace.test(combinedText);
  const onlySawInSocialMedia =
    /(?:در|تو|توی)\s+فضای\s+مجازی\s+دیدم/u.test(combinedText) &&
    hasPhysicalLocation &&
    !isOnlineShopping;

  const isCyber =
    !onlySawInSocialMedia &&
    (isOnlineShopping ||
      Boolean(analysis?.known?.isOnline) ||
      hasEvent([
        'data_breach',
        'cyber_attack',
        'phishing_banking',
        'cyber_hacking',
        'online_fraud_scam',
        'cyber_blackmail',
        'reputation_damage',
        'false_rumors_cyber',
        'online_harm',
        'identity_misuse',
      ]) ||
      SCENARIO_KEYWORDS.cyber.test(combinedText));

  const isOnline = isOnlineShopping || isCyber;

  const isFraud =
    isOnline ||
    hasEvent([
      'fraud',
      'investment_fraud',
      'real_estate_fraud',
      'pyramid_scheme',
      'financial_complaint',
    ]) ||
    SCENARIO_KEYWORDS.fraud.test(combinedText);

  const isFight =
    !isOnline &&
    (hasEvent([
      'assault',
      'street_brawl',
      'knife_brawl',
      'thugs_and_hoodlums',
      'homicide',
      'acid_attack',
      'pdf_a03',
    ]) ||
      SCENARIO_KEYWORDS.fight.test(combinedText));

  const isTheft =
    !isOnline &&
    (hasEvent([
      'theft',
      'home_burglary',
      'vehicle_theft',
      'armed_robbery',
      'violent_theft',
      'pickpocketing',
      'stolen_goods',
      'pdf_a09',
      'pdf_b16',
    ]) ||
      SCENARIO_KEYWORDS.theft.test(combinedText));

  const isNarcotics =
    !isOnline &&
    (hasEvent([
      'drug_supply',
      'drug_use',
      'narcotics_trafficking',
      'narcotics_distribution',
      'narcotics_lab',
      'drug_den',
    ]) ||
      SCENARIO_KEYWORDS.narcotics.test(combinedText));

  const isTraffic =
    !isOnline &&
    (hasEvent([
      'accident',
      'hit_and_run',
      'reckless_racing',
      'tampered_plates',
      'traffic_violation',
      'vehicle_irregularity',
    ]) ||
      SCENARIO_KEYWORDS.traffic.test(combinedText));

  const isWeapon =
    !isOnline &&
    (hasEvent([
      'illegal_firearms',
      'illegal_shooting',
      'shooting',
      'weapon_threat',
      'explosives_fireworks',
      'fireworks',
    ]) ||
      SCENARIO_KEYWORDS.weapon.test(combinedText));

  const isEconomic =
    !isOnlineShopping &&
    (hasEvent([
      'goods_smuggling',
      'hoarding_monopoly',
      'currency_market_disruption',
      'tax_evasion_bribery',
      'bribery',
      'embezzlement',
      'corrupt_network',
      'official_complaint',
      'dereliction',
      'abuse_of_office',
    ]) ||
      SCENARIO_KEYWORDS.economic.test(combinedText));

  const isService =
    !isOnline &&
    (hasEvent([
      'service',
      'property_vandalism',
      'damage',
      'fire',
      'environment',
      'disaster',
    ]) ||
      SCENARIO_KEYWORDS.service.test(combinedText));

  return {
    isOnline,
    isOnlineShopping: isOnlineShopping || (isOnline && hasEvent(['fraud', 'financial_complaint', 'other'])),
    isCyber,
    isFraud,
    isFight,
    isTheft,
    isNarcotics,
    isTraffic,
    isWeapon,
    isEconomic,
    isService,
  };
}

export function isOnlineIncident(analysis = {}) {
  return detectScenarioByKeywords(analysis).isOnline;
}

/**
 * بررسی تناقض در نحوه اطلاع (مثلاً کاربر هم گفته «خودم دیدم» و هم گفته «توی فضای مجازی دیدم»)
 */
export function hasConflictingSource(text = '', known = {}) {
  if (known?.sourceConflict) return true;
  const normalized = String(text || '').replace(/\u200c/g, ' ');
  return (
    STAGE_COVERAGE_KEYWORDS.directObservation.test(normalized) &&
    STAGE_COVERAGE_KEYWORDS.indirectOrVirtualObservation.test(normalized)
  );
}

/**
 * بررسی مبتنی بر کلمات کلیدی و یافته‌های مستخرج برای تشخیص اینکه آیا یک پارامتر حیاتی قبلاً پاسخ داده شده است یا خیر
 */
export function isParameterCoveredByKeywords(paramId, text = '', known = {}, isOnline = false) {
  const normalized = String(text || '').replace(/\u200c/g, ' ');
  const id = String(paramId || '').toLowerCase();

  if (id === 'source' || id === '1') {
    // اگر کاربر همزمان هم «خودم دیدم» و هم «در فضای مجازی دیدم / شنیدم» گفته باشد، باید سوال شفاف‌سازی پرسیده شود
    if (hasConflictingSource(normalized, known)) {
      return false;
    }
    return (
      Boolean(known?.source && String(known.source).trim().length > 2) ||
      STAGE_COVERAGE_KEYWORDS.source.test(normalized)
    );
  }

  if (id === 'person' || id === 'who' || id === 'actor' || id === '2') {
    return (
      Boolean(known?.actor && String(known.actor).trim().length > 1) ||
      Boolean(known?.lackOfOtherDetails) ||
      STAGE_COVERAGE_KEYWORDS.person.test(normalized)
    );
  }

  if (id === 'time' || id === 'when' || id === '3') {
    return (
      Boolean(known?.time && String(known.time).trim().length > 1) ||
      STAGE_COVERAGE_KEYWORDS.time.test(normalized)
    );
  }

  if (id === 'place' || id === 'where' || id === 'location' || id === '4') {
    if (known?.vaguePlace || STAGE_COVERAGE_KEYWORDS.vaguePlace.test(normalized)) {
      return false;
    }
    if (known?.place && String(known.place).trim().length > 1) {
      return true;
    }
    return isOnline
      ? STAGE_COVERAGE_KEYWORDS.onlinePlace.test(normalized)
      : STAGE_COVERAGE_KEYWORDS.physicalPlace.test(normalized);
  }

  if (id === 'details' || id === 'what' || id === '5') {
    return Boolean(known?.details && String(known.details).trim().length > 3);
  }

  if (id === 'reason' || id === 'why' || id === 'cause' || id === '6') {
    return (
      Boolean(known?.reason && String(known.reason).trim().length > 1) ||
      STAGE_COVERAGE_KEYWORDS.reason.test(normalized)
    );
  }

  if (id === 'method' || id === 'how' || id === '7') {
    return (
      Boolean(known?.method && String(known.method).trim().length > 1) ||
      STAGE_COVERAGE_KEYWORDS.method.test(normalized)
    );
  }

  return false;
}

export function questionsFor(analysis = {}) {
  const ev = analysis.event || 'other';
  const scenario = detectScenarioByKeywords(analysis);
  const {
    isOnline,
    isOnlineShopping,
    isCyber,
    isFraud,
    isFight,
    isTheft,
    isNarcotics,
    isTraffic,
    isWeapon,
    isEconomic,
    isService,
  } = scenario;

  const combinedText = [
    analysis?.text || '',
    ...Object.values(analysis?.eventEvidence || {}),
  ]
    .join(' ')
    .replace(/\u200c/g, ' ');
  const hasVaguePlace =
    Boolean(analysis.known?.vaguePlace) ||
    STAGE_COVERAGE_KEYWORDS.vaguePlace.test(combinedText);
  const sourceConflict = hasConflictingSource(combinedText, analysis.known);

  const base = {
    // ۱. نحوه اطلاع (source)
    source: {
      id: 'source',
      stage: 1,
      title: sourceConflict
        ? 'در گزارش هم به «مشاهده مستقیم (خودم دیدم)» و هم به «دیدن در فضای مجازی» اشاره کرده‌اید؛ منظور اصلی شما کدام بوده است؟'
        : isOnlineShopping
        ? 'چگونه از این تخلف یا کلاهبرداری اینترنتی مطلع شدید؟'
        : isOnline
        ? 'چگونه متوجه این رخداد در فضای مجازی شدید؟'
        : 'نحوه اطلاع شما از این رویداد چگونه بوده است؟',
      hint: sourceConflict
        ? 'مشخص فرمایید کدام بخش از رخداد را شخصاً از نزدیک دیده‌اید و کدام بخش را در فضای مجازی مشاهده کرده‌اید.'
        : isOnline
        ? 'مشخص کنید آیا این اتفاق مستقیماً برای خودتان رخ داده یا در فضای مجازی مشاهده کرده‌اید.'
        : 'مشاهدهٔ مستقیم را از شنیده‌ها، تماس‌ها و پیام‌ها جدا کنید.',
      placeholder: sourceConflict
        ? 'توضیح دهید کدام بخش را مستقیماً دیدید و کدام را در فضای مجازی…'
        : 'نحوهٔ اطلاع خود را توضیح دهید…',
      options: sourceConflict
        ? [
            'وقوع اصلی حادثه را خودم از نزدیک دیدم و بخش دیگر را در فضای مجازی دیدم',
            'کل ماجرا را خودم مستقیماً از نزدیک مشاهده کردم',
            'کل موضوع را در فضای مجازی دیدم و حضوری شاهد نبودم',
            'بخشی را خودم دیدم و بخشی را از دیگران شنیدم',
          ]
        : isOnline
        ? ['برای خودم اتفاق افتاد', 'در فضای مجازی دیدم', 'از شخص دیگری شنیدم', 'خودم شاهد بودم']
        : ['خودم شاهد بودم', 'برای خودم اتفاق افتاد', 'از شخص دیگری شنیدم', 'در فضای مجازی دیدم'],
    },

    // ۲. چه کسی / فاعل (person)
    person: {
      id: 'person',
      stage: 2,
      title: isOnlineShopping
        ? 'درباره فروشنده، صاحب حساب یا گرداننده صفحه چه مشخصاتی (نام، شماره تماس یا شماره کارت) دارید؟'
        : isCyber
        ? 'درباره فرد متخلف، گرداننده صفحه، فرستنده لینک یا صاحب حساب مقصد چه اطلاعاتی دارید؟'
        : isFraud
        ? 'طرف مقابل یا فرد کلاهبردار چه مشخصات، نام، شماره تماس یا عنوانی داشت؟'
        : isFight
        ? 'شروع‌کننده درگیری چه کسی بود و چه کسانی در آن شرکت داشتند؟'
        : isTheft
        ? 'سارق یا عاملان سرقت چه کسانی بودند و چه مشخصاتی داشتند؟'
        : isNarcotics
        ? 'توزیع‌کننده یا افراد مرتبط با مواد مخدر چه مشخصاتی دارند؟'
        : isTraffic
        ? 'راننده یا سرنشینان خودروی متخلف چه مشخصاتی داشتند؟'
        : isWeapon
        ? 'فرد یا افراد حامل سلاح یا تیرانداز چه مشخصاتی داشتند؟'
        : isEconomic
        ? 'فرد، مسئول یا واحد صنفی متخلف چه نام و سمتی دارد؟'
        : 'از افراد مرتبط با این اتفاق یا فاعل آن چه می‌دانید؟',
      hint: isOnline
        ? 'نام صاحب حساب، آیدی صفحه، شماره تماس یا شماره کارت دریافت‌کننده وجه را در صورت اطلاع بنویسید.'
        : 'در صورت اطلاع، نام، تعداد، مشخصات ظاهری یا نقش افراد را بنویسید؛ حدس نزنید.',
      placeholder: isOnline
        ? 'نام صاحب حساب، آیدی، شماره کارت یا شماره تماس فروشنده…'
        : 'مشخصات، نام یا ظاهر افراد مرتبط…',
      options: isOnline
        ? [
            'فروشنده یا ادمین ناشناس است',
            'نام صاحب حساب بانکی را دارم',
            'شماره تماس یا آیدی فروشنده را دارم',
            'چند نفر همدست بودند',
          ]
        : isFraud
        ? ['نام و مشخصات طرف مقابل را دارم', 'شماره تماس و شماره حساب را دارم', 'با هویت جعلی معرفی شد', 'چند نفر همدست بودند']
        : isFight
        ? ['شروع‌کننده ناشناس بود', 'افراد از قبل آشنا بودند', 'یک نفر بود', 'چند نفر بودند']
        : isTheft
        ? ['سارق ناشناس بود', 'یک نفر بود', 'دو یا چند نفر بودند', 'سارق با موتورسیکلت یا خودرو بود']
        : isTraffic
        ? ['راننده متواری شد', 'یک نفر راننده مرد بود', 'چند سرنشین جوان بودند', 'راننده را ندیدم']
        : isNarcotics
        ? ['یک نفر توزیع‌کننده محلی', 'چند نفر در پاتوق', 'مشخصات ظاهری و لباس را می‌دانم', 'هویت دقیق را نمی‌دانم']
        : ['فرد یا شروع‌کننده ناشناس بود', 'افراد از قبل آشنا بودند', 'یک نفر بود', 'چند نفر بودند'],
    },

    // ۳. چه زمانی (time)
    time: {
      id: 'time',
      stage: 3,
      title: isOnlineShopping
        ? 'این خرید یا پرداخت اینترنتی در چه تاریخ و ساعتی انجام شد؟'
        : isCyber
        ? 'این رخداد سایبری یا برداشت غیرمجاز در چه تاریخ و ساعتی اتفاق افتاد؟'
        : isFraud
        ? 'این معامله یا پرداخت وجه در چه تاریخ و زمانی انجام شد؟'
        : 'این اتفاق چه زمانی و در چه ساعتی رخ داد؟',
      hint: isOnline
        ? 'تاریخ و ساعت تقریبی ثبت سفارش، واریز وجه یا وقوع رخداد سایبری را بنویسید.'
        : 'زمان تقریبی یا ساعت شبانه‌روز (ساعات شب به عنوان ساعت ۲۴ ساعته محاسبه می‌شوند).',
      placeholder: isOnline
        ? 'مثلاً: دیروز ساعت ۱۸ / سه روز پیش ساعت ۱۴'
        : 'مثلاً: امروز ساعت ۱۱ ظهر / دیروز ساعت ۲۳',
      options: isOnline
        ? ['امروز', 'دیروز', 'چند روز پیش', 'هفته گذشته', 'ماه گذشته']
        : ['امروز', 'دیروز', 'دیشب', 'صبح زود', 'حوالی ظهر', 'ساعات پایانی شب'],
    },

    // ۴. چه مکانی / کدام بستر (place) — هیچ‌گاه برای رخداد اینترنتی درباره «کدام خیابان یا محله» سوال نمی‌پرسد
    place: {
      id: 'place',
      stage: 4,
      title: isOnline
        ? 'نام یا نشانی دقیق فروشگاه اینترنتی، سایت، صفحه یا پیام‌رسان چیست؟'
        : hasVaguePlace
        ? 'نام محله و جزئیات آدرس چیست؟'
        : isTraffic
        ? 'این حادثه یا تخلف دقیقاً در کدام بزرگراه، خیابان یا تقاطع رخ داد؟'
        : isEconomic
        ? 'این واحد صنفی، انبار یا اداره در کدام محله و خیابان واقع شده است؟'
        : 'این اتفاق دقیقاً در کدام محله، خیابان یا نشانهٔ مشخص رخ داد؟',
      hint: isOnline
        ? 'نام سایت، آیدی پیج اینستاگرام، کانال تلگرام یا لینک درگاه پرداخت را وارد کنید.'
        : 'نام محله، خیابان، کوچه و نشانهٔ نزدیک محل وقوع را دقیق بنویسید.',
      placeholder: isOnline
        ? 'مثلاً: پیج اینستاگرام @shop_example یا سایت example.ir'
        : 'نام محله، خیابان و جزئیات دقیق آدرس…',
      options: isOnline
        ? [
            'صفحه اینستاگرام',
            'کانال یا حساب تلگرام',
            'وب‌سایت فروشگاهی',
            'سایت دیوار یا شیپور',
            'پیام‌رسان داخلی (ایتا / روبیکا / بله)',
            'درگاه پرداخت اینترنتی',
          ]
        : isTraffic
        ? ['بزرگراه یا اتوبان', 'خیابان اصلی', 'تقاطع یا چهارراه', 'داخل کوچه', 'جاده برون‌شهری']
        : isEconomic
        ? ['انبار یا سوله', 'مغازه یا واحد صنفی', 'اداره یا سازمان دولتی', 'بازار یا پاساژ']
        : ['داخل کوچه', 'خیابان اصلی', 'روبروی مغازه یا مجتمع', 'پارک یا بوستان', 'داخل ساختمان / منزل'],
    },

    // ۵. چه چیزی (details)
    details: {
      id: 'details',
      stage: 5,
      title: isOnlineShopping
        ? 'چه کالایی یا خدمتی قرار بود دریافت کنید و چه مبلغی پرداخت شد؟'
        : isCyber
        ? 'کدام حساب، سامانه یا اطلاعات مورد سوءاستفاده قرار گرفت و چه خسارتی وارد شد؟'
        : isFraud
        ? 'چه وعده یا معامله‌ای مطرح شد و چه مبلغی رد و بدل گردید؟'
        : isFight
        ? 'در این درگیری چه اتفاقی رخ داد و چه صدمات یا خساراتی وارد شد؟'
        : isTheft
        ? 'چه اموال، وسایل یا اقلامی به سرقت رفته است؟'
        : isNarcotics
        ? 'چه نوع مواد مخدری و به چه صورت در حال توزیع، حمل یا مصرف است؟'
        : isTraffic
        ? 'چه حادثه یا تخلف رانندگی رخ داد و چه خودرویی درگیر بود؟'
        : isWeapon
        ? 'چه نوع سلاح یا تیراندازی مشاهده شد و چه آسیبی به همراه داشت؟'
        : isEconomic
        ? 'موضوع تخلف اقتصادی، احتکار یا قاچاق چیست و چه حجمی دارد؟'
        : isService
        ? 'چه مشکل، خرابی یا خسارتی مشاهده شده و چه تأثیری گذاشته است؟'
        : stripQuestionPrefix(EVENTS[ev]?.detail || EVENTS.other.detail),
      hint: isOnline
        ? 'نوع کالا یا خدمات، مبلغ پرداختی و شماره پیگیری تراکنش را در صورت اطلاع بنویسید.'
        : EVENTS[ev]?.hint || EVENTS.other.hint,
      placeholder: isOnline
        ? 'نوع کالا، مبلغ پرداختی و جزئیات سفارش…'
        : 'آنچه دیدید یا می‌دانید را شرح دهید…',
      options: isOnlineShopping
        ? [
            'گوشی موبایل یا کالای دیجیتال',
            'پوشاک و لوازم شخصی',
            'لوازم خانگی یا قطعات خودرو',
            'پرداخت بیعانه / کل مبلغ کالا',
            'عدم ارسال کالا و مسدود کردن تماس',
          ]
        : isCyber
        ? [
            'برداشت غیرمجاز از حساب بانکی',
            'هک حساب کاربری پیام‌رسان',
            'انتشار تصاویر یا اطلاعات خصوصی',
            'دریافت لینک آلوده و فیشینگ',
          ]
        : isFraud
        ? ['واریز وجه به کارت', 'پیش‌فروش نامعتبر', 'وعده سود سرمایه‌گذاری', 'عدم تحویل کالا یا ملک']
        : isFight
        ? ['مجروحیت و آسیب بدنی', 'شکستن شیشه‌ها و تخریب اموال', 'درگیری لفظی و تهدید', 'بدون آسیب جانی']
        : isTheft
        ? ['طلا و جواهرات', 'پول نقد و ارز', 'گوشی موبایل', 'خودرو یا موتورسیکلت', 'قطعات و لوازم خودرو']
        : isNarcotics
        ? ['خرده‌فروشی شیشه و هروئین', 'پخش گل و حشیش', 'تجمع و مصرف علنی معتادان', 'نگهداری و انتقال عمده مواد']
        : isTraffic
        ? ['تصادف و فرار از صحنه', 'کورس شبانه و سرعت غیرمجاز', 'پلاک مخدوش یا پوشانده‌شده', 'خسارت به خودروهای پارک‌شده']
        : isWeapon
        ? ['تیراندازی هوایی یا به سمت محل', 'قدرت‌نمایی با سلاح گرم', 'نگهداری و حمل سلاح غیرمجاز', 'مواد محترقه و منفجره']
        : isEconomic
        ? ['احتکار کالاهای اساسی و ارزاق', 'قاچاق سوخت یا کالای خارجی', 'دریافت رشوه و تخلف اداری', 'اخلال در بازار ارز و طلا']
        : ['خسارت مالی', 'سلب آسایش عمومی', 'مشاهده تخلف آشکار', 'تهدید و مزاحمت'],
    },

    // ۶. چرا / علت و انگیزه (reason)
    reason: {
      id: 'reason',
      stage: 6,
      title: isOnlineShopping
        ? 'علت اعتماد یا نحوه آشنایی و ترغیب شما به این خرید اینترنتی چه بود؟'
        : isCyber
        ? 'انگیزه فرد متخلف یا نحوه فریب برای دسترسی به حساب چه بود؟'
        : isFraud
        ? 'طعمه یا وعده‌ای که باعث جلب اعتماد و پرداخت وجه شد چه بود؟'
        : isFight
        ? 'علت، انگیزه یا دلیل شروع این نزاع و درگیری چه بود؟'
        : isTheft
        ? 'علت، انگیزه یا نحوه شناسایی محل توسط سارقین چه به نظر می‌رسد؟'
        : isTraffic
        ? 'علت وقوع حادثه یا انگیزه رفتار پرخطر راننده چه بود؟'
        : isEconomic
        ? 'انگیزه یا زمینه این تخلف اقتصادی یا اداری چه بود؟'
        : 'درباره دلیل، علت یا انگیزه این اتفاق چه اطلاعاتی دارید؟',
      hint: isOnline
        ? 'نحوه تبلیغ، قیمت پیشنهادی، وعده فروشنده یا پیامک دریافتی را که موجب اعتماد شد بنویسید.'
        : 'فقط اگر چیزی درباره انگیزه، نحوه فریب یا دلیل شنیده‌اید یا دیده‌اید بنویسید.',
      placeholder: isOnline
        ? 'مثلاً: تبلیغات اینستاگرام، قیمت پایین‌تر از بازار، پیامک جعلی…'
        : 'علت یا انگیزه واقعه…',
      options: isOnline
        ? [
            'تبلیغات و قیمت ارزان‌تر از بازار',
            'معرفی در کانال‌ها و شبکه‌های اجتماعی',
            'ظاهر معتبر صفحه یا سایت',
            'ارسال پیامک یا لینک جعلی',
          ]
        : isFraud
        ? ['وعده سود بالا یا قیمت ارزان', 'معرفی توسط آشنایان', 'آگهی در سایت‌های نیازمندی', 'جعل عنوان و مدارک']
        : isFight
        ? ['سر اختلاف قبلی بود', 'مسائل ناموسی / خانوادگی بود', 'سر مسائل مالی و بدهی بود', 'تصادف و بگومگوی ساده']
        : isTheft
        ? ['خالی بودن منزل یا مغازه', 'پارک خودرو در محل تاریک و خلوت', 'فقدان دوربین یا دزدگیر', 'انگیزه سرقت اموال قیمتی']
        : ['سر اختلاف قبلی بود', 'سر مسائل مالی بود', 'انگیزه ناموسی / خانوادگی بود', 'انگیزه اخاذی و سودجویی'],
    },

    // ۷. چگونه / روش و ابزار (method)
    method: {
      id: 'method',
      stage: 7,
      title: isOnlineShopping
        ? 'پرداخت وجه و ارتباط با فروشنده از چه طریق و به چه روشی انجام شد؟'
        : isCyber
        ? 'این اقدام سایبری از چه طریق و با چه ابزار یا روشی انجام شد؟'
        : isFraud
        ? 'دریافت وجه و کلاهبرداری به چه شیوه یا ابزاری صورت گرفت؟'
        : isFight
        ? 'این درگیری چگونه انجام شد و از چه روش یا وسیله‌ای استفاده شد؟'
        : isTheft
        ? 'سرقت چگونه انجام شد و از چه ابزار یا روش ورودی استفاده گردید؟'
        : isTraffic
        ? 'این حادثه یا تخلف با چه نوع وسیله نقلیه‌ای و چگونه رخ داد؟'
        : 'این کار چگونه انجام شد و از چه روش یا وسیله‌ای استفاده شد؟',
      hint: isOnline
        ? 'روش پرداخت (کارت به کارت، درگاه اینترنتی، لینک پرداخت) و شیوه ارتباط را مشخص نمایید.'
        : 'سلاح سرد، سلاح گرم، ابزار، وسیله نقلیه یا روش اجرا را مشخص فرمایید.',
      placeholder: isOnline
        ? 'مثلاً: کارت به کارت به حساب فروشنده / پرداخت از طریق درگاه سایت'
        : 'مثلاً: با قمه و چوب درگیر شدند / از پنجره وارد شدند',
      options: isOnline
        ? [
            'کارت به کارت بانکی',
            'درگاه پرداخت اینترنتی',
            'لینک پرداخت در پیام‌رسان',
            'واریز شبا یا پایا',
            'مسدود شدن (بلاک) پس از پرداخت',
          ]
        : isFraud
        ? [
            'کارت به کارت بانکی',
            'درگاه پرداخت اینترنتی',
            'چک یا سفته و رسید عادی',
            'پرداخت نقدی یا ارز دیجیتال',
          ]
        : isFight
        ? ['سلاح سرد', 'سلاح گرم', 'چوب و چماق', 'سنگ و مشت و لگد', 'دست خالی / بدون سلاح']
        : isTheft
        ? ['تخریب قفل و درب', 'ورود به عنف با سلاح سرد', 'سلاح گرم', 'شکستن شیشه', 'شاه‌کلید / کلیدساز']
        : isTraffic
        ? ['خودروی سواری', 'موتورسیکلت', 'وانت یا کامیون', 'سرعت غیرمجاز و لایی‌کشی']
        : ['سلاح سرد', 'سلاح گرم', 'وسیله نقلیه (خودرو / موتور)', 'روش‌های اینترنتی و تلفنی', 'دست خالی / بدون سلاح'],
    },
  };

  // انتخاب سوالات صرفاً بر اساس ۷ پارامتر حیاتی در ترتیب استاندارد
  const rawCandidates = VITAL_PARAMETERS.map((id) => ({
    ...base[id],
    category: categoryForSection(id),
    required: sectionRequired(id, analysis),
  }));

  return validateAndFilterQuestions(rawCandidates, analysis, analysis?.text || '');
}

/**
 * متد اعتبارسنجی و پالایش سوالات بر اساس قاعده «عدم پرسشِ اطلاعات تکراری یا نامرتبط»:
 * پس از استخراج نوع رخداد و اطلاعات اولیه توسط هوش مصنوعی، این متد لیست سوالات پیشنهادی را با بررسی کلمات کلیدی پالایش کرده و:
 * ۱. صرفاً سوالات منطبق بر ۷ پارامتر حیاتی (نحوه اطلاع، فاعل، زمان، مکان، چه چیزی، چرا، چگونه) را نگه می‌دارد.
 * ۲. سوالاتی را که پاسخ آن‌ها قبلاً در متن گزارش (بر اساس کلمات کلیدی) یا یافته‌های مستخرج (known) وجود دارد فیلتر می‌نماید.
 * ۳. سوالات نامرتبط با ماهیت رخداد (مانند پرسش درباره «خیابان و محله» یا نمایش کلیدواژه‌های «سلاح سرد/گرم» برای خرید اینترنتی) را حذف یا اصلاح می‌کند.
 * ۴. گزینه‌های نامعتبر (مانند «اطلاعات بیشتری ندارم») را از کلیدواژه‌ها پاکسازی کرده و فقط سوالات حیاتی و کاربردی را به ترتیب مراحل ۱ تا ۷ بازمی‌گرداند.
 */
export function validateAndFilterQuestions(candidateQuestions = [], analysis = {}, narrativeText = '') {
  if (!Array.isArray(candidateQuestions)) return [];

  const known = analysis?.known || {};
  const scenario = detectScenarioByKeywords(analysis, narrativeText);
  const { isOnline, isFraud, isFight, isWeapon, isTheft } = scenario;
  const primaryNarrative = String(narrativeText || analysis?.text || '').trim();
  const textToInspect = (
    primaryNarrative ||
    Object.values(analysis?.eventEvidence || {})
      .filter(Boolean)
      .join('\n')
  ).replace(/\u200c/g, ' ');

  const hasVaguePlace =
    Boolean(known.vaguePlace) || STAGE_COVERAGE_KEYWORDS.vaguePlace.test(textToInspect);
  const sourceConflict = hasConflictingSource(textToInspect, known);

  // ۱. تشخیص مراحل پاسخ‌داده‌شده با بررسی کلمات کلیدی متن و یافته‌های هوش مصنوعی (عدم پرسش اطلاعات تکراری)
  const answeredStages = new Set();
  const stageMap = [
    [1, 'source'],
    [2, 'person'],
    [3, 'time'],
    [4, 'place'],
    [5, 'details'],
    [6, 'reason'],
    [7, 'method'],
  ];

  for (const [stageNum, paramId] of stageMap) {
    if (isParameterCoveredByKeywords(paramId, textToInspect, known, isOnline)) {
      answeredStages.add(stageNum);
    }
  }

  // ۲. الگوهای سوالات غیرضروری، کلیشه‌ای یا نامرتبط
  const redundantTitleRx =
    /^(?:دقیقاً چه رفتار یا اتفاقی مشاهده کرده‌اید؟|ترتیب اتفاق‌ها و نتیجهٔ قابل مشاهده چه بود؟|از وسایل، مدارک یا اموال مرتبط با این اتفاق چیزی می‌دانید؟|از وسیلهٔ نقلیهٔ مرتبط با این اتفاق چیزی می‌دانید؟|شماره، حساب یا نشانی اینترنتیِ مرتبط با این اتفاق را می‌دانید؟)$/u;
  const physicalStreetPlaceRx =
    /(?:کدام\s+محله،?\s*خیابان|در\s+کدام\s+محل\s+رخ\s+داد|کدام\s+بزرگراه،?\s*خیابان|کدام\s+محله\s+و\s+خیابان)/u;

  const allowedIds = new Set([
    ...VITAL_PARAMETERS,
    'who',
    'actor',
    'when',
    'where',
    'location',
    'what',
    'why',
    'cause',
    'how',
  ]);

  const disallowWeaponChips = isOnline || (isFraud && !isFight && !isWeapon && !isTheft);
  const allEntities = extractDynamicEntities(
    { ...analysis, text: textToInspect },
    Array.isArray(analysis?.entities) ? analysis.entities : []
  );

  const seenStages = new Set();
  const seenTitles = new Set();
  const validated = [];

  for (const rawQ of candidateQuestions) {
    if (!rawQ || typeof rawQ !== 'object') continue;

    const id = String(rawQ.id || '').trim();
    const cleanTitle = stripQuestionPrefix(String(rawQ.title || ''));
    if (!id || !cleanTitle) continue;

    // حذف سوالات خارج از ۷ پارامتر حیاتی یا دارای عنوان کلیشه‌ای نامرتبط
    if (!allowedIds.has(id.toLowerCase()) || redundantTitleRx.test(cleanTitle)) {
      continue;
    }

    const stage = rawQ.stage || getQuestionStage(id);
    if (stage < 1 || stage > 7) continue;

    // عدم پرسش مجدد مرحله‌ای که قبلاً پاسخ داده شده است
    if (answeredStages.has(stage)) {
      continue;
    }

    // عدم تکرار بیش از یک سوال در هر مرحله (۱ تا ۷) یا تکرار عنوان مشابه
    const normalizedTitleKey = cleanTitle.replace(/\s+/g, ' ').trim();
    if (seenStages.has(stage) || seenTitles.has(normalizedTitleKey)) {
      continue;
    }

    let finalTitle = cleanTitle;
    let finalHint = rawQ.hint || '';
    let finalPlaceholder = rawQ.placeholder || '';
    let finalOptions = Array.isArray(rawQ.options)
      ? rawQ.options.filter(
          (opt) =>
            typeof opt === 'string' &&
            opt.trim() &&
            opt !== 'اطلاعات بیشتری ندارم' &&
            opt !== 'اطلاعی ندارم' &&
            !(disallowWeaponChips && (opt === 'سلاح سرد' || opt === 'سلاح گرم'))
        )
      : [];

    // اگر در مرحله ۱ ابهام بین مشاهده مستقیم و فضای مجازی وجود دارد، سوال شفاف‌سازی نمایش داده شود
    if (stage === 1 && sourceConflict) {
      finalTitle =
        'در شرح گزارش هم عبارت «خودم دیدم» و هم «در فضای مجازی دیدم / شنیدم» آمده است؛ دقیقاً کدام بخش از گزارش را خودتان از نزدیک مشاهده کردید و کدام بخش را در فضای مجازی دیدید؟';
      finalHint =
        'لطفاً مشخص فرمایید کدام رویداد را شخصاً در محل دیده‌اید و کدام مورد مربوط به فضای مجازی یا شنیده‌هاست.';
      finalOptions = [
        'حادثه اصلی را خودم در محل دیدم ولی فعالیت دیگر آن‌ها را در فضای مجازی دیدم',
        'کل ماجرا را خودم از نزدیک مشاهده کردم',
        'کل موضوع را در فضای مجازی دیدم و حضوری شاهد نبودم',
        'بخشی را خودم دیدم و بخشی را از دیگران شنیدم',
      ];
    }

    // بررسی تناسب ماهیت رخداد برای مرحله ۴ (مکان / بستر وقوع)
    if (stage === 4) {
      if (isOnline && physicalStreetPlaceRx.test(finalTitle)) {
        // اصلاح خودکار سوال خیابانی به بستر اینترنتی برای گزارش‌های آنلاین
        finalTitle = 'نام یا نشانی دقیق فروشگاه اینترنتی، سایت، صفحه یا پیام‌رسان چیست؟';
        finalHint = 'نام سایت، آیدی پیج اینستاگرام، کانال تلگرام یا لینک درگاه پرداخت را وارد کنید.';
        finalPlaceholder = 'مثلاً: پیج اینستاگرام @shop_example یا سایت example.ir';
        finalOptions = [
          'صفحه اینستاگرام',
          'کانال یا حساب تلگرام',
          'وب‌سایت فروشگاهی',
          'سایت دیوار یا شیپور',
          'پیام‌رسان داخلی (ایتا / روبیکا / بله)',
          'درگاه پرداخت اینترنتی',
        ];
      } else if (!isOnline && hasVaguePlace) {
        finalTitle = 'نام محله و جزئیات آدرس چیست؟';
      }
    }

    seenStages.add(stage);
    seenTitles.add(finalTitle);

    const dynamicFields = buildDynamicFieldsForEntities(
      allEntities,
      stage,
      textToInspect
    );

    validated.push({
      ...rawQ,
      stage,
      title: finalTitle,
      hint: finalHint,
      placeholder: finalPlaceholder,
      options: [...new Set(finalOptions)],
      dynamicFields,
      recognizedEntities: allEntities.filter((e) => Number(e.stage) === stage),
    });
  }

  const sortedValidated = validated.sort((a, b) => (a.stage || 5) - (b.stage || 5));

  // اگر موجودیتی (به ویژه مشخصات ظاهری، پلاک خودرو یا اطلاعات بانکی) شناسایی شده باشد که مرحله اصلی آن قبلاً پاسخ داده شده، فیلد پویای آن را به نزدیک‌ترین سوالِ فعالِ مرحله تکمیل اطلاعات متصل کن
  if (sortedValidated.length > 0 && allEntities.length > 0) {
    const attachedIds = new Set(
      sortedValidated.flatMap((q) => (q.dynamicFields || []).map((f) => f.entityId))
    );
    const priorityIds = new Set(['appearance', 'license_plate', 'bank_account']);
    const orphanEntities = allEntities.filter(
      (e) =>
        e &&
        e.id &&
        !attachedIds.has(e.id) &&
        (e.needsCompletion !== false || priorityIds.has(e.id) || Boolean(e.value))
    );
    if (orphanEntities.length > 0) {
      const targetQ =
        sortedValidated.find((q) => q.id === 'details' || q.id === 'method') ||
        sortedValidated[0];
      const extraFields = buildDynamicFieldsForEntities(orphanEntities, null, textToInspect);
      targetQ.dynamicFields = [...(targetQ.dynamicFields || []), ...extraFields];
      targetQ.recognizedEntities = [...(targetQ.recognizedEntities || []), ...orphanEntities];
    }
  }

  return sortedValidated;
}

export const filterRedundantQuestions = validateAndFilterQuestions;

/**
 * لایه اعتبارسنجی خروجی مدل (LLM) و دسته‌بندی ساختاریافته موجودیت‌های خاص در فیلدهای `answers`:
 * خروجی مدل و متن گزارش را بررسی می‌کند تا از وجود و صحت موجودیت‌های خاص مانند:
 * - 'مشخصات ظاهری افراد' (`appearance`)
 * - 'شماره پلاک خودرو' (`license_plate`)
 * - 'اطلاعات بانکی' (`bank_account`)
 * اطمینان حاصل کند و در صورت وجود، آن‌ها را به‌صورت ساختاریافته در فیلدهای `answers` و `extra` دسته‌بندی نماید
 * تا در مرحله تکمیل اطلاعات به صورت باکس‌های ورودی پویا نمایش داده شوند.
 */
export function validateLLMEntitiesAndBuildAnswers(llmOutput = {}, narrativeText = '') {
  const inputObj =
    typeof llmOutput === 'object' && llmOutput !== null ? llmOutput : {};
  const primaryText = String(narrativeText || inputObj.text || '').trim();
  const textToInspect =
    primaryText ||
    Object.values(inputObj.eventEvidence || {})
      .filter(Boolean)
      .join('\n');

  const base = textToInspect.trim()
    ? localAnalysis(textToInspect)
    : { events: ['other'], known: {}, entities: [], answers: {} };

  // ادغام و تکمیل مشخصات ظاهری افراد (از جمله لنگ زدن، جراحت، تتو، مو و ...)
  const extractedAppearance = extractAppearanceFromText(textToInspect);
  const rawKnownAppearance =
    typeof inputObj.known?.appearance === 'string' ? inputObj.known.appearance : '';
  const baseAppearance =
    typeof base.known?.appearance === 'string' ? base.known.appearance : '';

  const normKey = (str) =>
    String(str || '')
      .replace(/\u200c/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const mergedAppearanceParts = [];
  for (const sourceStr of [extractedAppearance, baseAppearance, rawKnownAppearance]) {
    for (const part of String(sourceStr || '')
      .split(' ، ')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const pNorm = normKey(part);
      if (!pNorm) continue;
      if (!mergedAppearanceParts.some((ex) => normKey(ex).includes(pNorm))) {
        const subIdx = mergedAppearanceParts.findIndex((ex) => pNorm.includes(normKey(ex)));
        if (subIdx >= 0) mergedAppearanceParts[subIdx] = part;
        else mergedAppearanceParts.push(part);
      }
    }
  }
  const finalAppearance = mergedAppearanceParts.join(' ، ');

  const mergedKnown = {
    ...(base.known || {}),
    ...(inputObj.known || {}),
    appearance: finalAppearance,
  };

  const mergedEvents =
    Array.isArray(inputObj.events) && inputObj.events.length
      ? inputObj.events
      : base.events || ['other'];

  const rawEntities = Array.isArray(inputObj.entities)
    ? inputObj.entities
    : Array.isArray(inputObj.extractedEntities)
    ? inputObj.extractedEntities
    : [];

  const validatedEntities = extractDynamicEntities(
    {
      ...base,
      ...inputObj,
      text: textToInspect,
      known: mergedKnown,
      events: mergedEvents,
    },
    rawEntities
  );

  // دسته‌بندی ساختاریافته موجودیت‌های شناسایی‌شده در فیلدهای answers و extra
  const structuredAnswers = {
    ...(base.answers && typeof base.answers === 'object' ? base.answers : {}),
    ...(inputObj.answers && typeof inputObj.answers === 'object' ? inputObj.answers : {}),
  };
  const structuredExtra = {
    ...(inputObj.extra && typeof inputObj.extra === 'object' ? inputObj.extra : {}),
  };

  const stageToQuestionId = {
    1: 'source',
    2: 'person',
    3: 'time',
    4: 'place',
    5: 'details',
    6: 'reason',
    7: 'method',
  };

  for (const ent of validatedEntities) {
    if (!ent || !ent.id) continue;
    const dynamicBoxes = buildDynamicFieldsForEntities([ent], null, textToInspect);
    const dynamicBox = dynamicBoxes[0] || null;
    const subFieldValues = {};
    if (dynamicBox && Array.isArray(dynamicBox.subFields)) {
      for (const sf of dynamicBox.subFields) {
        subFieldValues[sf.key] =
          ent.fields?.[sf.key] !== undefined && ent.fields?.[sf.key] !== ''
            ? ent.fields[sf.key]
            : sf.defaultValue || '';
      }
    }

    const qId = stageToQuestionId[ent.stage] || 'details';
    structuredAnswers[ent.id] = {
      id: ent.id,
      type: ent.type || ent.id,
      category: ent.label,
      label: ent.label,
      stage: ent.stage || 2,
      targetQuestionId: qId,
      value: ent.value || '',
      fields: subFieldValues,
      dynamicField: dynamicBox,
    };

    // پیش‌پر کردن فیلدهای ورودی پویا در شیء extra برای نمایش مستقیم در QuestionFlow
    if (Object.values(subFieldValues).some((v) => Boolean(v && String(v).trim()))) {
      for (const targetSec of [qId, 'details', 'method', 'person']) {
        const prevSec = structuredExtra[targetSec] || { enabled: true, rows: [], detailFields: {} };
        structuredExtra[targetSec] = {
          ...prevSec,
          enabled: true,
          detailFields: {
            ...(prevSec.detailFields || {}),
            ...Object.fromEntries(
              Object.entries(subFieldValues).filter(([, v]) => Boolean(v && String(v).trim()))
            ),
          },
        };
      }
    }
  }

  return {
    ...base,
    ...inputObj,
    known: mergedKnown,
    events: mergedEvents,
    event: mergedEvents[0] || 'other',
    entities: validatedEntities,
    answers: structuredAnswers,
    extra: structuredExtra,
  };
}

export const validateAndCategorizeEntities = validateLLMEntitiesAndBuildAnswers;
export const validateLLMOutput = validateLLMEntitiesAndBuildAnswers;

/**
 * پارس کردن خروجی JSON استاندارد از LLM و اعتبارسنجی موجودیت‌های شناسایی‌شده (entities)، اطلاعات اولیه (known) و دسته‌بندی در فیلدهای answers
 */
export function parseLLMAnalysisJson(rawInput, narrativeText = '') {
  let parsed = {};
  if (typeof rawInput === 'string') {
    try {
      const cleaned = rawInput
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }
  } else if (rawInput && typeof rawInput === 'object') {
    parsed = rawInput;
  }

  return validateLLMEntitiesAndBuildAnswers(parsed, narrativeText);
}

/**
 * استخراج پویا و استانداردسازی موجودیت‌ها (مانند شماره حساب، مشخصات ظاهری، پلاک خودرو، هویت، شماره تماس، سایت و هر موجودیت دیگر تشخیص‌داده‌شده توسط LLM)
 * در قالب JSON استاندارد
 */
export function extractDynamicEntities(analysisOrText = {}, rawEntities = []) {
  const isStringInput = typeof analysisOrText === 'string';
  const analysis = isStringInput
    ? localAnalysis(analysisOrText)
    : (analysisOrText || {});
  const text = isStringInput
    ? analysisOrText
    : String(analysis?.text || '').trim() ||
      Object.values(analysis?.eventEvidence || {})
        .filter(Boolean)
        .join('\n');
  const known = analysis?.known || {};
  const events = eventIds(analysis);
  const llmEntities = [
    ...(Array.isArray(analysis?.entities) ? analysis.entities : []),
    ...(Array.isArray(rawEntities) ? rawEntities : []),
  ];

  return extractEntitiesFromNarrative(text, known, events, llmEntities);
}

/**
 * ایجاد فیلدهای ورودی پویا (Dynamic Fields) برای مرحله تکمیل اطلاعات بر اساس موجودیت‌های شناسایی‌شده در JSON
 */
export function buildDynamicFieldsForEntities(entities = [], stage = null, contextText = '') {
  const list = Array.isArray(entities) ? entities : [];
  const fields = [];
  const seenFieldIds = new Set();

  const addField = (f) => {
    if (!f || !f.id || seenFieldIds.has(f.id)) return;
    seenFieldIds.add(f.id);
    fields.push(f);
  };

  for (const ent of list) {
    if (!ent || typeof ent !== 'object') continue;
    const entStage = Number(ent.stage) || 2;
    if (stage !== null && entStage !== stage) continue;

    const type = String(ent.type || ent.id || 'custom').trim();
    const fieldId = `entity_${ent.id || type}`;
    const entFields = ent.fields && typeof ent.fields === 'object' ? ent.fields : {};

    if (type === 'bank_account') {
      addField({
        id: fieldId,
        entityId: ent.id || 'bank_account',
        type: 'bank_account',
        stage: entStage,
        label: ent.label || 'اطلاعات بانکی',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: 'bankNumber',
            label: 'شماره حساب / شماره کارت / شبا',
            placeholder: ent.placeholder || '6037... یا IR...',
            dir: 'ltr',
            defaultValue:
              entFields.bankNumber ||
              (ent.value && /\d{4}/.test(ent.value) ? ent.value : ''),
          },
          {
            key: 'bankOwner',
            label: 'نام صاحب حساب و نام بانک',
            placeholder: 'مثلاً: علی رضایی - بانک ملت',
            dir: 'rtl',
            defaultValue: entFields.bankOwner || '',
          },
        ],
      });
    } else if (type === 'appearance') {
      addField({
        id: fieldId,
        entityId: ent.id || 'appearance',
        type: 'appearance',
        stage: entStage,
        label: ent.label || 'مشخصات ظاهری افراد',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: 'personAppearance',
            label:
              ent.fieldLabel ||
              'مشخصات ظاهری افراد (قد، سن، مدل مو، تتو، لباس، نقص عضو یا لنگ زدن)',
            placeholder:
              ent.placeholder ||
              'مثلاً: قد بلند، موهای بلند، تتو روی دست راست، پای چپ لنگ می‌زند...',
            dir: 'rtl',
            defaultValue: entFields.personAppearance || ent.value || '',
          },
        ],
      });
    } else if (type === 'person_identity') {
      addField({
        id: fieldId,
        entityId: ent.id || 'person_identity',
        type: 'person_identity',
        stage: entStage,
        label: ent.label || 'مشخصات هویتی فرد / فاعل',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: 'personName',
            label: ent.fieldLabel || 'نام، نام خانوادگی یا لقب / شهرت',
            placeholder: ent.placeholder || 'نام، فامیل یا لقب فرد...',
            dir: 'rtl',
            defaultValue: entFields.personName || ent.value || '',
          },
        ],
      });
    } else if (type === 'license_plate') {
      addField({
        id: fieldId,
        entityId: ent.id || 'license_plate',
        type: 'license_plate',
        stage: entStage,
        label: ent.label || 'شماره پلاک خودرو',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: 'vehicleModel',
            label: 'نوع، مدل و رنگ وسیله نقلیه',
            placeholder: 'مثلاً: پژو ۲۰۶ سفید، موتور هوندا مشکی...',
            dir: 'rtl',
            defaultValue: entFields.vehicleModel || '',
          },
          {
            key: 'vehiclePlate',
            label: 'شماره پلاک خودرو (در صورت اطلاع)',
            placeholder: ent.placeholder || 'مثلاً: ۱۲ الف ۳۴۵ ایران ۶۶',
            dir: 'rtl',
            defaultValue: entFields.vehiclePlate || ent.value || '',
          },
        ],
      });
    } else if (type === 'contact_info') {
      addField({
        id: fieldId,
        entityId: ent.id || 'contact_info',
        type: 'contact_info',
        stage: entStage,
        label: ent.label || 'ثبت شماره تماس، آیدی یا مشخصات صفحه مجازی',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: 'contactId',
            label: 'شماره تماس / موبایل یا آیدی (@id)',
            placeholder: '0912... یا @username',
            dir: 'ltr',
            defaultValue: entFields.contactId || ent.value || '',
          },
          {
            key: 'contactChannel',
            label: 'نام صفحه، کانال یا پیام‌رسان',
            placeholder: 'مثلاً: پیج اینستاگرام فروشگاه...',
            dir: 'rtl',
            defaultValue: entFields.contactChannel || '',
          },
        ],
      });
    } else if (type === 'website_url') {
      addField({
        id: fieldId,
        entityId: ent.id || 'website_url',
        type: 'website_url',
        stage: entStage,
        label: ent.label || 'ثبت نشانی وب‌سایت، درگاه یا عنوان آگهی',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: 'websiteUrl',
            label: ent.fieldLabel || 'آدرس سایت (URL)، نام فروشگاه یا عنوان آگهی',
            placeholder: ent.placeholder || 'آدرس سایت، نام پیج یا عنوان آگهی در دیوار/شیپور...',
            dir: 'rtl',
            defaultValue: entFields.websiteUrl || ent.value || '',
          },
        ],
      });
    } else {
      // هر موجودیت پویا و جدیدی که LLM در قالب JSON بازگردانده است (فراتر از لیست ثابت)
      const customKey = `custom_${ent.id || type}`;
      addField({
        id: fieldId,
        entityId: ent.id || type,
        type,
        stage: entStage,
        label: ent.label || 'اطلاعات تکمیلی موجودیت شناسایی‌شده',
        extractedValue: ent.value || '',
        subFields: [
          {
            key: customKey,
            label: ent.fieldLabel || ent.label || 'جزئیات تکمیلی',
            placeholder: ent.placeholder || 'لطفاً جزئیات را وارد نمایید...',
            dir: 'rtl',
            defaultValue: entFields[customKey] || ent.value || '',
          },
        ],
      });
    }
  }

  return fields;
}

/**
 * Generates personalized 7-stage interview questions for the AI Guide Assistant (`GuideInterview` / `/api/interview`)
 * based on the current narrative and conversation history, skipping any stages already answered.
 */
export function interviewStepsFor(text = '', history = []) {
  const historyText = Array.isArray(history)
    ? history
        .filter((h) => h?.a && h.a !== 'اطلاعی ندارم' && h.a !== 'نمی‌دانم')
        .map((h) => h.a)
        .join(' ')
    : '';
  const combined = [text, historyText].filter(Boolean).join(' ');
  const analysis = combined.trim()
    ? localAnalysis(combined)
    : { event: 'other', events: ['other'], known: {} };
  return questionsFor({ ...analysis, text: combined });
}

const OFF_TOPIC_ONLY_RX =
  /^(?:(?:سلام|درود|وقت\s*بخیر|خسته\s*نباشید|صبح\s*بخیر|عصر\s*بخیر|شب\s*بخیر|حالتون?\s*چطوره|حال\s*شما|خوبی|خوبین|چطوری|چه\s*خبر|اسمت\s*چیه|شما\s*کی\s*هستی|ربات\s*هستی|هوش\s*مصنوعی\s*هستی|هوا\s*چطوره|قیمت\s*دلار|قیمت\s*طلا|جک\s*بگو|یه\s*لطیفه\s*بگو|فوتبال|الو|صدا\s*میاد|صدای\s*منو\s*داری|تست|امتحان|کمک|ممنون|تشکر|مرسی|خداحافظ|فعلا|باشه|اوکی|حوصله\s*ندارم|خسته\s*شدم|ولش\s*کن|به\s*تو\s*چه|الکی|فرقی\s*نمیکنه|چند\s*تا\s*سوال\s*میپرسی|چرا\s*اینقدر\s*سوال\s*میپرسی|ok|hi|hello|test)[\s!؟?.،]*)+$/iu;

const OFF_TOPIC_SUBJECT_RX =
  /(?:هوا\s*(?:چطوره|خوبه|سرده|گرمه|عالیه)|هوا\s*امروز|قیمت\s*(?:دلار|سکه|طلا|ارز)|نتیجه\s*فوتبال|جک\s*بگو|لطیفه\s*بگو|شعر\s*بخوان|غذا\s*چی\s*بپزم|ناهار\s*چی|شام\s*چی|قورمه\s*سبزی|اسمت\s*چیه|چند\s*سالته|کجا\s*زندگی\s*میکنی|ربات\s*هستی|چند\s*تا\s*سوال\s*میپرسی|حوصله\s*ندارم|ولش\s*کن)/u;

const FILLER_PREFIX_RX =
  /^(?:(?:سلام|درود|وقت\s*بخیر|خسته\s*نباشید|عرض\s*ادب|ببخشید|راستش\s*بخواید|راستش|والا|حقیقتش|عرضم\s*به\s*حضورتون|خدمتتون\s*عارضم\s*که|میخواستم\s*بگم\s*که|میدونید\s*چیه)[\s،.؛!؟]+)+/u;

const INCIDENT_SIGNAL_RX =
  /(?:سرقت|دزدی|سارق|دزد|ربود|زورگیر|خفت|کیف|قاپید|قاپی|خرید|فروش|فروشگاه|سفارش|پرداخت|واریز|کارت|حساب|پول|مبلغ|تومان|ریال|کلاهبردار|فریب|بلاک|مسدود|نزاع|درگیر|دعوا|ضرب|جرح|کتک|حمله|چاقو|قمه|سلاح|اسلحه|تیرانداز|مواد|مخدر|مشروب|ساقی|تصادف|سانحه|برخورد|واژگون|فرار|پلاک|خودرو|ماشین|موتور|گوشی|موبایل|طلا|مدارک|منزل|خانه|مغازه|سایت|پیج|اینستاگرام|تلگرام|واتساپ|فیشینگ|هک|تهدید|مزاحم|آزار|متجاوز|تخریب|آتش|حریق|انفجار|برق|چراغ|روشنایی|سد\s*معبر|تخلف|شکایت|گزارش|قاچاق|احتکار|رشوه|فساد|پلیس|مامور|کلانتری|پارک|خیابان|کوچه|محله|بردند|زدند|شکست|ربودند|مصدوم|مجروح|مفقود|گم\s*شد|مشکوک|ناامن)/u;

const SOURCE_SIGNAL_RX =
  /(?:خودم|دیدم|شاهد|حضوری|چشم|اتفاق\s*افتاد|برای\s*من|برای\s*خودم|مالباخته|خریدم|سفارش\s*دادم|پرداخت\s*کردم|شنیدم|گفتند|همسایه|دوست|آشنا|فضای\s*مجازی|اینستاگرام|تلگرام|واتساپ|کانال|پیج|سایت|تماس|پیامک|دوربین)/u;

const PERSON_SIGNAL_RX =
  /(?:نفر|مرد|زن|جوان|پیر|پسر|دختر|سارق|دزد|ضارب|فروشنده|ادمین|صاحب\s*حساب|گرداننده|راننده|سرنشین|موتورسوار|همسایه|آشنا|غریبه|ناشناس|همدست|باند|قد|لباس|پوشیده|مو|ریش|تتو|خالکوبی|لنگ|شماره|کارت|حساب|آیدی|ایدی|به\s*نام|ملقب|فامیل|ندیدم|نمی\s*شناسم|نمیشناسم|[۰-۹0-9])/u;

const TIME_SIGNAL_RX =
  /(?:امروز|دیروز|دیشب|پریروز|ساعت|صبح|ظهر|عصر|شب|غروب|بامداد|نیمه\s*شب|هفته|ماه|سال|روز|دقیقه|چند\s*ساعت|چند\s*روز|شنبه|یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه|\d+|[۰-۹]+)/u;

const PLACE_SIGNAL_RX =
  /(?:خیابان|خیابون|بلوار|میدان|محله|کوچه|بزرگراه|اتوبان|چهارراه|تقاطع|فلکه|پل|پارک|بوستان|بازار|مغازه|پاساژ|مجتمع|ساختمان|منزل|خانه|خونه|مدرسه|دانشگاه|بیمارستان|بانک|ایستگاه|مترو|پلاک|طبقه|جاده|شهر|روستا|تهران|مشهد|اصفهان|شیراز|تبریز|کرج|قم|اهواز|رشت|کرمان|همدان|یزد|اردبیل|ارومیه|زاهدان|ساری|بندرعباس|قزوین|زنجان|سنندج|خرم\s*آباد|گرگان|بجنورد|بیرجند|ایلام|بوشهر|شهرکرد|یاسوج|سمنان|آبادان|کیش|قشم|سایت|وب\s*سایت|پیج|صفحه|کانال|اینستاگرام|اینستا|تلگرام|واتساپ|دیوار|شیپور|ایتا|روبیکا|بله|درگاه|لینک|اینترنتی|آنلاین|انلاین|@[a-zA-Z0-9_.]|\.[a-z]{2,})/iu;

const DONT_KNOW_RX =
  /^(?:نمی\s*دانم|نمیدونم|اطلاعی\s*ندارم|اطلاعاتی\s*ندارم|اطلاعات\s*بیشتری\s*ندارم|مشخصاتی\s*ندارم|یادم\s*نیست|دقیق\s*نمی\s*دانم|ناشناس\s*بود|ناشناس\s*است|ندیدم)[\s.،!؟]*$/u;

const TRIVIAL_REJECT_RX =
  /^(?:بله|آره|اره|خیر|نه|هیچی|همینطوری|همینجوری|نمیدونم\s*والا|هرچی|نمیدانم|چرا|ها|چی|خوب|بد|قرمز|آبی|سبز|زرد|زیاد|کم|۱|۲|1|2|\.+|-+)[\s!؟?.،]*$/u;

/**
 * پاکسازی حاشیه‌پردازی، تعارفات و جملات اضافه از پاسخ کاربر تا گزارش مختصر و مستند بماند
 */
export function sanitizeSmartTurnInput(rawText = '') {
  const norm = String(rawText || '')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return '';

  let cleaned = norm.replace(FILLER_PREFIX_RX, '').trim();
  if (!cleaned) cleaned = norm;

  // جلوگیری از طولانی کردن متن توسط کاربر (حداکثر ۳۵۰ نویسه مفید در هر نوبت)
  if (cleaned.length > 350) {
    cleaned = cleaned.slice(0, 350).trim();
  }
  return cleaned;
}

/**
 * اعتبارسنجی منطقی و قانع‌کننده بودن پاسخ کاربر برای مرحله فعلی گفتگوی هوشمند
 */
export function validateSmartTurnAnswer(stageId = 'incident', rawAnswer = '', context = {}) {
  const raw = String(rawAnswer || '').trim();
  const normalized = raw.replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();

  if (!normalized || normalized.length < 2) {
    return {
      valid: false,
      reason: 'empty',
      cleanedAnswer: '',
      feedback: 'لطفاً پاسخ درست و مربوط دهید. به سؤال مطرح‌شده پاسخ مشخص بدهید.',
    };
  }

  if (
    OFF_TOPIC_ONLY_RX.test(normalized) ||
    (OFF_TOPIC_SUBJECT_RX.test(normalized) && !INCIDENT_SIGNAL_RX.test(normalized))
  ) {
    return {
      valid: false,
      reason: 'off_topic',
      cleanedAnswer: '',
      feedback: 'لطفاً پاسخ درست و مربوط دهید و از صحبت‌های غیرمرتبط خودداری کنید.',
    };
  }

  const cleaned = sanitizeSmartTurnInput(raw);
  const stage = String(stageId || 'incident').toLowerCase();

  // در مرحله شرح اولیه (incident) و نحوه اطلاع (source)، «نمی‌دانم» یا پاسخ غیرمرتبط با رخداد قابل قبول نیست
  if (stage === 'incident') {
    if (DONT_KNOW_RX.test(cleaned) || TRIVIAL_REJECT_RX.test(cleaned)) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback: 'لطفاً پاسخ درست و مربوط دهید و بگویید دقیقاً چه اتفاقی افتاده است.',
      };
    }
    const hasIncidentSignal = INCIDENT_SIGNAL_RX.test(cleaned);
    if (!hasIncidentSignal || cleaned.length < 6) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback:
          'لطفاً پاسخ درست و مربوط دهید. به طور مشخص بگویید چه رخدادی اتفاق افتاده است.',
      };
    }
    return { valid: true, reason: 'ok', cleanedAnswer: cleaned, feedback: '' };
  }

  if (stage === 'source') {
    if (DONT_KNOW_RX.test(cleaned) || TRIVIAL_REJECT_RX.test(cleaned)) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback:
          'لطفاً پاسخ درست و مربوط دهید. مشخص کنید خودتان دیدید، برای خودتان رخ داد، شنیدید یا در فضای مجازی دیدید؟',
      };
    }
    if (!SOURCE_SIGNAL_RX.test(cleaned)) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback:
          'لطفاً پاسخ درست و مربوط دهید. نحوه اطلاع خود را مشخص کنید (مثلاً: خودم شاهد بودم، برای خودم اتفاق افتاد یا در فضای مجازی دیدم).',
      };
    }
    return { valid: true, reason: 'ok', cleanedAnswer: cleaned, feedback: '' };
  }

  if (stage === 'person') {
    if (DONT_KNOW_RX.test(cleaned)) {
      return { valid: true, reason: 'ok', cleanedAnswer: 'اطلاعی ندارم', feedback: '' };
    }
    if (TRIVIAL_REJECT_RX.test(cleaned) || !PERSON_SIGNAL_RX.test(cleaned)) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback:
          'لطفاً پاسخ درست و مربوط دهید. درباره نام، تعداد یا مشخصات افراد مرتبط بگویید یا بگویید اطلاعی ندارم.',
      };
    }
    return { valid: true, reason: 'ok', cleanedAnswer: cleaned, feedback: '' };
  }

  if (stage === 'time') {
    if (DONT_KNOW_RX.test(cleaned)) {
      return { valid: true, reason: 'ok', cleanedAnswer: 'اطلاعی ندارم', feedback: '' };
    }
    if (!TIME_SIGNAL_RX.test(cleaned)) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback:
          'لطفاً پاسخ درست و مربوط دهید و روز یا ساعت تقریبی وقوع را مشخص کنید.',
      };
    }
    return { valid: true, reason: 'ok', cleanedAnswer: cleaned, feedback: '' };
  }

  if (stage === 'place') {
    if (
      STAGE_COVERAGE_KEYWORDS.vaguePlace.test(cleaned) ||
      /^(?:اینجا|آنجا|اونجا|همینجا|همانجا|خونه|منزل)[\s.،!؟]*$/u.test(cleaned)
    ) {
      return {
        valid: false,
        reason: 'vague_place',
        cleanedAnswer: '',
        feedback:
          'لطفاً پاسخ درست و مربوط دهید. عبارت «محله ما / کوچه ما» مبهم است؛ نام دقیق محله، خیابان یا سایت را بگویید.',
      };
    }
    if (DONT_KNOW_RX.test(cleaned)) {
      return { valid: true, reason: 'ok', cleanedAnswer: 'اطلاعی ندارم', feedback: '' };
    }
    if (
      TRIVIAL_REJECT_RX.test(cleaned) ||
      cleaned.length < 3 ||
      (!PLACE_SIGNAL_RX.test(cleaned) && TIME_SIGNAL_RX.test(cleaned))
    ) {
      return {
        valid: false,
        reason: 'unconvincing',
        cleanedAnswer: '',
        feedback: context?.isOnline
          ? 'لطفاً پاسخ درست و مربوط دهید و نام سایت، صفحه یا پیام‌رسان را مشخص کنید.'
          : 'لطفاً پاسخ درست و مربوط دهید و نام محله، خیابان یا نشانی محل وقوع را مشخص کنید.',
      };
    }
    return { valid: true, reason: 'ok', cleanedAnswer: cleaned, feedback: '' };
  }

  // سایر مراحل (details, reason, method)
  if (DONT_KNOW_RX.test(cleaned)) {
    return { valid: true, reason: 'ok', cleanedAnswer: 'اطلاعی ندارم', feedback: '' };
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  const onlyTimeOrGreeting =
    words.length <= 2 &&
    TIME_SIGNAL_RX.test(cleaned) &&
    !INCIDENT_SIGNAL_RX.test(cleaned);
  if (TRIVIAL_REJECT_RX.test(cleaned) || cleaned.length < 4 || onlyTimeOrGreeting) {
    return {
      valid: false,
      reason: 'unconvincing',
      cleanedAnswer: '',
      feedback: 'لطفاً پاسخ درست و مربوط دهید یا اگر اطلاعی ندارید بگویید اطلاعی ندارم.',
    };
  }

  return { valid: true, reason: 'ok', cleanedAnswer: cleaned, feedback: '' };
}

/**
 * ایجاد وضعیت اولیه «گفتگوی هوشمند» که در آن هوش مصنوعی شروع‌کننده مکالمه است
 */
export function createSmartConversationInitialState(initialSeedText = '') {
  const seed = sanitizeSmartTurnInput(initialSeedText);
  const firstQuestion = {
    id: 'incident',
    stage: 0,
    title: 'دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟',
    hint: 'فقط اصل اتفاق را در یک یا دو جمله کوتاه و مستقیم بیان کنید (بدون مقدمه‌چینی).',
    options: [
      'از یک فروشگاه اینترنتی خرید کردم اما کالا ارسال نشد و پاسخ نمی‌دهد',
      'سرقت از خودرو یا منزل رخ داده است',
      'شاهد نزاع، درگیری یا تهدید با سلاح بودم',
      'مشاهده جرم، آزار یا فروش مواد مخدر در محله',
      'نقص خدمات شهری و روشنایی معابر',
    ],
  };

  const baseState = {
    starter: 'ai',
    done: false,
    inputLocked: false,
    incidentText: '',
    turns: [],
    answeredStageIds: [],
    stageAnswers: {},
    currentQuestion: firstQuestion,
    messages: [
      {
        id: 'ai-init-0',
        role: 'ai',
        stageId: 'incident',
        text: 'سلام. من دستیار هوشمند سامانه راوی هستم و این گفتگو را آغاز می‌کنم. لطفاً بدون حاشیه‌پردازی و کوتاه فقط به سوالات پاسخ دهید.\nسوال اول: دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟',
      },
    ],
    compiledNarrative: '',
    analysis: null,
  };

  if (seed && validateSmartTurnAnswer('incident', seed).valid) {
    return evaluateSmartConversationTurn(baseState, seed);
  }

  return baseState;
}

/**
 * پردازش هر نوبت از «گفتگوی هوشمند»:
 * ۱. بررسی منطقی و قانع‌کننده بودن پاسخ کاربر و جلوگیری از حرف‌های غیرمرتبط
 * ۲. در صورت نامعتبر بودن، تکرار قاطع سوال فعلی بدون طولانی کردن مکالمه
 * ۳. در صورت معتبر بودن، استخراج خودکار اطلاعات، حذف سوالات پوشش‌داده‌شده و پرسیدن سوال بعدی یا پایان گفتگو
 */
export function evaluateSmartConversationTurn(state, userAnswer = '') {
  const currentState = state || createSmartConversationInitialState();
  if (currentState.done || currentState.inputLocked) {
    return {
      ...currentState,
      lastValidation: {
        valid: false,
        reason: 'locked',
        feedback: 'گفتگو به پایان رسیده است و امکان افزودن پیام حاشیه‌ای وجود ندارد.',
      },
    };
  }

  const currentQ = currentState.currentQuestion || {
    id: 'incident',
    stage: 0,
    title: 'دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟',
  };

  const combinedSoFar = [
    currentState.incidentText,
    ...Object.values(currentState.stageAnswers || {}).filter(
      (v) => v && v !== 'اطلاعی ندارم' && v !== 'نمی‌دانم'
    ),
  ]
    .filter(Boolean)
    .join(' ');
  const scenarioSoFar = detectScenarioByKeywords({ text: combinedSoFar }, combinedSoFar);

  const check = validateSmartTurnAnswer(currentQ.id, userAnswer, {
    isOnline: scenarioSoFar.isOnline,
  });

  const userMsg = {
    id: `user-${Date.now()}-${ (currentState.messages || []).length }`,
    role: 'user',
    stageId: currentQ.id,
    text: String(userAnswer || '').trim(),
    valid: check.valid,
  };

  // اگر پاسخ کاربر غیرمنطقی، مبهم یا غیرمرتبط بود، سوال بعدی پرسیده نمی‌شود
  if (!check.valid) {
    const retryAiMsg = {
      id: `ai-retry-${Date.now()}-${ (currentState.messages || []).length }`,
      role: 'ai',
      stageId: currentQ.id,
      isWarning: true,
      text: `${check.feedback}\nسوال فعلی: ${currentQ.title}`,
    };

    return {
      ...currentState,
      messages: [...(currentState.messages || []), userMsg, retryAiMsg],
      lastValidation: check,
    };
  }

  // پاسخ منطقی و قانع‌کننده است -> ثبت پاسخ و محاسبه سوال بعدی
  const cleanedAnswer = check.cleanedAnswer;
  const nextIncidentText =
    currentQ.id === 'incident' ? cleanedAnswer : currentState.incidentText;
  const nextTurns = [
    ...(currentState.turns || []),
    { stageId: currentQ.id, q: stripQuestionPrefix(currentQ.title), a: cleanedAnswer },
  ];
  const nextStageAnswers = {
    ...(currentState.stageAnswers || {}),
    [currentQ.id]: cleanedAnswer,
  };
  const nextAnsweredIds = Array.from(
    new Set([...(currentState.answeredStageIds || []), currentQ.id])
  );

  // ساخت متن تجمیعی برای تشخیص هوشمند مراحلی که کاربر در ضمن پاسخ خود به آن‌ها هم اشاره کرده است
  const stageLabels = {
    source: 'نحوه اطلاع',
    person: 'مشخصات افراد مرتبط',
    time: 'زمان وقوع',
    place: 'مکان یا بستر وقوع',
    details: 'جزئیات و خسارات',
    reason: 'علت یا انگیزه',
    method: 'شیوه و ابزار انجام کار',
  };

  const narrativeLines = [];
  if (nextIncidentText) {
    narrativeLines.push(nextIncidentText);
  }
  for (const paramId of VITAL_PARAMETERS) {
    const val = nextStageAnswers[paramId];
    if (val && val !== 'اطلاعی ندارم' && val !== 'نمی‌دانم') {
      narrativeLines.push(`${stageLabels[paramId]}: ${val}`);
    }
  }
  const compiledNarrative = narrativeLines.join('.\n');

  // استخراج سوالات باقی‌مانده که هنوز پوشش داده نشده‌اند
  const candidateQuestions = interviewStepsFor(nextIncidentText, nextTurns.slice(1));
  const remainingQuestions = candidateQuestions.filter(
    (q) => !nextAnsweredIds.includes(q.id)
  );

  if (remainingQuestions.length === 0) {
    const finalAnalysis = validateLLMEntitiesAndBuildAnswers(
      localAnalysis(compiledNarrative),
      compiledNarrative
    );
    // ادغام پاسخ‌های صریح مراحل گفتگو در فیلد answers
    const mergedAnswers = {
      ...(finalAnalysis.answers || {}),
    };
    for (const [k, v] of Object.entries(nextStageAnswers)) {
      if (k !== 'incident' && v && v !== 'اطلاعی ندارم' && v !== 'نمی‌دانم') {
        mergedAnswers[k] = v;
      }
    }
    finalAnalysis.answers = mergedAnswers;

    const doneAiMsg = {
      id: `ai-done-${Date.now()}`,
      role: 'ai',
      stageId: 'done',
      text: 'پاسخ شما ثبت شد. تمامی اطلاعات حیاتی گزارش تکمیل گردید. جهت جلوگیری از طولانی شدن مکالمه، گفتگو به پایان رسید.',
    };

    return {
      ...currentState,
      done: true,
      inputLocked: true,
      incidentText: nextIncidentText,
      turns: nextTurns,
      answeredStageIds: nextAnsweredIds,
      stageAnswers: nextStageAnswers,
      currentQuestion: null,
      messages: [...(currentState.messages || []), userMsg, doneAiMsg],
      compiledNarrative,
      analysis: finalAnalysis,
      lastValidation: check,
    };
  }

  const nextQuestion = remainingQuestions[0];
  const nextAiMsg = {
    id: `ai-next-${Date.now()}-${nextTurns.length}`,
    role: 'ai',
    stageId: nextQuestion.id,
    text: `ثبت شد. ${nextQuestion.title}`,
  };

  return {
    ...currentState,
    done: false,
    inputLocked: false,
    incidentText: nextIncidentText,
    turns: nextTurns,
    answeredStageIds: nextAnsweredIds,
    stageAnswers: nextStageAnswers,
    currentQuestion: nextQuestion,
    messages: [...(currentState.messages || []), userMsg, nextAiMsg],
    compiledNarrative,
    analysis: validateLLMEntitiesAndBuildAnswers(
      localAnalysis(compiledNarrative),
      compiledNarrative
    ),
    lastValidation: check,
  };
}

export function validateFiles(files, current = []) {
  const errors = [];
  const accepted = [];
  let total = current.reduce((n, f) => n + f.size, 0);
  for (const f of files) {
    if (current.length + accepted.length >= 10) {
      errors.push('حداکثر ۱۰ فایل می‌توانید اضافه کنید.');
      break;
    }
    if (!f.size) {
      errors.push(`فایل «${f.name}» خالی است.`);
      continue;
    }
    const mime = String(f.type || '').toLowerCase();
    const known = /^(image\/(jpeg|png|webp|gif|heic|heif)|video\/(mp4|webm|quicktime|3gpp)|audio\/(mpeg|mp3|wav|x-wav|mp4|webm|ogg|x-m4a|aac|3gpp|amr)|application\/pdf)$/.test(mime);
    const generic = (!mime || mime === 'application/octet-stream') && /\.(?:jpe?g|png|webp|gif|heic|heif|mp4|mov|webm|3gp|mp3|wav|m4a|aac|amr|ogg|pdf)$/i.test(f.name || '');
    if (!known && !generic) {
      errors.push(`نوع فایل «${f.name}» پشتیبانی نمی‌شود.`);
      continue;
    }
    if (total + f.size > 100 * 1024 * 1024) {
      errors.push('مجموع حجم فایل‌ها باید حداکثر ۱۰۰ مگابایت باشد.');
      continue;
    }
    if ([...current, ...accepted].some(x => x.name === f.name && x.size === f.size)) {
      errors.push(`فایل «${f.name}» قبلاً اضافه شده است.`);
      continue;
    }
    total += f.size;
    accepted.push(f);
  }
  return { accepted, errors };
}
