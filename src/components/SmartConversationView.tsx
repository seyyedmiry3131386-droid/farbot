import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import {
  createSmartConversationInitialState,
  evaluateSmartConversationTurn,
  VITAL_PARAMETERS,
} from '../lib/domain.js';
import { createDictation, speechSupported } from '../lib/speech.js';
import { LiquidVoiceOrb, OrbVoicePhase } from './LiquidVoiceOrb.tsx';

interface SmartConversationViewProps {
  initialText?: string;
  onCompleteReport: (payload: {
    narrative: string;
    analysis: any;
    answers: Record<string, any>;
    extra: Record<string, any>;
    turns: Array<{ q: string; a: string }>;
  }) => void;
  onBack: () => void;
}

export const SmartConversationView: React.FC<SmartConversationViewProps> = ({
  initialText = '',
  onCompleteReport,
  onBack,
}) => {
  const [chatState, setChatState] = useState<any>(() =>
    createSmartConversationInitialState(initialText)
  );
  const [phase, setPhase] = useState<OrbVoicePhase>('ai-speaking');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioBands, setAudioBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('در حال طرح سؤال توسط هوش مصنوعی');
  const [micMuted, setMicMuted] = useState<boolean>(false);

  const chatStateRef = useRef<any>(chatState);
  const phaseRef = useRef<OrbVoicePhase>(phase);
  const micMutedRef = useRef<boolean>(micMuted);
  const mountedRef = useRef<boolean>(true);

  // Audio & speech refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserRafRef = useRef<number>(0);
  const cadenceTimerRef = useRef<any>(null);
  const dictationRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const spokenTextRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const maxRecordTimerRef = useRef<any>(null);
  const hasDetectedVoiceRef = useRef<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const lastSpokenQuestionKeyRef = useRef<string>('');

  const getOrCreateAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        return audioCtxRef.current;
      }
      const shared = (window as any).__raviSharedAudioCtx as AudioContext | undefined;
      if (shared && shared.state !== 'closed') {
        audioCtxRef.current = shared;
        return shared;
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      (window as any).__raviSharedAudioCtx = ctx;
      audioCtxRef.current = ctx;
      return ctx;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    chatStateRef.current = chatState;
  }, [chatState]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  const stopCadenceSimulation = useCallback(() => {
    if (cadenceTimerRef.current) {
      clearInterval(cadenceTimerRef.current);
      cadenceTimerRef.current = null;
    }
  }, []);

  const stopAnalyserLoop = useCallback(() => {
    if (analyserRafRef.current) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = 0;
    }
  }, []);

  const stopAllAudioAndMic = useCallback(() => {
    stopCadenceSimulation();
    stopAnalyserLoop();

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }

    if (ttsSourceRef.current) {
      try {
        ttsSourceRef.current.onended = null;
        ttsSourceRef.current.stop();
      } catch {}
      ttsSourceRef.current = null;
    }

    if (htmlAudioRef.current) {
      try {
        htmlAudioRef.current.onended = null;
        htmlAudioRef.current.onerror = null;
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
      } catch {}
      htmlAudioRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    if (dictationRef.current) {
      try {
        dictationRef.current.stop();
      } catch {}
      dictationRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (mountedRef.current) {
      setAudioLevel(0);
      setAudioBands([0, 0, 0, 0, 0, 0, 0, 0]);
    }
  }, [stopAnalyserLoop, stopCadenceSimulation]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAllAudioAndMic();
    };
  }, [stopAllAudioAndMic]);

  // Drives realistic syllabic voice vibration on the liquid orb when using fallback TTS or phonetic pulses
  const startCadenceSimulation = useCallback(
    (durationMs: number, onComplete?: () => void) => {
      stopCadenceSimulation();
      const startTime = Date.now();
      cadenceTimerRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        const elapsed = Date.now() - startTime;
        if (elapsed >= durationMs) {
          stopCadenceSimulation();
          setAudioLevel(0);
          setAudioBands([0, 0, 0, 0, 0, 0, 0, 0]);
          onComplete?.();
          return;
        }
        // Natural syllabic modulation (3.5 Hz syllable rate + 7 Hz formant harmonic)
        const s1 = Math.abs(Math.sin(elapsed * 0.011));
        const s2 = Math.abs(Math.cos(elapsed * 0.023));
        const pauseEnvelope = Math.sin(elapsed * 0.0035) > -0.65 ? 1 : 0.15;
        const level = Math.min(0.95, (0.28 + s1 * 0.42 + s2 * 0.25) * pauseEnvelope);
        setAudioLevel(level);
        setAudioBands([
          level * 0.9,
          level * (0.7 + s1 * 0.3),
          level * (0.8 + s2 * 0.2),
          level,
          level * (0.65 + s1 * 0.35),
          level * (0.55 + s2 * 0.4),
          level * 0.75,
          level * 0.6,
        ]);
      }, 40);
    },
    [stopCadenceSimulation]
  );

  // Submit user's spoken answer to the AI interview controller
  const submitSpokenAnswer = useCallback(
    async (rawSpokenText: string) => {
      const cleaned = rawSpokenText.trim();
      if (!cleaned || submittingRef.current || chatStateRef.current.done) return;

      submittingRef.current = true;
      stopAllAudioAndMic();
      setPhase('processing');
      setStatusMessage('در حال بررسی پاسخ شما');
      setLiveTranscript(cleaned);

      try {
        const res = await fetch('/api/smart-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: chatStateRef.current,
            answer: cleaned,
          }),
        });

        let nextState: any;
        if (res.ok) {
          nextState = await res.json();
        } else {
          nextState = evaluateSmartConversationTurn(chatStateRef.current, cleaned);
        }

        if (!mountedRef.current) return;
        setLiveTranscript('');
        setChatState(nextState);
      } catch {
        if (!mountedRef.current) return;
        const nextState = evaluateSmartConversationTurn(chatStateRef.current, cleaned);
        setLiveTranscript('');
        setChatState(nextState);
      } finally {
        submittingRef.current = false;
      }
    },
    [stopAllAudioAndMic]
  );

  // Transcribe recorded audio blob via /api/transcribe when browser SpeechRecognition is unavailable
  const transcribeAndSubmitBlob = useCallback(
    async (blob: Blob) => {
      if (!blob || blob.size < 300 || submittingRef.current) {
        if (mountedRef.current && !chatStateRef.current.done && !micMutedRef.current) {
          startListeningForUser();
        }
        return;
      }

      setPhase('processing');
      setStatusMessage('در حال پردازش گفتار فارسی شما');
      setAudioLevel(0.25);

      try {
        const fd = new FormData();
        fd.append('file', blob, blob.type?.includes('mp4') ? 'voice.m4a' : 'voice.webm');
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data?.text && data.text.trim()) {
          await submitSpokenAnswer(data.text.trim());
        } else {
          if (mountedRef.current) {
            setStatusMessage('صدایی تشخیص داده نشد، دوباره صحبت کنید');
            startListeningForUser();
          }
        }
      } catch {
        if (mountedRef.current) {
          setStatusMessage('خطا در دریافت صدا، دوباره صحبت کنید');
          startListeningForUser();
        }
      }
    },
    [submitSpokenAnswer]
  );

  // Start listening to user's microphone with real-time liquid orb audio reactivity + auto-silence turn detection
  const startListeningForUser = useCallback(async () => {
    if (!mountedRef.current || chatStateRef.current.done || submittingRef.current) return;
    if (micMutedRef.current) {
      setPhase('idle');
      setStatusMessage('میکروفون متوقف است');
      return;
    }

    stopAllAudioAndMic();
    spokenTextRef.current = '';
    hasDetectedVoiceRef.current = false;
    setLiveTranscript('');
    setPhase('listening');
    setStatusMessage('نوبت شماست، با صدا پاسخ دهید');

    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    const hasBrowserSpeech = speechSupported();

    // Schedule auto-submit after user finishes speaking a sentence
    const resetSilenceAutoSubmit = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || phaseRef.current !== 'listening') return;
        if (spokenTextRef.current.trim().length >= 2) {
          submitSpokenAnswer(spokenTextRef.current.trim());
        } else if (
          hasDetectedVoiceRef.current &&
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      }, 1850);
    };

    // 1. Start Browser SpeechRecognition if supported
    if (hasBrowserSpeech) {
      try {
        const dict = createDictation({
          lang: 'fa-IR',
          onPartial: (part: string) => {
            if (!mountedRef.current) return;
            const full = spokenTextRef.current
              ? `${spokenTextRef.current} ${part}`.trim()
              : part.trim();
            setLiveTranscript(full);
            hasDetectedVoiceRef.current = true;
            // Boost orb vibration on recognized syllables even if getUserMedia is not attached on mobile
            if (isMobile) {
              const boost = Math.min(0.92, 0.35 + (part.length % 5) * 0.12);
              setAudioLevel(boost);
              setAudioBands([boost, boost * 0.8, boost * 0.9, boost, boost * 0.7, boost * 0.85, boost * 0.65, boost * 0.5]);
              setTimeout(() => {
                if (mountedRef.current && phaseRef.current === 'listening') {
                  setAudioLevel(0.12);
                }
              }, 240);
            }
            resetSilenceAutoSubmit();
          },
          onFinal: (finalSentence: string) => {
            if (!mountedRef.current) return;
            spokenTextRef.current = spokenTextRef.current
              ? `${spokenTextRef.current} ${finalSentence.trim()}`
              : finalSentence.trim();
            setLiveTranscript(spokenTextRef.current);
            hasDetectedVoiceRef.current = true;
            resetSilenceAutoSubmit();
          },
          onError: (_msg: string, code?: string) => {
            dictationRef.current = null;
            if (code === 'not-allowed') {
              setStatusMessage('لطفاً مجوز دسترسی به میکروفون را فعال کنید');
              setPhase('idle');
            }
          },
        });
        dictationRef.current = dict;
        dict.start();
      } catch {}
    }

    // 2. Open Web Audio API Analyser + MediaRecorder fallback
    if (!isMobile || !hasBrowserSpeech) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mountedRef.current || phaseRef.current !== 'listening') {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        const ctx = getOrCreateAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }

          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;
          source.connect(analyser);
          analyserRef.current = analyser;

          const freqData = new Uint8Array(analyser.frequencyBinCount);

          const updateMicVisuals = () => {
            if (!mountedRef.current || phaseRef.current !== 'listening') return;
            analyser.getByteFrequencyData(freqData);

            let sum = 0;
            const bands: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
            const binStep = Math.max(1, Math.floor(freqData.length / 16));

            for (let b = 0; b < 8; b++) {
              let bandSum = 0;
              for (let k = 0; k < binStep; k++) {
                const val = freqData[b * binStep + k] || 0;
                bandSum += val;
                sum += val;
              }
              bands[b] = Math.min(1, bandSum / (binStep * 185));
            }

            const avgLevel = Math.min(1, sum / (8 * binStep * 150));
            setAudioLevel(avgLevel);
            setAudioBands(bands);

            // Voice Activity Detection (VAD) for hands-free auto-turn
            if (avgLevel > 0.16) {
              hasDetectedVoiceRef.current = true;
              resetSilenceAutoSubmit();
            }

            analyserRafRef.current = requestAnimationFrame(updateMicVisuals);
          };
          analyserRafRef.current = requestAnimationFrame(updateMicVisuals);
        }

        // Also record audio chunks if browser SpeechRecognition is not used
        if (!hasBrowserSpeech && typeof MediaRecorder !== 'undefined') {
          recordedChunksRef.current = [];
          const mime = MediaRecorder.isTypeSupported?.('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported?.('audio/mp4')
            ? 'audio/mp4'
            : '';
          const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          mediaRecorderRef.current = mr;
          mr.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          mr.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: mr.mimeType || 'audio/webm' });
            if (!spokenTextRef.current.trim()) {
              transcribeAndSubmitBlob(blob);
            }
          };
          mr.start(350);
        }
      } catch {
        // If microphone stream isn't granted, keep UI responsive
      }
    }
  }, [getOrCreateAudioContext, stopAllAudioAndMic, submitSpokenAnswer, transcribeAndSubmitBlob]);

  // Speak AI question or warning out loud via real audio + liquid orb vibration, then automatically listen!
  const speakAiText = useCallback(
    async (textToSpeak: string, autoListenAfter = true) => {
      if (!mountedRef.current) return;
      const cleanText = textToSpeak.replace(/\s*\([^)]*\)/g, '').trim();
      if (!cleanText) {
        if (autoListenAfter) startListeningForUser();
        return;
      }

      stopAllAudioAndMic();
      setPhase('ai-speaking');
      setStatusMessage('در حال پرسش صوتی توسط هوش مصنوعی');

      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
      const estimatedDurationMs = Math.max(2200, Math.min(6800, wordCount * 380));

      let speechFinished = false;
      const finishAiSpeech = () => {
        if (speechFinished || !mountedRef.current) return;
        speechFinished = true;
        stopCadenceSimulation();
        stopAnalyserLoop();
        setAudioLevel(0);
        setAudioBands([0, 0, 0, 0, 0, 0, 0, 0]);
        if (autoListenAfter && !chatStateRef.current.done) {
          startListeningForUser();
        } else if (chatStateRef.current.done) {
          setPhase('done');
          setStatusMessage('گفتگو به پایان رسید');
        } else {
          setPhase('idle');
        }
      };

      // 1. Fetch synthesized Iranian Persian (fa-IR) male neural speech audio from /api/tts
      try {
        let res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, voice: 'male' }),
        });
        if (!res.ok) {
          res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText, voice: 'male' }),
          });
        }

        if (res.ok) {
          const data = await res.json();
          if (data?.audio && mountedRef.current && phaseRef.current === 'ai-speaking') {
            const mimeType = data.mimeType || 'audio/mpeg';

            // Try Web Audio API first so the Liquid Orb vibrates to exact voice frequencies
            const ctx = getOrCreateAudioContext();
            if (ctx) {
              try {
                if (ctx.state === 'suspended') {
                  await ctx.resume().catch(() => {});
                }

                const binaryString = atob(data.audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                const decodedBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
                if (!mountedRef.current || phaseRef.current !== 'ai-speaking') return;

                if (ctx.state === 'running') {
                  const source = ctx.createBufferSource();
                  source.buffer = decodedBuffer;

                  const analyser = ctx.createAnalyser();
                  analyser.fftSize = 256;
                  analyser.smoothingTimeConstant = 0.7;
                  source.connect(analyser);
                  analyser.connect(ctx.destination);

                  ttsSourceRef.current = source;
                  analyserRef.current = analyser;

                  const freqData = new Uint8Array(analyser.frequencyBinCount);
                  const updateAiVisuals = () => {
                    if (!mountedRef.current || phaseRef.current !== 'ai-speaking') return;
                    analyser.getByteFrequencyData(freqData);
                    let sum = 0;
                    const bands: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
                    const binStep = Math.max(1, Math.floor(freqData.length / 16));
                    for (let b = 0; b < 8; b++) {
                      let bSum = 0;
                      for (let k = 0; k < binStep; k++) {
                        const v = freqData[b * binStep + k] || 0;
                        bSum += v;
                        sum += v;
                      }
                      bands[b] = Math.min(1, bSum / (binStep * 170));
                    }
                    const avg = Math.min(1, sum / (8 * binStep * 140));
                    setAudioLevel(avg);
                    setAudioBands(bands);
                    analyserRafRef.current = requestAnimationFrame(updateAiVisuals);
                  };
                  analyserRafRef.current = requestAnimationFrame(updateAiVisuals);

                  source.onended = () => {
                    ttsSourceRef.current = null;
                    finishAiSpeech();
                  };
                  source.start(0);
                  return;
                }
              } catch {
                // Fall through to HTMLAudioElement playback
              }
            }

            // Fallback HTML5 Audio element playback + synchronized liquid orb cadence
            try {
              const audioEl = new Audio(`data:${mimeType};base64,${data.audio}`);
              htmlAudioRef.current = audioEl;
              startCadenceSimulation(estimatedDurationMs + 1200, finishAiSpeech);
              audioEl.onended = () => {
                htmlAudioRef.current = null;
                finishAiSpeech();
              };
              audioEl.onerror = () => {
                htmlAudioRef.current = null;
              };
              await audioEl.play();
              return;
            } catch {
              // Fall through to browser SpeechSynthesis
            }
          }
        }
      } catch {
        // Fall through to local Web Speech API + syllabic cadence simulation
      }

      if (!mountedRef.current) return;

      // 2. Fallback: Browser SpeechSynthesis (ONLY if a genuine fa-IR voice exists; never use Dari/Afghan/Urdu)
      const speechStart = Date.now();
      startCadenceSimulation(estimatedDurationMs, finishAiSpeech);

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.resume?.();
          const voices = window.speechSynthesis.getVoices?.() || [];
          // Strictly select Iranian Persian (fa-IR) and exclude Afghan Dari (fa-AF / prs), Urdu, or Arabic
          const faIrVoice =
            voices.find(
              (v) =>
                /^fa[-_]?IR/i.test(v.lang) &&
                !/afghan|dari|prs|kabul|urdu|arab/i.test(`${v.lang} ${v.name}`)
            ) ||
            voices.find(
              (v) =>
                (/^fa$/i.test(v.lang) || /persian|farsi/i.test(v.name)) &&
                !/fa[-_]?AF|dari|prs|afghan|kabul|urdu|arab/i.test(`${v.lang} ${v.name}`)
            );
          if (faIrVoice) {
            const utter = new SpeechSynthesisUtterance(cleanText);
            utter.voice = faIrVoice;
            utter.lang = 'fa-IR';
            utter.rate = 1.0;
            utter.pitch = 1.0;
            utter.onend = () => {
              if (Date.now() - speechStart > 450) {
                finishAiSpeech();
              }
            };
            utter.onerror = () => {};
            window.speechSynthesis.speak(utter);
          }
        } catch {}
      }
    },
    [
      getOrCreateAudioContext,
      startCadenceSimulation,
      startListeningForUser,
      stopAllAudioAndMic,
      stopAnalyserLoop,
      stopCadenceSimulation,
    ]
  );

  // Automatically trigger AI voice whenever the current question or validation state updates
  useEffect(() => {
    if (chatState.done) {
      const doneKey = 'done-summary';
      if (lastSpokenQuestionKeyRef.current !== doneKey) {
        lastSpokenQuestionKeyRef.current = doneKey;
        speakAiText('سپاسگزارم، تدوین گزارشِ شما تکمیل شد. لطفاً متنِ نهایی را بررسی و تأیید بفرمایید.', false);
      }
      return;
    }

    const currentQ = chatState.currentQuestion;
    if (!currentQ) return;

    const lastVal = chatState.lastValidation;
    const isRejected = lastVal && !lastVal.valid && lastVal.feedback;
    const turnCount = (chatState.messages || []).length;
    const stateKey = `${currentQ.id}-${turnCount}-${isRejected ? 'warn' : 'ok'}`;

    if (lastSpokenQuestionKeyRef.current !== stateKey) {
      lastSpokenQuestionKeyRef.current = stateKey;
      const cleanQ = (currentQ.title || '').replace(/\s*\([^)]*\)/g, '').trim();

      if (isRejected) {
        speakAiText(`لطفاً پاسخ درست و مربوط دهید. ${cleanQ}`, true);
      } else if (turnCount <= 1 && currentQ.id === 'incident') {
        speakAiText(`سلام، من دستیار صوتی راوی هستم. ${cleanQ}`, true);
      } else {
        const naturalTransitions = ['بسیار خب، ', 'متوجه شدم؛ ', 'سپاسگزارم، '];
        const prefix = naturalTransitions[turnCount % naturalTransitions.length];
        speakAiText(`${prefix}${cleanQ}`, true);
      }
    }
  }, [chatState, speakAiText]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__raviSubmitSmartVoiceTurn = submitSpokenAnswer;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__raviSubmitSmartVoiceTurn;
      }
    };
  }, [submitSpokenAnswer]);

  const handleOrbClick = () => {
    if (chatState.done) return;

    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // If AI is currently speaking, tapping the orb interrupts AI and immediately lets the user speak
    if (phase === 'ai-speaking') {
      startListeningForUser();
      return;
    }

    // If listening and user has already spoken words, tapping the orb immediately submits the turn
    if (phase === 'listening') {
      if (spokenTextRef.current.trim().length >= 2) {
        submitSpokenAnswer(spokenTextRef.current.trim());
        return;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' && hasDetectedVoiceRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        return;
      }
      // Otherwise toggle mute
      setMicMuted(true);
      stopAllAudioAndMic();
      setPhase('idle');
      setStatusMessage('میکروفون متوقف شد — برای ادامه روی گوی بزنید');
      return;
    }

    if (phase === 'idle') {
      setMicMuted(false);
      micMutedRef.current = false;
      startListeningForUser();
    }
  };

  const handleToggleMic = () => {
    if (chatState.done) return;
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (micMuted || phase === 'idle') {
      setMicMuted(false);
      micMutedRef.current = false;
      startListeningForUser();
    } else if (phase === 'listening' && spokenTextRef.current.trim().length >= 2) {
      submitSpokenAnswer(spokenTextRef.current.trim());
    } else {
      setMicMuted(true);
      micMutedRef.current = true;
      stopAllAudioAndMic();
      setPhase('idle');
      setStatusMessage('میکروفون متوقف است');
    }
  };

  const handleRepeatQuestion = () => {
    if (chatState.done || !chatState.currentQuestion) return;
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const cleanQ = (chatState.currentQuestion.title || '').replace(/\s*\([^)]*\)/g, '').trim();
    speakAiText(cleanQ, true);
  };

  const handleSkipStage = () => {
    if (chatState.done || submittingRef.current) return;
    submitSpokenAnswer('اطلاعی ندارم');
  };

  const handleResetConversation = () => {
    stopAllAudioAndMic();
    lastSpokenQuestionKeyRef.current = '';
    setLiveTranscript('');
    setMicMuted(false);
    micMutedRef.current = false;
    setChatState(createSmartConversationInitialState(''));
  };

  const handleTransferToReport = () => {
    stopAllAudioAndMic();
    const finalAnalysis = chatState.analysis;
    onCompleteReport({
      narrative: chatState.compiledNarrative || chatState.incidentText || '',
      analysis: finalAnalysis,
      answers: finalAnalysis?.answers || {},
      extra: finalAnalysis?.extra || {},
      turns: (chatState.turns || []).map((t: any) => ({ q: t.q, a: t.a })),
    });
  };

  const currentQuestion = chatState.currentQuestion;
  const currentStageId = currentQuestion?.id || 'incident';
  const cleanQuestionTitle = (currentQuestion?.title || '').replace(/\s*\([^)]*\)/g, '').trim();

  const allProgressStages = ['incident', ...VITAL_PARAMETERS];
  const currentStageIdx = Math.max(0, allProgressStages.indexOf(currentStageId));

  const lastValidation = chatState.lastValidation;
  const showWarning = lastValidation && !lastValidation.valid && lastValidation.feedback;

  return (
    <div className="w-full max-w-2xl mx-auto animate-arrive text-right">
      <div
        className="relative rounded-3xl overflow-hidden shadow-xl border border-emerald-900/50 flex flex-col justify-between min-h-[430px] sm:min-h-[520px]"
        style={{
          background:
            'radial-gradient(circle at 22% 18%, #164e3e 0%, #0d2b22 42%, #091915 100%)',
        }}
      >
        {/* Minimal Top Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-800/30 bg-black/15 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm sm:text-base font-bold text-emerald-50">
              گفتگوی هوشمند
            </h2>
            {!chatState.done && (
              <span className="text-xs text-emerald-300/80 font-medium">
                گام {(currentStageIdx + 1).toLocaleString('fa-IR')} از{' '}
                {allProgressStages.length.toLocaleString('fa-IR')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetConversation}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-emerald-100 flex items-center justify-center transition cursor-pointer"
              title="شروع مجدد"
              aria-label="شروع مجدد"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                stopAllAudioAndMic();
                onBack();
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-emerald-100 transition cursor-pointer"
            >
              بازگشت
            </button>
          </div>
        </div>

        {/* Main Centered Liquid Orb Stage */}
        {!chatState.done && currentQuestion ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 sm:py-5 text-center">
            {/* Centered Audio-Reactive Liquid Orb */}
            <div className="my-1 sm:my-2">
              <LiquidVoiceOrb
                audioLevel={audioLevel}
                bands={audioBands}
                phase={phase}
                onClick={handleOrbClick}
              />
            </div>

            {/* Live Status Indicator */}
            <div className="mt-1 mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[11px] sm:text-xs font-semibold text-emerald-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  phase === 'ai-speaking'
                    ? 'bg-emerald-300 animate-ping'
                    : phase === 'listening'
                    ? 'bg-emerald-400 animate-pulse'
                    : phase === 'processing'
                    ? 'bg-amber-400 animate-bounce'
                    : 'bg-emerald-700'
                }`}
              />
              <span>{statusMessage}</span>
            </div>

            {/* AI Spoken Question */}
            <h3
              data-testid="smart-current-question"
              className="max-w-lg text-sm sm:text-lg font-bold text-white leading-relaxed px-2"
            >
              {cleanQuestionTitle}
            </h3>

            {/* Live User Voice Transcript or Validation Feedback */}
            <div className="min-h-[40px] mt-2 flex items-center justify-center max-w-md w-full">
              {liveTranscript ? (
                <p
                  data-testid="smart-live-transcript"
                  className="text-xs sm:text-sm text-emerald-200 font-medium bg-emerald-950/50 border border-emerald-700/40 px-3.5 py-1.5 rounded-2xl leading-relaxed animate-arrive"
                >
                  «{liveTranscript}»
                </p>
              ) : showWarning ? (
                <div
                  data-testid="smart-warning-feedback"
                  className="px-3.5 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-xs text-amber-200 flex items-center gap-2 animate-arrive"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>{lastValidation.feedback}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* Completed State */
          <div
            className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center space-y-4 animate-arrive"
            data-testid="smart-chat-completed"
          >
            <LiquidVoiceOrb audioLevel={0.08} phase="done" />

            <div className="flex items-center gap-2 text-sm sm:text-lg font-bold text-emerald-300">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>تدوین صوتی گزارش تکمیل شد</span>
            </div>

            <div className="w-full max-w-lg p-3.5 rounded-2xl bg-black/25 border border-emerald-700/40 text-xs sm:text-sm text-emerald-50 text-right whitespace-pre-line leading-relaxed max-h-[140px] overflow-y-auto">
              {chatState.compiledNarrative}
            </div>

            <div className="flex items-center justify-center gap-3 w-full max-w-md pt-1">
              <button
                type="button"
                onClick={handleResetConversation}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-emerald-100 cursor-pointer transition"
              >
                شروع مجدد
              </button>
              <button
                type="button"
                data-testid="smart-chat-finish-btn"
                onClick={handleTransferToReport}
                className="px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#062419] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <span>تأیید و ادامه</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Minimal Voice Call Bottom Bar */}
        {!chatState.done && (
          <div className="px-4 py-3 border-t border-emerald-800/30 bg-black/20 backdrop-blur-xs flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleRepeatQuestion}
              className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-emerald-100 flex items-center gap-1.5 transition cursor-pointer"
              title="تکرار صوتی سؤال"
            >
              <Volume2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>تکرار سؤال</span>
            </button>

            <button
              type="button"
              data-testid="smart-voice-mic-btn"
              onClick={handleToggleMic}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition cursor-pointer shrink-0 ${
                phase === 'listening' && !micMuted
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-[#052319] ring-4 ring-emerald-500/30'
                  : phase === 'ai-speaking'
                  ? 'bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 ring-2 ring-emerald-400/30'
                  : 'bg-red-500/85 hover:bg-red-500 text-white ring-4 ring-red-500/20'
              }`}
              title={
                phase === 'ai-speaking'
                  ? 'قطع صدای راوی و شروع صحبت'
                  : micMuted || phase === 'idle'
                  ? 'فعال‌سازی میکروفون'
                  : 'توقف یا ارسال صحبت'
              }
              aria-label={
                phase === 'ai-speaking'
                  ? 'قطع صدای راوی و شروع صحبت'
                  : micMuted || phase === 'idle'
                  ? 'فعال‌سازی میکروفون'
                  : 'توقف یا ارسال صحبت'
              }
            >
              {micMuted || phase === 'idle' ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {currentStageId !== 'incident' && currentStageId !== 'source' && (
              <button
                type="button"
                data-testid="smart-voice-skip-btn"
                onClick={handleSkipStage}
                className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-emerald-100 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>اطلاعی ندارم</span>
                <SkipForward className="w-4 h-4 text-emerald-300 shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
