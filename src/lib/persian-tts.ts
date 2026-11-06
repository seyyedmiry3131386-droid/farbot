import crypto from 'crypto';
import WebSocket from 'ws';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const U32_MASK = 0xffffffffn;

const SHA256_INITIAL: bigint[] = [
  0x6a09e667n,
  0xbb67ae85n,
  0x3c6ef372n,
  0xa54ff53an,
  0x510e527fn,
  0x9b05688cn,
  0x1f83d9abn,
  0x5be0cd19n,
];

const SHA256_STATE: bigint[] = [
  0xfd9fbea2n,
  0x91243ce7n,
  0xbe499094n,
  0xcd2e1e0an,
  0x6c006f49n,
  0x04bd35abn,
  0xfeb0a7e4n,
  0x03effbd2n,
];

const SHA256_SCHEDULE: bigint[] = [
  0xeb24bf9en,
  0x1558691fn,
  0xa0c09ee2n,
  0x0cfa32ban,
  0xa622ee8cn,
  0xd1dd9491n,
  0xc0dd25a0n,
  0xf9e70ab6n,
  0xf0c31573n,
  0x7058ce4en,
  0x7188e606n,
  0x00e5ab33n,
  0xd258b060n,
  0x72766564n,
];

const SHA256_ROUND_CONSTANTS: bigint[] = [
  0x428a2f98n, 0x71374491n, 0xb5c0fbcfn, 0xe9b5dba5n, 0x3956c25bn, 0x59f111f1n, 0x923f82a4n, 0xab1c5ed5n,
  0xd807aa98n, 0x12835b01n, 0x243185ben, 0x550c7dc3n, 0x72be5d74n, 0x80deb1fen, 0x9bdc06a7n, 0xc19bf174n,
  0xe49b69c1n, 0xefbe4786n, 0x0fc19dc6n, 0x240ca1ccn, 0x2de92c6fn, 0x4a7484aan, 0x5cb0a9dcn, 0x76f988dan,
  0x983e5152n, 0xa831c66dn, 0xb00327c8n, 0xbf597fc7n, 0xc6e00bf3n, 0xd5a79147n, 0x06ca6351n, 0x14292967n,
  0x27b70a85n, 0x2e1b2138n, 0x4d2c6dfcn, 0x53380d13n, 0x650a7354n, 0x766a0abbn, 0x81c2c92en, 0x92722c85n,
  0xa2bfe8a1n, 0xa81a664bn, 0xc24b8b70n, 0xc76c51a3n, 0xd192e819n, 0xd6990624n, 0xf40e3585n, 0x106aa070n,
  0x19a4c116n, 0x1e376c08n, 0x2748774cn, 0x34b0bcb5n, 0x391c0cb3n, 0x4ed8aa4an, 0x5b9cca4fn, 0x682e6ff3n,
  0x748f82een, 0x78a5636fn, 0x84c87814n, 0x8cc70208n, 0x90befffan, 0xa4506cebn, 0xbef9a3f7n, 0xc67178f2n,
];

const SHA256_ADJUSTMENT = 0xc9dc06a7n;
const SHA256_BLOCK_CONSTANTS: bigint[] = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  SHA256_ADJUSTMENT,
  ...SHA256_ROUND_CONSTANTS.slice(15),
];

const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80n;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0n;

const CS64_COEFFICIENTS: Array<[bigint, bigint]> = [
  [0xe82e91b1n, 0xb32700d0n],
  [0x44de24c6n, 0x88dff51dn],
  [0x3beb65bcn, 0x29514038n],
  [0xc89c5933n, 0xb328cbdfn],
  [0x8d1ec211n, 0xd405b4d5n],
  [0x314ef5d5n, 0x26e55f3cn],
  [0xe92491b1n, 0x607801c6n],
  [0xf0a5b9d5n, 0x82b2c1fbn],
  [0x06064cf3n, 0xfa51a3dan],
  [0xda79fa60n, 0x207cc464n],
  [0xbed20560n, 0x3c3c74f3n],
  [0x89f9c9f8n, 0xd2d14b61n],
  [0x35fa38c6n, 0xbb04a2c1n],
  [0xcb49e3c6n, 0xc5626167n],
];

const CS64_FACTOR = 0x82893933n;
const CS64_ADJUSTMENT0 = 0xf2f90b1an;
const CS64_ADJUSTMENT1 = 0x0b1a0000n;

function rol16(value: bigint): bigint {
  const v = value & U32_MASK;
  return ((v << 16n) | (v >> 16n)) & U32_MASK;
}

function sigma0(value: bigint): bigint {
  return ((value >> 7n) ^ (value << 25n) ^ (value >> 18n) ^ (value << 14n) ^ (value >> 3n)) & U32_MASK;
}

function sigma1(value: bigint): bigint {
  return ((value >> 17n) ^ (value << 15n) ^ (value >> 19n) ^ (value << 13n) ^ (value >> 10n)) & U32_MASK;
}

function expandSha256Schedule(words: bigint[], firstWord = 16): void {
  for (let index = firstWord; index < 64; index++) {
    const x = words[index - 2];
    const y = words[index - 15];
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n);
    const s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n);
    words.push((s1 + words[index - 7] + s0 + words[index - 16]) & U32_MASK);
  }
}

function sha256Rounds(state: bigint[], words: bigint[], firstRound = 0): bigint[] {
  let [a, b, c, d, e, f, g, h] = state;
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;

  for (let index = firstRound; index < 64; index++) {
    const rotE = e * 0x100000001n;
    const rotA = a * 0x100000001n;
    const t1 =
      h +
      ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) +
      (g ^ (e & (f ^ g))) +
      constants[index] +
      words[index];
    const t2 = ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b)));
    h = g;
    g = f;
    f = e;
    e = (d + t1) & U32_MASK;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) & U32_MASK;
  }

  return [a, b, c, d, e, f, g, h];
}

function sha256Init(salt7: Buffer): bigint[] {
  const w14 = BigInt((salt7[0] << 16) | (salt7[1] << 8) | salt7[2]);
  const w15 = BigInt(salt7.readUInt32BE(3));
  const words: bigint[] = [...Array(14).fill(0n), w14, w15];

  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16];
    if (index - 2 >= 14) {
      value += index === 16 ? (sigma1(words[index - 2]) ^ SHA256_SIGMA1_ADJUSTMENT) : sigma1(words[index - 2]);
    }
    if (index - 7 >= 14) {
      value += words[index - 7];
    }
    if (index - 15 >= 14) {
      value += index === 29 ? (sigma0(words[index - 15]) ^ SHA256_SIGMA0_ADJUSTMENT) : sigma0(words[index - 15]);
    }
    words.push(value & U32_MASK);
  }

  words.push(
    (sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA256_ADJUSTMENT - SHA256_ROUND_CONSTANTS[14]) &
      U32_MASK
  );

  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  return SHA256_INITIAL.map((x, idx) => (x + working[idx]) & U32_MASK);
}

function sha256Digest(data: Buffer): Buffer {
  const length = 57 + data.length;
  const zeroPadLen = (((55 - length) % 64) + 64) % 64;
  const tail = data.subarray(7);
  const lenBuf = Buffer.alloc(8);
  lenBuf.writeBigUInt64BE(BigInt(length * 8));

  const padded = Buffer.concat([tail, Buffer.from([0x80]), Buffer.alloc(zeroPadLen), lenBuf]);
  let state = sha256Init(data.subarray(0, 7));

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: bigint[] = [];
    for (let i = 0; i < 16; i++) {
      words.push(BigInt(padded.readUInt32BE(offset + i * 4)));
    }
    expandSha256Schedule(words);
    const working = sha256Rounds(state, words);
    state = state.map((x, idx) => (x + working[idx]) & U32_MASK);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32BE(Number(state[i]), i * 4);
  }
  return out;
}

function wordsLe4Even(data: Buffer): bigint[] {
  const padLen = (4 - (data.length % 4)) % 4;
  const padded = padLen > 0 ? Buffer.concat([data, Buffer.alloc(padLen)]) : data;
  const words: bigint[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(BigInt(padded.readUInt32LE(i)));
  }
  if (words.length % 2 !== 0) {
    words.push(0n);
  }
  return words;
}

function cs64Digest(data: Buffer, digest: Buffer): [bigint, bigint] {
  const keyA = BigInt(digest.readUInt32LE(0)) | 1n;
  const keyB = BigInt(digest.readUInt32LE(4)) | 1n;
  const factors: [bigint, bigint] = [(keyA * CS64_FACTOR) & U32_MASK, (keyB * CS64_FACTOR) & U32_MASK];

  const terms: bigint[] = CS64_COEFFICIENTS.map(([coeff], idx) => (coeff * factors[idx % 2]) & U32_MASK);
  const offsets: bigint[] = CS64_COEFFICIENTS.map(([, off]) => off);

  const words = wordsLe4Even(Buffer.concat([Buffer.from([0x00]), data]));
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    let term = word * (index % 2 === 0 ? keyA : keyB);
    let offset = rol16(word) * (index % 2 === 0 ? 0xef0569fbn : 0xc31713dbn);
    if (index === 0) {
      term += CS64_ADJUSTMENT0 * factors[0];
      offset += CS64_ADJUSTMENT1;
    }
    terms.push(term & U32_MASK);
    offsets.push(offset & U32_MASK);
  }

  let swapAcc = 0n;
  let swapLast = 0n;
  let state = 0n;
  let acc = 0n;

  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index];
    const y = terms[index + 1];

    let t = rol16((offsets[index] + x) & U32_MASK);
    let q = (t * 0x76f50f34n) & U32_MASK;
    swapAcc += (rol16(q) * 0xc3efea97n + q) & U32_MASK;

    t = rol16((offsets[index + 1] + y) & U32_MASK);
    q = (t * 0x1881ce3cn) & U32_MASK;
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & U32_MASK;
    swapAcc = (swapAcc + swapLast) & U32_MASK;

    state = (state * keyA + x) & U32_MASK;
    state = (rol16(state) * 0xcf98b111n) & U32_MASK;
    state = (rol16(state) * 0x87085b9fn) & U32_MASK;
    state = (rol16(state) * 0x12ceb96dn) & U32_MASK;
    state = (rol16(state) * 0x257e1d83n) & U32_MASK;
    acc += state;

    t = (state * keyB + y) & U32_MASK;
    t = (rol16(t) * 0xa27416f5n) & U32_MASK;
    t = (rol16(t) * 0xd38396ffn) & U32_MASK;
    state = (rol16((rol16(t) * 0x7c932b89n) & U32_MASK) * 0xbfa49f69n) & U32_MASK;
    acc = (acc + state) & U32_MASK;
  }

  return [(swapLast ^ state) & U32_MASK, (swapAcc ^ acc) & U32_MASK];
}

let clockSkewSeconds = 0;

export function generateSecMsGecV2(unixTimestampSec?: number): string {
  let ticks = unixTimestampSec !== undefined ? unixTimestampSec : Date.now() / 1000 + clockSkewSeconds;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  const ticks100ns = Math.round(ticks) * (S_TO_NS / 100);
  const strToHash = Buffer.from(`${ticks100ns.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, 'ascii');
  const digest = sha256Digest(strToHash);
  const [cs0, cs1] = cs64Digest(strToHash, digest);
  const csBuf = Buffer.alloc(8);
  csBuf.writeUInt32LE(Number(cs0), 0);
  csBuf.writeUInt32LE(Number(cs1), 4);
  return `${csBuf.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`;
}

export function prepareNaturalIranianSpeechText(rawText: string): string {
  return String(rawText || '')
    .replace(/\u200c/g, ' ')
    .replace(/[«»"']/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/موضوع گزارش شما/g, 'موضوعِ گزارشِ شما')
    .replace(/دستیار صوتی راوی/g, 'دستیارِ صوتیِ راوی')
    .replace(/زمان دقیق وقوع/g, 'زمانِ دقیقِ وقوع')
    .replace(/محل دقیق وقوع/g, 'محلِ دقیقِ وقوع')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts orthographic Persian words that neural G2P models misread (such as reading «صوتی» as «سوتی» sooti)
 * into their exact Iranian Tehrani phonetic form for SSML synthesis.
 */
export function phoneticizeForIranianNeuralTts(rawText: string): string {
  const base = prepareNaturalIranianSpeechText(rawText);
  return base
    // Fix «صوتی» so it is pronounced /souti/ (/soti/) and NEVER /sooti/ («سوتی»)
    .replace(/صوتیِ/g, 'صُتیِ')
    .replace(/صوتی/g, 'صُتی')
    .replace(/صوت/g, 'صُت')
    // Fix «هٔ» (hamza above heh) so it is pronounced as smooth Ezafe «ه یِ» and never «ه ای»
    .replace(/هٔ\s*/g, 'ه یِ ')
    .replace(/ه‌ی\s+/g, 'ه یِ ')
    // Natural Iranian Persian Ezafe & vowel precision on common police/reporting phrases
    .replace(/نحوه اطلاع/g, 'نحوه یِ اِطّلاعِ')
    .replace(/افراد مرتبط/g, 'افرادِ مُرتَبِط')
    .replace(/فاعل آن/g, 'فاعِلِ آن')
    .replace(/پاسخ درست و مربوط دهید/g, 'پاسُخِ دُرُست و مَربوط بِدَهید')
    .replace(/تدوین گزارش شما/g, 'تَدوینِ گُزارِشِ شُما')
    .replace(/متن نهایی/g, 'مَتنِ نَهایی')
    .replace(/کلاهبرداری اینترنتی/g, 'کُلاهبرداریِ اینتِرنِتی')
    .replace(/فروشگاه اینترنتی/g, 'فُروشگاهِ اینتِرنِتی')
    .replace(/فضای مجازی/g, 'فَضایِ مَجازی')
    .replace(/مواد مخدر/g, 'مَوادِّ مُخَدِّر')
    .replace(/سلاح گرم/g, 'سِلاحِ گَرم')
    .replace(/سلاح سرد/g, 'سِلاحِ سَرد')
    .replace(/وسیله نقلیه/g, 'وَسیله یِ نَقلیه')
    .replace(/شماره تماس/g, 'شُماره یِ تَماس')
    .replace(/شماره کارت/g, 'شُماره یِ کارت')
    .replace(/صاحب حساب/g, 'صاحِبِ حِساب')
    .replace(/گرداننده صفحه/g, 'گَردانَنده یِ صَفحه')
    .replace(/شروع کننده درگیری/g, 'شُروع کُنَنده یِ دَرگیری')
    .replace(/عاملان سرقت/g, 'عامِلانِ سِرقَت')
    .replace(/سارقین/g, 'سارِقین')
    .replace(/سرقت/g, 'سِرقَت')
    .replace(/رخ داد/g, 'رُخ داد')
    .replace(/رخداد/g, 'رُخداد')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXmlForSsml(rawText: string): string {
  const cleaned = phoneticizeForIranianNeuralTts(rawText);
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const ttsAudioCache = new Map<string, string>();

/**
 * Synthesizes natural, warm, human Iranian Persian (fa-IR, Tehrani accent) MP3 speech
 * using Microsoft Neural voices (fa-IR-DilaraNeural / fa-IR-FaridNeural).
 */
export async function synthesizeIranianPersianNeuralMp3(
  text: string,
  voice: 'fa-IR-FaridNeural' | 'fa-IR-DilaraNeural' = 'fa-IR-FaridNeural'
): Promise<string | null> {
  const cleanText = prepareNaturalIranianSpeechText(text);
  if (!cleanText) return null;

  const cacheKey = `${voice}::${cleanText}`;
  const cached = ttsAudioCache.get(cacheKey);
  if (cached) return cached;

  const attemptConnect = (allowRetrySkew = true): Promise<string | null> =>
    new Promise((resolve) => {
      const secGec = generateSecMsGecV2();
      const muid = crypto.randomBytes(16).toString('hex').toUpperCase();
      const connId = crypto.randomUUID().replace(/-/g, '');
      const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

      const ws = new WebSocket(url, {
        headers: {
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
          Cookie: `muid=${muid};`,
        },
        handshakeTimeout: 6000,
      });

      const audioChunks: Buffer[] = [];
      let settled = false;
      const done = (val: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          ws.close();
        } catch {}
        resolve(val);
      };

      const timeoutId = setTimeout(() => {
        done(audioChunks.length > 0 ? Buffer.concat(audioChunks).toString('base64') : null);
      }, 8000);

      ws.on('open', () => {
        const nowStr = new Date().toUTCString();
        const configMsg =
          `X-Timestamp:${nowStr}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
        ws.send(configMsg);

        const reqId = crypto.randomUUID().replace(/-/g, '');
        const ssmlContent = escapeXmlForSsml(cleanText);
        // Natural Iranian Tehrani male intonation (fa-IR-FaridNeural)
        const pitchVal = voice === 'fa-IR-FaridNeural' ? '+0Hz' : '+2Hz';
        const ssml =
          `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fa-IR">` +
          `<voice name="${voice}">` +
          `<prosody pitch="${pitchVal}" rate="+5%" volume="+5%">${ssmlContent}</prosody>` +
          `</voice>` +
          `</speak>`;
        const ssmlMsg =
          `X-RequestId:${reqId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${nowStr}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml;
        ws.send(ssmlMsg);
      });

      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          const buf = Buffer.from(data as ArrayBuffer);
          if (buf.length > 2) {
            const headerLen = buf.readUInt16BE(0);
            const audioData = buf.subarray(2 + headerLen);
            if (audioData.length > 0) {
              audioChunks.push(audioData);
            }
          }
        } else {
          const txt = data.toString();
          if (txt.includes('Path:turn.end')) {
            const combined = Buffer.concat(audioChunks);
            done(combined.length > 200 ? combined.toString('base64') : null);
          }
        }
      });

      ws.on('unexpected-response', (_req, res) => {
        const serverDate = res.headers?.date;
        if (serverDate && allowRetrySkew) {
          const parsedMs = Date.parse(serverDate);
          if (!Number.isNaN(parsedMs)) {
            clockSkewSeconds = parsedMs / 1000 - Date.now() / 1000;
            settled = true;
            clearTimeout(timeoutId);
            try {
              ws.close();
            } catch {}
            attemptConnect(false).then(resolve);
            return;
          }
        }
        done(null);
      });

      ws.on('error', () => {
        done(null);
      });
    });

  const result = await attemptConnect(true);
  if (result) {
    if (ttsAudioCache.size > 60) {
      const oldestKey = ttsAudioCache.keys().next().value;
      if (oldestKey) ttsAudioCache.delete(oldestKey);
    }
    ttsAudioCache.set(cacheKey, result);
  }
  return result;
}

export const synthesizeIranianPersianNeuralTts = synthesizeIranianPersianNeuralMp3;

