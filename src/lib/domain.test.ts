import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripQuestionPrefix,
  questionsFor,
  interviewStepsFor,
  isOnlineIncident,
  validateAndFilterQuestions,
  filterRedundantQuestions,
  VITAL_PARAMETERS,
  detectScenarioByKeywords,
  isParameterCoveredByKeywords,
  parseLLMAnalysisJson,
  extractDynamicEntities,
  buildDynamicFieldsForEntities,
  validateLLMEntitiesAndBuildAnswers,
  extractAppearanceFromText,
  createSmartConversationInitialState,
  validateSmartTurnAnswer,
  evaluateSmartConversationTurn,
  EVENTS,
} from './domain.js';
import { localAnalysis } from './scenarios.js';
import { newsDomain } from './guidance.js';
import {
  prepareNaturalIranianSpeechText,
  phoneticizeForIranianNeuralTts,
  generateSecMsGecV2,
} from './persian-tts.ts';

test('stripQuestionPrefix removes prefixes like چه چیزی:, نحوه اطلاع:, etc.', () => {
  assert.equal(stripQuestionPrefix('چه چیزی: شرح مال سرقت شده'), 'شرح مال سرقت شده');
  assert.equal(stripQuestionPrefix('نحوه اطلاع: این را خودتان دیدید یا از کسی شنیدید؟'), 'این را خودتان دیدید یا از کسی شنیدید؟');
  assert.equal(stripQuestionPrefix('چگونه: این کار چگونه انجام شد و از چه روش یا وسیله‌ای استفاده شد؟'), 'این کار چگونه انجام شد و از چه روش یا وسیله‌ای استفاده شد؟');
  assert.equal(stripQuestionPrefix('چه کسی: از افراد مرتبط با این اتفاق چه می‌دانید؟'), 'از افراد مرتبط با این اتفاق چه می‌دانید؟');
  assert.equal(stripQuestionPrefix('چه زمانی: این اتفاق چه زمانی افتاد؟'), 'این اتفاق چه زمانی افتاد؟');
  assert.equal(stripQuestionPrefix('چه مکانی: این اتفاق کجا رخ داد؟'), 'این اتفاق کجا رخ داد؟');
  assert.equal(stripQuestionPrefix('چرا: آیا درباره دلیل اتفاق اطلاعاتی دارید؟'), 'آیا درباره دلیل اتفاق اطلاعاتی دارید؟');
  assert.equal(stripQuestionPrefix('یک عنوان معمولی بدون پیشوند'), 'یک عنوان معمولی بدون پیشوند');
});

test('questionsFor generates clean options without "اطلاعات بیشتری ندارم" or "اطلاعی ندارم"', () => {
  const mockAnalysis = {
    event: 'assault',
    events: ['assault'],
    known: {},
  };

  const qs = questionsFor(mockAnalysis);

  for (const q of qs) {
    if (q.options) {
      assert.ok(!q.options.includes('اطلاعات بیشتری ندارم'), `Question ${q.id} has "اطلاعات بیشتری ندارم"`);
      assert.ok(!q.options.includes('اطلاعی ندارم'), `Question ${q.id} has "اطلاعی ندارم"`);
    }
  }

  const methodQ = qs.find((q) => q.id === 'method');
  assert.ok(methodQ, 'method question should be present');
  assert.ok(methodQ.options.includes('سلاح گرم'), 'method options must include سلاح گرم');
  assert.ok(methodQ.options.includes('سلاح سرد'), 'method options must include سلاح سرد');
  assert.ok(!methodQ.options.includes('با سلاح سرد یا چوب بود'), 'old option should be removed');
});

test('localAnalysis extracts full details from user fight narrative and skips answered questions', () => {
  const narrative =
    'امروز ساعت 11 ظهر در محله دولت آباد یک مورد نزاع دست جمعی خیابانی رخ داد. مجموع افراد حاضر در نزاع 5 نفر بودند. از هیچکدام مشخصات خاصی ندارم به جز احمد میثاقی که شروع کننده نزاع بود و علت نزاع هم ناموسی بود';
  const analysis = localAnalysis(narrative);

  assert.equal(analysis.known.place, 'محله دولت آباد');
  assert.equal(analysis.known.time, 'امروز، ساعت 11 (ظهر)');
  assert.equal(analysis.known.peopleCount, '5 نفر');
  assert.equal(analysis.known.actor, 'احمد میثاقی (شروع‌کننده نزاع)');
  assert.equal(analysis.known.reason, 'ناموسی');
  assert.equal(analysis.known.lackOfOtherDetails, true);

  const qs = questionsFor(analysis);
  const qIds = qs.map((q) => q.id);

  // Already answered sections must NOT be asked again
  assert.ok(!qIds.includes('person'), 'person should be skipped because actor and lackOfOtherDetails were provided');
  assert.ok(!qIds.includes('time'), 'time should be skipped because 11 ظهر was provided');
  assert.ok(!qIds.includes('place'), 'place should be skipped because محله دولت آباد was provided');
  assert.ok(!qIds.includes('reason'), 'reason should be skipped because ناموسی was provided');

  // Unanswered sections must be present in strict sequence: source -> details -> method
  assert.deepEqual(qIds, ['source', 'details', 'method']);
});

test('online shopping fraud narrative accurately detects cyber domain, skips source, asks online platform place, and removes redundant clarify/other questions', () => {
  const narrative =
    'از یک فروشگاه اینترنتی خرید کردم و هزینه را پرداخت کردم، اما کالا ارسال نشده و فروشنده پاسخ نمی‌دهد.';
  const analysis = localAnalysis(narrative);
  const domains = newsDomain(narrative);

  // 1. Must detect online fraud, NOT "other"
  assert.ok(!analysis.events.includes('other'), 'events must not fall back to other');
  assert.ok(
    analysis.events.includes('online_fraud_scam') || analysis.events.includes('fraud'),
    'events must include online_fraud_scam or fraud'
  );
  assert.equal(analysis.title, 'کلاهبرداری اینترنتی و خریدهای آنلاین غیرواقعی');

  // 2. News domain must include پلیس فتا (سایبری), NOT سایر
  assert.ok(domains.includes('پلیس فتا (سایبری)'), 'newsDomain must include پلیس فتا (سایبری)');
  assert.ok(!domains.includes('سایر'), 'newsDomain must not be سایر');

  // 3. First-person "خرید کردم" means it happened to the reporter -> source is known and skipped
  assert.equal(analysis.known.source, 'برای خودم اتفاق افتاده');
  assert.equal(analysis.known.isOnline, true);

  const qs = questionsFor(analysis);
  const qIds = qs.map((q) => q.id);
  const qTitles = qs.map((q) => q.title);

  assert.ok(!qIds.includes('source'), 'source (نحوه اطلاع) must NOT be asked when user says خرید کردم');
  assert.deepEqual(qIds, ['person', 'time', 'place', 'details', 'reason', 'method']);

  // 4. Place question must ask about the online store/platform, NOT physical neighborhood/street
  const placeQ = qs.find((q) => q.id === 'place');
  assert.ok(placeQ, 'place question should be present');
  assert.equal(placeQ.title, 'نام یا نشانی دقیق فروشگاه اینترنتی، سایت، صفحه یا پیام‌رسان چیست؟');
  assert.ok(!placeQ.title.includes('محله، خیابان'), 'place question must not ask about physical street for online fraud');
  assert.ok(placeQ.options.includes('صفحه اینستاگرام'), 'online place options should include صفحه اینستاگرام');

  // 5. Redundant/wrong questions must never appear
  assert.ok(!qTitles.includes('دقیقاً چه رفتار یا اتفاقی مشاهده کرده‌اید؟'), 'clarify question must never appear');
  assert.ok(!qTitles.includes('ترتیب اتفاق‌ها و نتیجهٔ قابل مشاهده چه بود؟'), 'generic sequence question must never appear');
});

test('localAnalysis converts night hours and spoken Persian numbers to 24-hour format', () => {
  const nightDigit = localAnalysis('دیشب ساعت 11 شب در خیابان سعادت آباد سرقت شد');
  assert.equal(nightDigit.known.time, 'دیشب، ساعت 23');
  assert.equal(nightDigit.known.place, 'خیابان سعادت آباد');

  const nightWord = localAnalysis('ساعت یازده و نیم شب صدای تیراندازی شنیدم');
  assert.equal(nightWord.known.time, 'ساعت 23:30');

  const afternoonWord = localAnalysis('امروز ساعت چهار بعد از ظهر تصادف شد');
  assert.equal(afternoonWord.known.time, 'امروز، ساعت 16');
});

test('vague neighborhood ("محله ما", "کوچه ما", "محلمون") triggers explicit "نام محله و جزئیات آدرس چیست؟" question', () => {
  for (const phrase of ['در محله ما دزدی شد', 'توی کوچه ما درگیری شد', 'ساعت ۸ شب تو محلمون نزاع شد']) {
    const analysis = localAnalysis(phrase);
    assert.equal(analysis.known.place, '', `place should be empty for "${phrase}"`);
    assert.equal(analysis.known.vaguePlace, true, `vaguePlace should be true for "${phrase}"`);

    const qs = questionsFor(analysis);
    const placeQ = qs.find((q) => q.id === 'place');
    assert.ok(placeQ, `place question must be asked for "${phrase}"`);
    assert.equal(placeQ.title, 'نام محله و جزئیات آدرس چیست؟');
  }
});

test('all 7 standard questions are asked in exact required order when narrative has no extracted facts', () => {
  const analysis = localAnalysis('یک مورد سرقت رخ داده است');
  const qs = questionsFor(analysis);
  assert.deepEqual(
    qs.map((q) => q.id),
    ['source', 'person', 'time', 'place', 'details', 'reason', 'method']
  );
});

test('expanded police & security crime categories are registered in EVENTS', () => {
  assert.ok(EVENTS.armed_robbery, 'armed_robbery exists');
  assert.ok(EVENTS.espionage_security, 'espionage_security exists');
  assert.ok(EVENTS.narcotics_trafficking, 'narcotics_trafficking exists');
  assert.ok(EVENTS.phishing_banking, 'phishing_banking exists');
  assert.ok(EVENTS.goods_smuggling, 'goods_smuggling exists');
  assert.ok(EVENTS.reckless_racing, 'reckless_racing exists');
});

test('interviewStepsFor generates personalized 7-stage questions for smart assistant and omits street questions for online incidents', () => {
  const steps = interviewStepsFor(
    'از یک فروشگاه اینترنتی خرید کردم و هزینه را پرداخت کردم، اما کالا ارسال نشده و فروشنده پاسخ نمی‌دهد.'
  );
  assert.deepEqual(
    steps.map((s) => s.id),
    ['person', 'time', 'place', 'details', 'reason', 'method']
  );
  const placeStep = steps.find((s) => s.id === 'place');
  assert.equal(placeStep.title, 'نام یا نشانی دقیق فروشگاه اینترنتی، سایت، صفحه یا پیام‌رسان چیست؟');
  assert.equal(isOnlineIncident({ event: 'online_fraud_scam', events: ['online_fraud_scam'] }), true);
});

test('validateAndFilterQuestions removes duplicate stages, redundant boilerplate, already-answered facts, and rewrites street place questions for online incidents', () => {
  const mockOnlineAnalysis = {
    event: 'online_fraud_scam',
    events: ['online_fraud_scam'],
    known: {
      source: 'برای خودم اتفاق افتاده',
      time: 'دیروز، ساعت 18',
      isOnline: true,
    },
  };

  const noisyCandidates = [
    { id: 'source', stage: 1, title: 'نحوه اطلاع: چگونه متوجه شدید؟', options: ['خودم شاهد بودم', 'اطلاعی ندارم'] },
    { id: 'clarify', stage: 5, title: 'دقیقاً چه رفتار یا اتفاقی مشاهده کرده‌اید؟', options: [] },
    { id: 'details_other', stage: 5, title: 'ترتیب اتفاق‌ها و نتیجهٔ قابل مشاهده چه بود؟', options: [] },
    { id: 'person', stage: 2, title: 'چه کسی: مشخصات فروشنده چیست؟', options: ['فروشنده ناشناس است', 'اطلاعات بیشتری ندارم'] },
    { id: 'who', stage: 2, title: 'چه کسی این کار را انجام داد؟', options: [] }, // duplicate stage 2
    { id: 'time', stage: 3, title: 'این اتفاق چه زمانی رخ داد؟', options: [] }, // already answered in known.time
    { id: 'place', stage: 4, title: 'این اتفاق دقیقاً در کدام محله، خیابان یا نشانهٔ مشخص رخ داد؟', options: ['داخل کوچه'] }, // physical street question on online incident
    { id: 'details', stage: 5, title: 'چه کالایی سفارش دادید و چه مبلغی پرداخت شد؟', options: ['کالای دیجیتال'] },
    { id: 'object', stage: 5, title: 'از وسایل، مدارک یا اموال مرتبط با این اتفاق چیزی می‌دانید؟', options: [] },
    { id: 'reason', stage: 6, title: 'چرا: علت اعتماد شما چه بود؟', options: ['تبلیغات ارزان'] },
    { id: 'method', stage: 7, title: 'چگونه: پرداخت وجه چگونه انجام شد؟', options: ['کارت به کارت بانکی'] },
  ];

  const filtered = validateAndFilterQuestions(
    noisyCandidates,
    mockOnlineAnalysis,
    'دیروز ساعت 18 از یک فروشگاه اینترنتی خرید کردم ولی ارسال نشد'
  );

  assert.equal(filterRedundantQuestions, validateAndFilterQuestions);
  assert.deepEqual(
    filtered.map((q) => q.id),
    ['person', 'place', 'details', 'reason', 'method']
  );

  // Prefix stripped & banned options removed
  const personQ = filtered.find((q) => q.id === 'person');
  assert.equal(personQ.title, 'مشخصات فروشنده چیست؟');
  assert.deepEqual(personQ.options, ['فروشنده ناشناس است']);

  // Physical street question automatically rewritten to online platform question
  const placeQ = filtered.find((q) => q.id === 'place');
  assert.equal(placeQ.title, 'نام یا نشانی دقیق فروشگاه اینترنتی، سایت، صفحه یا پیام‌رسان چیست؟');
  assert.ok(placeQ.options.includes('صفحه اینستاگرام'));
});

test('keyword-based scenario detection and parameter coverage prevent repetitive or irrelevant questions even when event is generic', () => {
  assert.deepEqual(VITAL_PARAMETERS, ['source', 'person', 'time', 'place', 'details', 'reason', 'method']);

  // Even if AI returns event: "other" and empty known{}, keyword inspection detects online shopping,
  // skips covered parameters (source: خرید کردم, time: دیروز, place: اینستاگرام, method: کارت به کارت),
  // and only asks the remaining vital parameters tailored to online shopping.
  const rawNarrative =
    'دیروز از یک فروشگاه اینترنتی در اینستاگرام خرید کردم و کارت به کارت پرداخت کردم اما کالا ارسال نشد.';
  const scenario = detectScenarioByKeywords({ event: 'other', text: rawNarrative });
  assert.equal(scenario.isOnline, true);
  assert.equal(scenario.isOnlineShopping, true);

  assert.equal(isParameterCoveredByKeywords('source', rawNarrative, {}, true), true);
  assert.equal(isParameterCoveredByKeywords('time', rawNarrative, {}, true), true);
  assert.equal(isParameterCoveredByKeywords('place', rawNarrative, {}, true), true);
  assert.equal(isParameterCoveredByKeywords('method', rawNarrative, {}, true), true);
  assert.equal(isParameterCoveredByKeywords('person', rawNarrative, {}, true), false);
  assert.equal(isParameterCoveredByKeywords('details', rawNarrative, {}, true), false);
  assert.equal(isParameterCoveredByKeywords('reason', rawNarrative, {}, true), false);

  const qs = questionsFor({ event: 'other', events: ['other'], text: rawNarrative, known: {} });
  assert.deepEqual(
    qs.map((q) => q.id),
    ['person', 'details', 'reason']
  );
  assert.equal(
    qs[0].title,
    'درباره فروشنده، صاحب حساب یا گرداننده صفحه چه مشخصاتی (نام، شماره تماس یا شماره کارت) دارید؟'
  );
});

test('online clothing purchase + block narrative extracts details, method, and FATA follow-up note, and never shows weapon keywords', () => {
  const narrative =
    'امروز خودم از یه فروشگاه اینترنتی لباس زیر خریدم بعد از پرداخت بلاکم کرد هریچی هم به پلیس فتا گزارش میکنم پیگیری نمیشه';
  const analysis = localAnalysis(narrative);

  assert.equal(analysis.known.time, 'امروز');
  assert.equal(analysis.known.source, 'برای خودم اتفاق افتاده');
  assert.ok(analysis.known.details.includes('لباس زیر'), 'details must extract purchased item');
  assert.ok(analysis.known.details.includes('مسدود'), 'details must mention blocking after payment');
  assert.ok(analysis.known.method.includes('مسدود'), 'method must mention blocking after payment');
  assert.ok(analysis.known.otherInfo.includes('عدم پیگیری گزارش قبلی'), 'otherInfo must capture prior unaddressed report');

  const qs = questionsFor(analysis);
  for (const q of qs) {
    const opts = q.options || [];
    assert.ok(!opts.includes('سلاح سرد'), `Question ${q.id} must not include سلاح سرد for online shopping`);
    assert.ok(!opts.includes('سلاح گرم'), `Question ${q.id} must not include سلاح گرم for online shopping`);
  }
});

test('complex narrative with aliases, tattoos, multi-part place, secondary offenses, and conflicting sources extracts all facts and asks source clarification', () => {
  const narrative =
    'امروز خودم دیدم تو پارکی نزدیک فرمانیه تو زیر زمین شهرفرش سه نفر زن و مرد درگیر بودن مشخصات متجاوز ها دانیال احمدی ملقب به پاچو نگین موسوی ملقب به دست طلا پدرام جمشیدی ملقب به تدی از بچه ها مشخصاتی ندارم دانیال موهای بلند داره دست راست فول تتو نگین موهاش مش هستش و صورت تتو و این اشخاص توی باند تولید و پخش مواد مخدر هم هستند اینو توی فضای مجازی دیدم و البته در محل کسبشون هم که زیر زمین شهرفرش هستش فروش مشروبات الکلی دارند';
  const analysis = localAnalysis(narrative);

  assert.equal(analysis.known.time, 'امروز');
  assert.equal(analysis.known.sourceConflict, true, 'must detect conflict between خودم دیدم and توی فضای مجازی دیدم');
  assert.ok(analysis.known.source.includes('نیاز به شفاف‌سازی'), 'source summary should note conflict');
  assert.ok(analysis.known.place.includes('پارکی نزدیک فرمانیه'), 'place must include پارکی نزدیک فرمانیه');
  assert.ok(analysis.known.place.includes('زیر زمین شهرفرش'), 'place must include زیر زمین شهرفرش');
  assert.equal(analysis.known.peopleCount, 'سه نفر زن و مرد');
  assert.ok(analysis.known.actor.includes('دانیال احمدی (ملقب به پاچو)'), 'actor must include دانیال احمدی (ملقب به پاچو)');
  assert.ok(analysis.known.actor.includes('نگین موسوی (ملقب به دست طلا)'), 'actor must include نگین موسوی (ملقب به دست طلا)');
  assert.ok(analysis.known.actor.includes('پدرام جمشیدی (ملقب به تدی)'), 'actor must include پدرام جمشیدی (ملقب به تدی)');
  assert.ok(analysis.known.appearance.includes('موهای بلند'), 'appearance must include موهای بلند');
  assert.ok(analysis.known.appearance.includes('تتو'), 'appearance must include تتو');
  assert.ok(analysis.known.otherInfo.includes('باند تولید و پخش مواد مخدر'), 'otherInfo must include narcotics gang');
  assert.ok(analysis.known.otherInfo.includes('فروش مشروبات الکلی'), 'otherInfo must include alcohol sales');

  const qs = questionsFor(analysis);
  assert.equal(qs[0].id, 'source', 'first question must be source to clarify direct observation vs social media');
  assert.ok(
    qs[0].title.includes('کدام بخش از گزارش را خودتان از نزدیک مشاهده کردید و کدام بخش را در فضای مجازی دیدید'),
    'source question must ask to clarify which part was seen directly vs online'
  );
});

test('parseLLMAnalysisJson and extractDynamicEntities return standard JSON entities and generate dynamic fields for completion stage', () => {
  const llmJsonResponse = JSON.stringify({
    title: 'کلاهبرداری اینترنتی و سرقت با خودرو',
    events: ['online_fraud_scam'],
    known: {
      source: 'برای خودم اتفاق افتاده',
      time: 'امروز',
      isOnline: true,
    },
    entities: [
      {
        id: 'bank_account',
        type: 'bank_account',
        label: 'حساب بانکی / شماره کارت فروشنده',
        value: '6037991122334455',
        stage: 2,
        needsCompletion: true,
        fieldLabel: 'شماره کارت و نام صاحب حساب',
        placeholder: 'شماره کارت ۱۶ رقمی یا شبا',
      },
      {
        id: 'appearance',
        type: 'appearance',
        label: 'مشخصات ظاهری متهم',
        value: 'قد بلند با تتو روی دست',
        stage: 2,
        needsCompletion: true,
        fieldLabel: 'جزئیات تکمیلی چهره و لباس',
        placeholder: 'رنگ لباس، مدل مو و غیره',
      },
      {
        id: 'license_plate',
        type: 'license_plate',
        label: 'پلاک خودرو پیک موتوری',
        value: '۱۲ الف ۳۴۵',
        stage: 7,
        needsCompletion: true,
        fieldLabel: 'شماره پلاک کامل خودرو',
        placeholder: '۱۲ الف ۳۴۵ ایران ۶۶',
      },
      {
        id: 'crypto_wallet',
        type: 'crypto_wallet',
        label: 'آدرس کیف پول رمزارز',
        value: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
        stage: 7,
        needsCompletion: true,
        fieldLabel: 'شناسه تراکنش (TXID) و شبکه رمزارز',
        placeholder: 'TXID را وارد کنید...',
      },
    ],
  });

  const parsedAnalysis = parseLLMAnalysisJson(
    llmJsonResponse,
    'امروز از یک فروشگاه اینترنتی خرید کردم و به کارت 6037991122334455 واریز کردم'
  );

  assert.ok(Array.isArray(parsedAnalysis.entities), 'entities must be a standard JSON array');
  const entityIds = parsedAnalysis.entities.map((e: any) => e.id);
  assert.ok(entityIds.includes('bank_account'), 'must include bank_account entity');
  assert.ok(entityIds.includes('appearance'), 'must include appearance entity');
  assert.ok(entityIds.includes('license_plate'), 'must include license_plate entity');
  assert.ok(entityIds.includes('crypto_wallet'), 'must preserve custom LLM entity crypto_wallet beyond fixed list');

  const qs = questionsFor(parsedAnalysis);
  const allDynamicFields = qs.flatMap((q: any) => q.dynamicFields || []);
  const dynamicEntityIds = allDynamicFields.map((df: any) => df.entityId);

  assert.ok(dynamicEntityIds.includes('bank_account'), 'dynamic field must be generated for bank_account');
  assert.ok(dynamicEntityIds.includes('appearance'), 'dynamic field must be generated for appearance');
  assert.ok(dynamicEntityIds.includes('license_plate'), 'dynamic field must be generated for license_plate');
  assert.ok(dynamicEntityIds.includes('crypto_wallet'), 'dynamic field must be generated for custom LLM entity crypto_wallet');
});

test('extractAppearanceFromText and localAnalysis capture "پدرام پای چپش لنگ میزنه در اثر تیر خوردن" in مشخصات ظاهری افراد', () => {
  const narrative = `امروز خودم دیدم تو پارکی نزدیک فرمانیه تو زیر زمین شهرفرش سه نفر زن و مرد به دوتا بچه ازار جنسی میرسوندن 
مشخصات متجاوز ها دانیال احمدی ملقب به پاچو نگین موسوی ملقب به دست طلا پدرام جمشیدی ملقب به تدی 
از بچه ها مشخصاتی ندارم 
دانیال موهای بلند داره دست راست فول تتو 
نگین موهاش مش هستش و صورت تتو 
پدرام پای چپش لنگ میزنه در اثر تیر خوردن`;

  const appearance = extractAppearanceFromText(narrative);
  assert.ok(appearance.includes('دانیال موهای بلند داره دست راست فول تتو'), `Expected Danial appearance in: ${appearance}`);
  assert.ok(appearance.includes('نگین موهاش مش هستش و صورت تتو'), `Expected Negin appearance in: ${appearance}`);
  assert.ok(appearance.includes('پدرام پای چپش لنگ میزنه در اثر تیر خوردن'), `Expected Pedram limping appearance in: ${appearance}`);

  const analysis = localAnalysis(narrative);
  assert.ok(analysis.known.appearance.includes('پدرام پای چپش لنگ میزنه در اثر تیر خوردن'), 'known.appearance must include Pedram limping trait');

  const validated = validateLLMEntitiesAndBuildAnswers(analysis, narrative);
  assert.ok(validated.answers && validated.answers.appearance, 'answers.appearance must be structured');
  assert.equal(validated.answers.appearance.category, 'مشخصات ظاهری افراد');
  assert.ok(
    validated.answers.appearance.value.includes('پدرام پای چپش لنگ میزنه در اثر تیر خوردن'),
    'answers.appearance.value must include Pedram limping trait'
  );
  assert.ok(
    validated.answers.appearance.fields.personAppearance.includes('پدرام پای چپش لنگ میزنه در اثر تیر خوردن'),
    'answers.appearance.fields.personAppearance must be pre-populated with Pedram limping trait'
  );

  // Also ensure questionsFor attaches the appearance dynamic input box even when stage 2 (person) is skipped
  const qs = questionsFor(validated);
  const allDynamicFields = qs.flatMap((q: any) => q.dynamicFields || []);
  const appField = allDynamicFields.find((df: any) => df.entityId === 'appearance');
  assert.ok(appField, 'questionsFor must attach dynamic field for appearance');
  assert.ok(
    appField.extractedValue.includes('پدرام پای چپش لنگ میزنه در اثر تیر خوردن'),
    'dynamic field extractedValue must include Pedram limping trait'
  );
});

test('validateLLMEntitiesAndBuildAnswers validates LLM output for appearance, license_plate, and bank_account and categorizes them into answers', () => {
  const narrative = `امروز دیدم فردی که پای چپش لنگ میزنه با خودرو پژو پارس به شماره پلاک ۱۲ الف ۳۴۵ ایران ۶۶ فرار کرد و پول را به شماره کارت ۶۰۳۷۹۹۱۱۲۲۳۳۴۴۵۵ واریز کرد.`;
  // Simulate partial LLM output that missed Pedram/limping in appearance
  const partialLLMOutput = {
    event: 'fraud',
    events: ['fraud'],
    known: {
      when: 'امروز',
      source: 'مشاهده مستقیم گزارشگر',
    },
    entities: [],
  };

  const validated = validateLLMEntitiesAndBuildAnswers(partialLLMOutput, narrative);

  assert.ok(validated.answers, 'validated output must include structured answers object');
  assert.ok(validated.answers.appearance, 'answers must include appearance (مشخصات ظاهری افراد)');
  assert.equal(validated.answers.appearance.category, 'مشخصات ظاهری افراد');
  assert.ok(validated.answers.appearance.value.includes('لنگ میزنه'), 'appearance value must include limping trait');

  assert.ok(validated.answers.license_plate, 'answers must include license_plate (شماره پلاک خودرو)');
  assert.equal(validated.answers.license_plate.category, 'شماره پلاک خودرو');
  assert.ok(validated.answers.license_plate.fields.vehiclePlate.includes('۱۲ الف ۳۴۵'), 'vehiclePlate field must be populated');

  assert.ok(validated.answers.bank_account, 'answers must include bank_account (اطلاعات بانکی)');
  assert.equal(validated.answers.bank_account.category, 'اطلاعات بانکی');
  assert.ok(validated.answers.bank_account.fields.bankNumber.includes('۶۰۳۷۹۹۱۱۲۲۳۳۴۴۵۵'), 'bankNumber field must be populated');
});

test('Smart Conversation (گفتگوی هوشمند): AI initiates conversation, rejects chitchat/unconvincing answers, advances on logical answers, and locks upon completion', () => {
  let state = createSmartConversationInitialState();

  // 1. AI is the initiator of the conversation
  assert.equal(state.starter, 'ai');
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].role, 'ai');
  assert.equal(state.currentQuestion.id, 'incident');

  // 2. Rejects off-topic chitchat / greetings and does NOT advance
  state = evaluateSmartConversationTurn(state, 'سلام خوبی چه خبر؟');
  assert.equal(state.lastValidation.valid, false);
  assert.equal(state.lastValidation.reason, 'off_topic');
  assert.ok(
    state.lastValidation.feedback.includes('لطفاً پاسخ درست و مربوط دهید'),
    'feedback must include لطفاً پاسخ درست و مربوط دهید'
  );
  assert.equal(state.currentQuestion.id, 'incident');

  // 3. Rejects unconvincing / vague answer on incident stage
  state = evaluateSmartConversationTurn(state, 'نمیدونم');
  assert.equal(state.lastValidation.valid, false);
  assert.equal(state.lastValidation.reason, 'unconvincing');
  assert.ok(
    state.lastValidation.feedback.includes('لطفاً پاسخ درست و مربوط دهید'),
    'feedback must include لطفاً پاسخ درست و مربوط دهید'
  );
  assert.equal(state.currentQuestion.id, 'incident');

  // 4. Accepts logical incident answer (and automatically skips source & time because "دیروز" and "خرید کردم" are already in the answer!)
  state = evaluateSmartConversationTurn(
    state,
    'سلام وقت بخیر، دیروز از یک فروشگاه اینترنتی لباس خرید کردم اما بعد از پرداخت کالا را نفرستاد'
  );
  assert.equal(state.lastValidation.valid, true);
  // Greeting prefix "سلام وقت بخیر،" should be stripped
  assert.ok(!state.incidentText.startsWith('سلام'), 'greeting filler must be stripped from incidentText');
  // Since "خرید کردم" (source) and "دیروز" (time) were covered, next question must be person!
  assert.equal(state.currentQuestion.id, 'person');

  // 4b. Rejects irrelevant answer on person stage (e.g. talking about weather or random color) without advancing
  state = evaluateSmartConversationTurn(state, 'هوا خیلی بارانی بود');
  assert.equal(state.lastValidation.valid, false);
  assert.ok(
    state.lastValidation.feedback.includes('لطفاً پاسخ درست و مربوط دهید'),
    'person stage rejection must include لطفاً پاسخ درست و مربوط دهید'
  );
  assert.equal(state.currentQuestion.id, 'person');

  // 5. Answer remaining questions with logical answers until completion
  // Person
  state = evaluateSmartConversationTurn(state, 'شماره کارت ۶۰۳۷۹۹۱۱۲۲۳۳۴۴۵۵ به نام علی رضایی');
  assert.equal(state.lastValidation.valid, true);
  assert.equal(state.currentQuestion.id, 'place');

  // Place: test vague place rejection first
  state = evaluateSmartConversationTurn(state, 'توی محله ما');
  assert.equal(state.lastValidation.valid, false);
  assert.equal(state.lastValidation.reason, 'vague_place');
  assert.ok(
    state.lastValidation.feedback.includes('لطفاً پاسخ درست و مربوط دهید'),
    'place stage rejection must include لطفاً پاسخ درست و مربوط دهید'
  );
  assert.equal(state.currentQuestion.id, 'place');

  // Place: test irrelevant time-only answer on place stage
  state = evaluateSmartConversationTurn(state, 'ساعت پنج عصر');
  assert.equal(state.lastValidation.valid, false);
  assert.equal(state.currentQuestion.id, 'place');

  // Place: valid online platform answer ("لباس خرید کردم" already covered details, so it advances directly to reason!)
  state = evaluateSmartConversationTurn(state, 'صفحه اینستاگرام @poshak_arzani');
  assert.equal(state.lastValidation.valid, true);
  assert.equal(state.currentQuestion.id, 'reason');

  // Reason
  state = evaluateSmartConversationTurn(state, 'تبلیغات تخفیف ویژه در استوری');
  assert.equal(state.lastValidation.valid, true);
  assert.equal(state.currentQuestion.id, 'method');

  // Method
  state = evaluateSmartConversationTurn(state, 'کارت به کارت بانکی انجام دادم و بعد بلاک کرد');
  assert.equal(state.lastValidation.valid, true);
  assert.equal(state.done, true);
  assert.equal(state.inputLocked, true);
  assert.ok(state.compiledNarrative.includes('۶۰۳۷۹۹۱۱۲۲۳۳۴۴۵۵'));
  assert.ok(state.analysis?.answers?.bank_account, 'bank_account entity must be structured in final analysis');

  // 6. Once done, user is prevented from adding any extra talk
  const afterDone = evaluateSmartConversationTurn(state, 'راستی یه چیز دیگه هم میخواستم اضافه کنم');
  assert.equal(afterDone.lastValidation.valid, false);
  assert.equal(afterDone.lastValidation.reason, 'locked');
  assert.equal(afterDone.messages.length, state.messages.length);
});

test('Iranian Persian Neural TTS: prepareNaturalIranianSpeechText and generateSecMsGecV2 produce natural Tehrani speech text and valid v2 token', () => {
  const token = generateSecMsGecV2(1730000000);
  assert.match(token, /^[0-9A-F]{16}-[0-9A-F]{64}$/);

  const natural = prepareNaturalIranianSpeechText(
    'سلام، من دستیار صوتی راوی هستم. دقیقاً چه اتفاقی افتاده و موضوع گزارش شما چیست؟ (بدون حاشیه)'
  );
  assert.ok(!natural.includes('(بدون حاشیه)'), 'parenthetical notes must be stripped');
  assert.ok(
    natural.includes('موضوعِ گزارشِ شما چیست؟'),
    'must include natural Iranian Persian Ezafe and conversational phrasing'
  );

  const phonetic = phoneticizeForIranianNeuralTts(
    'سلام، من دستیارِ صوتیِ راوی هستم. آیا دربارهٔ دلیل یا انگیزهٔ این اتفاق اطلاعاتی دارید؟'
  );
  assert.ok(
    phonetic.includes('صُتیِ'),
    'صوتی must be phoneticized as صُتی so fa-IR-FaridNeural pronounces it /soti/ (/souti/) and never /sooti/'
  );
  assert.ok(!phonetic.includes('صوتی'), 'unvocalized صوتی must not remain in neural TTS phonetic string');
  assert.ok(
    phonetic.includes('درباره یِ') && phonetic.includes('انگیزه یِ'),
    'هٔ must be converted to ه یِ for natural Tehrani Ezafe pronunciation'
  );
});


