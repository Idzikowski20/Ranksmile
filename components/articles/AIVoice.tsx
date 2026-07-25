import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

const BAR_COUNT = 48;
const FONT = 'var(--font-family-primary)';
const MONO = "var(--font-family-mono, 'Roboto Mono', Monaco, Consolas, monospace)";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function MicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v4" />
      <path d="M8 23h8" />
    </svg>
  );
}

export type UseAIVoiceOptions = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  lang?: string;
};

export function useAIVoice({ value, onChange, disabled = false, lang }: UseAIVoiceOptions) {
  const Ctor = useMemo(() => getSpeechRecognitionCtor(), []);
  const supported = Ctor !== null;

  const [listening, setListening] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef(value);
  const finalsRef = useRef('');
  const onChangeRef = useRef(onChange);
  const intentionalStopRef = useRef(false);
  onChangeRef.current = onChange;

  const barHeights = useMemo(() => {
    if (!listening) return Array.from({ length: BAR_COUNT }, () => 4);
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const n = Math.sin(i * 12.9898) * 43758.5453;
      const frac = n - Math.floor(n);
      return 20 + frac * 80;
    });
  }, [listening]);

  useEffect(() => {
    if (!listening) {
      setTime(0);
      return undefined;
    }
    const id = window.setInterval(() => setTime((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Ctor || disabled) return;
    setError(null);
    intentionalStopRef.current = false;
    baseTextRef.current = value;
    finalsRef.current = '';

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

    rec.onresult = (ev: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        const piece = result[0]?.transcript ?? '';
        if (result.isFinal) finalsRef.current += piece;
        else interim += piece;
      }
      const base = baseTextRef.current;
      const sep = base && !/\s$/.test(base) ? ' ' : '';
      const spoken = `${finalsRef.current}${interim}`.trimStart();
      onChangeRef.current(spoken ? `${base}${sep}${spoken}` : base);
    };

    rec.onerror = (ev) => {
      if (ev.error === 'aborted' || ev.error === 'no-speech') return;
      setError(ev.error === 'not-allowed' ? 'Microphone permission denied' : 'Voice input failed');
      setListening(false);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!intentionalStopRef.current) {
        // Browser ended the session (silence) — leave transcribed text, exit listening UI.
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('Could not start voice input');
      setListening(false);
    }
  }, [Ctor, disabled, lang, value]);

  const toggle = useCallback(() => {
    if (!supported || disabled) return;
    if (listening) stop();
    else start();
  }, [supported, disabled, listening, start, stop]);

  useEffect(() => () => {
    intentionalStopRef.current = true;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (disabled && listening) stop();
  }, [disabled, listening, stop]);

  return {
    supported,
    listening,
    time,
    error,
    barHeights,
    toggle,
    start,
    stop,
  };
}

type VoiceUiProps = {
  listening: boolean;
  time: number;
  error: string | null;
  barHeights: number[];
  supported: boolean;
  disabled?: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
};

/** Compact mic / stop control for the Ranksmile composer toolbar. */
export function AIVoiceButton({
  listening,
  supported,
  disabled = false,
  onToggle,
  style,
}: Pick<VoiceUiProps, 'listening' | 'supported' | 'disabled' | 'onToggle' | 'style'>) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
      title={listening ? 'Stop listening' : 'Speak to type'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 9999,
        background: listening ? 'rgba(242,153,100,0.15)' : 'transparent',
        border: 'none',
        color: listening ? '#F29964' : '#9f9fa9',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
        transition: 'background 150ms ease, color 150ms ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!listening && !disabled) e.currentTarget.style.color = '#52525c';
      }}
      onMouseLeave={(e) => {
        if (!listening) e.currentTarget.style.color = '#9f9fa9';
      }}
    >
      {listening ? (
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: '#181225',
            animation: 'ranksmile-voice-spin 3s linear infinite',
            display: 'block',
          }}
        />
      ) : (
        <MicIcon size={16} />
      )}
      <style>{`@keyframes ranksmile-voice-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

/** Full Listening animation: spinning square, timer, waveform bars. */
export function AIVoicePanel({
  listening,
  time,
  error,
  barHeights,
  supported,
  disabled = false,
  onToggle,
  style,
}: VoiceUiProps) {
  return (
    <div style={{ width: '100%', padding: '8px 0 4px', fontFamily: FONT, ...style }}>
      <style>{`
        @keyframes ranksmile-voice-spin { to { transform: rotate(360deg); } }
        @keyframes ranksmile-voice-pulse {
          0%, 100% { opacity: 0.45; transform: scaleY(0.85); }
          50% { opacity: 0.9; transform: scaleY(1); }
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          margin: '0 auto',
          display: 'flex',
          width: '100%',
          maxWidth: 360,
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={!supported || disabled}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          style={{
            display: 'flex',
            height: 56,
            width: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            border: 'none',
            background: 'transparent',
            cursor: !supported || disabled ? 'not-allowed' : 'pointer',
            color: '#181225',
            padding: 0,
            opacity: !supported || disabled ? 0.45 : 1,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (supported && !disabled && !listening) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {listening ? (
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: '#181225',
                animation: 'ranksmile-voice-spin 3s linear infinite',
                display: 'block',
              }}
            />
          ) : (
            <MicIcon size={22} />
          )}
        </button>

        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            color: listening ? 'rgba(24,18,37,0.7)' : 'rgba(24,18,37,0.28)',
            transition: 'opacity 300ms ease, color 300ms ease',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTime(time)}
        </span>

        <div
          style={{
            display: 'flex',
            height: 16,
            width: '100%',
            maxWidth: 256,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          {barHeights.map((h, i) => (
            <div
              key={i}
              style={{
                width: 2,
                borderRadius: 9999,
                background: listening ? 'rgba(24,18,37,0.5)' : 'rgba(24,18,37,0.1)',
                height: listening ? `${h}%` : 4,
                transition: 'height 300ms ease, background 300ms ease',
                animation: listening ? 'ranksmile-voice-pulse 1.1s ease-in-out infinite' : undefined,
                animationDelay: listening ? `${i * 0.05}s` : undefined,
                transformOrigin: 'center',
              }}
            />
          ))}
        </div>

        <p
          style={{
            margin: 0,
            height: 16,
            fontSize: 12,
            color: 'rgba(24,18,37,0.7)',
            textAlign: 'center',
          }}
        >
          {!supported
            ? 'Voice input not supported in this browser'
            : error
              ? error
              : listening
                ? 'Listening...'
                : 'Click to speak'}
        </p>
      </div>
    </div>
  );
}

/** Default export: self-contained panel (demo / standalone). Prefer hook + button/panel in Ranksmile. */
export default function AIVoice(props: UseAIVoiceOptions & { style?: React.CSSProperties }) {
  const voice = useAIVoice(props);
  return (
    <AIVoicePanel
      listening={voice.listening}
      time={voice.time}
      error={voice.error}
      barHeights={voice.barHeights}
      supported={voice.supported}
      disabled={props.disabled}
      onToggle={voice.toggle}
      style={props.style}
    />
  );
}
