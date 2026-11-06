import React, { useEffect, useRef } from 'react';

export type OrbVoicePhase = 'ai-speaking' | 'listening' | 'processing' | 'idle' | 'done';

interface LiquidVoiceOrbProps {
  /** Normalized real-time audio amplitude (0.0 to 1.0) from AI speech or User microphone */
  audioLevel: number;
  /** Optional 8-band frequency spectrum (0.0 to 1.0 each) */
  bands?: number[];
  /** Current live conversation state */
  phase: OrbVoicePhase;
  /** Click handler on the orb */
  onClick?: () => void;
}

export const LiquidVoiceOrb: React.FC<LiquidVoiceOrbProps> = ({
  audioLevel,
  bands = [],
  phase,
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    audioLevel,
    bands,
    phase,
    smoothedLevel: 0,
    smoothedBands: [0, 0, 0, 0, 0, 0, 0, 0],
  });

  useEffect(() => {
    stateRef.current.audioLevel = audioLevel;
    stateRef.current.bands = bands;
    stateRef.current.phase = phase;
  }, [audioLevel, bands, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let t = 0;

    const render = () => {
      const st = stateRef.current;
      const targetLevel = Math.max(0, Math.min(1, st.audioLevel || 0));
      // Fast attack, smooth liquid decay
      const lerpFactor = targetLevel > st.smoothedLevel ? 0.28 : 0.12;
      st.smoothedLevel += (targetLevel - st.smoothedLevel) * lerpFactor;

      for (let i = 0; i < 8; i++) {
        const bVal = st.bands?.[i] ?? targetLevel;
        st.smoothedBands[i] += (bVal - st.smoothedBands[i]) * 0.22;
      }

      const energy = st.smoothedLevel;
      const isSpeakingOrListening = st.phase === 'ai-speaking' || st.phase === 'listening';
      const speedMultiplier =
        st.phase === 'processing'
          ? 2.2
          : isSpeakingOrListening
          ? 1.0 + energy * 2.8
          : 0.65;

      t += 0.022 * speedMultiplier;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssSize = 280;
      if (canvas.width !== cssSize * dpr || canvas.height !== cssSize * dpr) {
        canvas.width = cssSize * dpr;
        canvas.height = cssSize * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssSize, cssSize);

      const cx = cssSize / 2;
      const cy = cssSize / 2;
      const baseRadius = 96;

      // 1. Soft Ambient Outer Glow (pulsing with voice energy)
      const glowRadius = baseRadius * (1.28 + energy * 0.35);
      const outerGlow = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius);
      const glowAlpha = 0.18 + energy * 0.32;
      outerGlow.addColorStop(0, `rgba(52, 211, 153, ${glowAlpha})`);
      outerGlow.addColorStop(0.55, `rgba(16, 185, 129, ${glowAlpha * 0.45})`);
      outerGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Construct the Audio-Reactive Liquid Sphere Boundary Path
      const numPoints = 96;
      const boundaryPoints: Array<{ x: number; y: number }> = [];
      const breathScale = 1 + Math.sin(t * 1.1) * 0.012 + energy * 0.075;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const b0 = st.smoothedBands[i % 8] || energy;
        const b1 = st.smoothedBands[(i + 3) % 8] || energy;

        // Multi-harmonic liquid boundary ripple driven by sound
        const wave2 = Math.sin(angle * 2 + t * 1.9) * (0.8 + energy * 5.2);
        const wave3 = Math.cos(angle * 3 - t * 2.5) * (0.5 + energy * 4.6 * (0.5 + b0));
        const wave4 = Math.sin(angle * 4 + t * 3.2) * (0.25 + energy * 3.4 * (0.5 + b1));
        const wave6 = Math.cos(angle * 6 - t * 4.4) * (energy * 2.3);

        // Micro-vibration jitter when voice energy is strong
        const voiceTremor =
          energy > 0.05 ? Math.sin(angle * 9 + t * 8.0) * (energy * 1.6) : 0;

        const r = baseRadius * breathScale + wave2 + wave3 + wave4 + wave6 + voiceTremor;
        boundaryPoints.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      }

      const traceLiquidBoundary = () => {
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
          const p0 = boundaryPoints[i];
          const p1 = boundaryPoints[(i + 1) % numPoints];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          if (i === 0) {
            ctx.moveTo(midX, midY);
          } else {
            ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
          }
        }
        ctx.closePath();
      };

      // Clip everything inside the liquid orb silhouette
      ctx.save();
      traceLiquidBoundary();
      ctx.clip();

      // 3. Base 3D Sphere Gradient (matches reference image's luminous top-left to deep bottom-right)
      const shiftX = Math.sin(t * 0.8) * (10 + energy * 20);
      const shiftY = Math.cos(t * 0.7) * (8 + energy * 18);
      const baseGrad = ctx.createLinearGradient(
        cx - baseRadius * 0.65 + shiftX,
        cy - baseRadius * 0.95 + shiftY,
        cx + baseRadius * 0.55 - shiftX,
        cy + baseRadius * 0.98 - shiftY
      );
      baseGrad.addColorStop(0, '#ecfdf5'); // Luminous ice-mint top crest
      baseGrad.addColorStop(0.28, '#a7f3d0'); // Soft mint-emerald
      baseGrad.addColorStop(0.55, '#34d399'); // Vibrant liquid emerald
      baseGrad.addColorStop(0.8, '#059669'); // Rich FARAJA emerald
      baseGrad.addColorStop(1, '#064e3b'); // Deep forest depth
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, cssSize, cssSize);

      // 4. Soft Feathered Internal Liquid Waves (matching the smooth volumetric waves in image_b5d97bab.png)
      ctx.save();
      ctx.filter = 'blur(11px)';

      const drawSoftLiquidWave = (options: {
        yOffset: number;
        amp1: number;
        amp2: number;
        freq1: number;
        freq2: number;
        phaseSpeed: number;
        tilt: number;
        topColor: string;
        midColor: string;
        bottomColor: string;
        alpha: number;
      }) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(options.tilt + Math.sin(t * 0.45) * 0.08);
        ctx.translate(-cx, -cy);

        ctx.beginPath();
        const startX = cx - baseRadius * 1.45;
        const endX = cx + baseRadius * 1.45;
        const step = 8;

        for (let x = startX; x <= endX; x += step) {
          const normX = (x - cx) / baseRadius;
          const dynamicAmp1 = options.amp1 * (1 + energy * 1.75);
          const dynamicAmp2 = options.amp2 * (1 + energy * 2.0);
          const y =
            cy +
            options.yOffset +
            Math.sin(normX * options.freq1 + t * options.phaseSpeed) * dynamicAmp1 +
            Math.cos(normX * options.freq2 - t * (options.phaseSpeed * 1.3)) * dynamicAmp2;
          if (x === startX) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(endX, cy + baseRadius * 1.6);
        ctx.lineTo(startX, cy + baseRadius * 1.6);
        ctx.closePath();

        const waveGrad = ctx.createLinearGradient(
          cx,
          cy + options.yOffset - 36,
          cx,
          cy + baseRadius * 1.15
        );
        waveGrad.addColorStop(0, options.topColor);
        waveGrad.addColorStop(0.45, options.midColor);
        waveGrad.addColorStop(1, options.bottomColor);

        ctx.globalAlpha = options.alpha;
        ctx.fillStyle = waveGrad;
        ctx.fill();
        ctx.restore();
      };

      // Upper luminous white-mint fluid crest (the signature S-curve glow across the sphere)
      drawSoftLiquidWave({
        yOffset: -22 - energy * 12,
        amp1: 16,
        amp2: 9,
        freq1: 2.0,
        freq2: 3.2,
        phaseSpeed: 1.35,
        tilt: 0.2,
        topColor: '#ffffff',
        midColor: '#a7f3d0',
        bottomColor: '#10b981',
        alpha: 0.92,
      });

      // Mid liquid emerald current
      drawSoftLiquidWave({
        yOffset: 2 + Math.sin(t * 0.9) * 9,
        amp1: 19,
        amp2: 11,
        freq1: 1.75,
        freq2: 2.8,
        phaseSpeed: -1.55,
        tilt: -0.15,
        topColor: '#6ee7b7',
        midColor: '#059669',
        bottomColor: '#065f46',
        alpha: 0.85,
      });

      // Lower deep emerald current
      drawSoftLiquidWave({
        yOffset: 28 - energy * 10,
        amp1: 15,
        amp2: 12,
        freq1: 2.3,
        freq2: 3.6,
        phaseSpeed: 1.85,
        tilt: 0.18,
        topColor: '#10b981',
        midColor: '#047857',
        bottomColor: '#022c22',
        alpha: 0.9,
      });

      ctx.restore(); // End blur filter

      // 5. Soft Internal Caustic Highlight Blob
      const causticX = cx - baseRadius * 0.2 + Math.sin(t * 1.2) * (14 + energy * 22);
      const causticY = cy - baseRadius * 0.26 + Math.cos(t * 1.0) * (10 + energy * 18);
      const causticGrad = ctx.createRadialGradient(
        causticX,
        causticY,
        4,
        causticX,
        causticY,
        baseRadius * (0.76 + energy * 0.25)
      );
      causticGrad.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
      causticGrad.addColorStop(0.38, 'rgba(209, 250, 229, 0.45)');
      causticGrad.addColorStop(0.75, 'rgba(52, 211, 153, 0.12)');
      causticGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = causticGrad;
      ctx.fillRect(0, 0, cssSize, cssSize);

      // 6. 3D Spherical Rim Shading & Inner Specular Edge
      const innerRim = ctx.createRadialGradient(
        cx - baseRadius * 0.28,
        cy - baseRadius * 0.32,
        baseRadius * 0.15,
        cx,
        cy,
        baseRadius * 1.06
      );
      innerRim.addColorStop(0, 'rgba(255, 255, 255, 0)');
      innerRim.addColorStop(0.76, 'rgba(6, 78, 59, 0.05)');
      innerRim.addColorStop(0.94, 'rgba(6, 78, 59, 0.28)');
      innerRim.addColorStop(1, 'rgba(209, 250, 229, 0.42)');
      ctx.fillStyle = innerRim;
      ctx.fillRect(0, 0, cssSize, cssSize);

      ctx.restore(); // End sphere clip

      // 7. Crisp Luminous Rim Stroke around the Liquid Boundary
      traceLiquidBoundary();
      const rimStroke = ctx.createLinearGradient(
        cx - baseRadius,
        cy - baseRadius,
        cx + baseRadius,
        cy + baseRadius
      );
      rimStroke.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      rimStroke.addColorStop(0.5, 'rgba(110, 231, 183, 0.35)');
      rimStroke.addColorStop(1, 'rgba(4, 120, 87, 0.45)');
      ctx.strokeStyle = rimStroke;
      ctx.lineWidth = 1.5 + energy * 1.2;
      ctx.stroke();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative flex items-center justify-center select-none">
      <button
        type="button"
        onClick={onClick}
        data-testid="liquid-voice-orb"
        aria-label="گوی صوتی گفتگوی هوشمند"
        className="relative w-[196px] h-[196px] sm:w-[248px] sm:h-[248px] rounded-full flex items-center justify-center focus:outline-none cursor-pointer group transition-transform active:scale-95"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full pointer-events-none"
        />
      </button>
    </div>
  );
};
