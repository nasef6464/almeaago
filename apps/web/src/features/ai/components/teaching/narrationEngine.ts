import { estimateNarrationMs } from './boardState';

export interface NarrationEngine {
  speak(text: string, language: string, onEnd: () => void): void;
  pause(): void;
  resume(): void;
  cancel(): void;
}

/**
 * Phonetically transliterates mathematical symbols and LaTeX expressions into
 * clear, natural spoken Arabic for Qudrat and Tahsili exams.
 */
export function prepareSpokenArabicText(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Clean LaTeX wrappers and macro artifacts
  text = text.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^}]+)\}/g, '$1 ');
  text = text.replace(/\\left|\\right/g, '');

  // 2. Transliterate fractions: \frac{a}{b} -> a على b
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, ' $1 على $2 ');

  // 3. Transliterate square roots: \sqrt{x} -> جذر x
  text = text.replace(/\\sqrt\{([^}]+)\}/g, ' جذر $1 ');
  text = text.replace(/√([^\s,]+)/g, ' جذر $1 ');

  // 4. Powers & Exponents: x^2 or س² -> س تربيع
  text = text.replace(/([سصعطxyz])\^2\b|([سصعطxyz])²/g, '$1 تربيع');
  text = text.replace(/([سصعطxyz])\^3\b|([سصعطxyz])³/g, '$1 تكعيب');
  text = text.replace(/([0-9]+)\^2\b|([0-9]+)²/g, '$1 تربيع');
  text = text.replace(/([0-9]+)\^3\b|([0-9]+)³/g, '$1 تكعيب');
  text = text.replace(/\^([0-9]+)/g, ' أس $1 ');

  // 5. Operations
  text = text.replace(/\\times|×|\*/g, ' ضرب ');
  text = text.replace(/\\div|÷/g, ' تقسيم ');
  text = text.replace(/\\leq|<=|≤/g, ' أصغر من أو يساوي ');
  text = text.replace(/\\geq|>=|≥/g, ' أكبر من أو يساوي ');
  text = text.replace(/\\neq|!=|≠/g, ' لا يساوي ');
  text = text.replace(/=/g, ' يساوي ');
  text = text.replace(/\+/g, ' زائد ');
  // Negative or minus between variables or numbers
  text = text.replace(/(\s)-(\s)/g, ' ناقص ');

  // 6. Geometry & Greek
  text = text.replace(/\\pi|π/g, ' باي ');
  text = text.replace(/\\theta|θ/g, ' ثيتا ');
  text = text.replace(/%/g, ' في المائة ');
  text = text.replace(/°/g, ' درجة ');

  // 7. Strip remaining stray LaTeX backslashes
  text = text.replace(/\\[a-zA-Z]+/g, ' ');
  text = text.replace(/[{}]/g, ' ');

  // 8. Add breathing pauses for natural human teacher cadence
  text = text.replace(/([،,؛;])/g, '$1 ');
  text = text.replace(/(\.)(\s)/g, '.  ');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Intelligent voice selector: prioritizes natural, high-definition neural voices
 * (e.g. Microsoft Shakir/Fatima Online Natural, Google Arabic, Apple Maged).
 */
export function selectBestArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  // Filter Arabic voices
  const arabicVoices = voices.filter(
    (v) => v.lang.startsWith('ar') || v.lang.includes('Arabic') || /العربية|عربي/i.test(v.name)
  );

  if (arabicVoices.length === 0) {
    return null;
  }

  // Priority 1: Natural / Neural / Online Arabic Voices (Saudi / Gulf dialect preferred for Qudrat)
  const premiumVoice = arabicVoices.find((v) =>
    /(?:natural|neural|online|shakir|fatima|hamed|maged|tarik|naayf|zeina)/i.test(v.name)
  );
  if (premiumVoice) return premiumVoice;

  // Priority 2: Standard Saudi Arabia Arabic
  const saudiVoice = arabicVoices.find((v) => v.lang === 'ar-SA' || v.lang === 'ar_SA');
  if (saudiVoice) return saudiVoice;

  // Priority 3: Any Arabic voice
  return arabicVoices[0];
}

/**
 * NaturalNarrationEngine: Coordinates smooth spoken guidance with whiteboard animations.
 */
export class BrowserNarrationEngine implements NarrationEngine {
  private static owner?: BrowserNarrationEngine;
  private timer?: ReturnType<typeof setTimeout>;
  private remaining = 0;
  private startedAt = 0;
  private completion?: () => void;
  private speech?: SpeechSynthesisUtterance;
  private text = '';
  private spokenText = '';
  private language = 'ar-SA';
  private interrupted = false;

  constructor() {
    // Warm up voice list if browser loads them asynchronously
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          // Pre-warm voices
        };
      }
    }
  }

  private releaseSpeech() {
    if (this.speech) {
      this.speech.onend = null;
      this.speech.onerror = null;
    }
    if (BrowserNarrationEngine.owner === this) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Ignore synthesis cancel error
      }
      BrowserNarrationEngine.owner = undefined;
    }
    this.speech = undefined;
  }

  private suspendForBranch() {
    this.pause();
    this.releaseSpeech();
    this.interrupted = true;
  }

  private attachSpeech() {
    const previous = BrowserNarrationEngine.owner;
    if (previous && previous !== this) {
      previous.suspendForBranch();
    }
    BrowserNarrationEngine.owner = this;

    // Transliterate into natural spoken Arabic
    this.spokenText = prepareSpokenArabicText(this.text);

    this.speech = new SpeechSynthesisUtterance(this.spokenText);
    this.speech.lang = this.language;

    // Paced for natural mentor tone
    this.speech.rate = 0.93;
    this.speech.pitch = 1.02;

    const voice = selectBestArabicVoice();
    if (voice) {
      this.speech.voice = voice;
    }

    this.speech.onend = () => this.finish();
    this.speech.onerror = () => {
      if (this.timer) clearTimeout(this.timer);
      this.remaining = estimateNarrationMs(this.spokenText || this.text);
      this.arm();
    };

    try {
      window.speechSynthesis.speak(this.speech);
      window.speechSynthesis.resume();
    } catch {
      this.arm();
    }
  }

  private arm() {
    this.startedAt = Date.now();
    this.timer = setTimeout(() => this.finish(), this.remaining);
  }

  private finish() {
    const callback = this.completion;
    this.cancel();
    callback?.();
  }

  speak(text: string, language: string, onEnd: () => void) {
    this.cancel();
    this.completion = onEnd;
    this.text = text;
    this.language = language || 'ar-SA';
    this.interrupted = false;
    this.remaining = estimateNarrationMs(text);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Content-sized watchdog for devices where onend might not fire reliably
      this.remaining = Math.min(180000, this.remaining * 2.8 + 4000);
      try {
        this.attachSpeech();
      } catch {
        this.releaseSpeech();
        this.remaining = estimateNarrationMs(text);
      }
    }
    this.arm();
  }

  pause() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.remaining = Math.max(1, this.remaining - (Date.now() - this.startedAt));
    }
    if (this.speech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
      } catch {
        // Fallback
      }
    }
  }

  resume() {
    if (!this.completion || this.timer) return;
    if (this.interrupted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.interrupted = false;
      try {
        this.attachSpeech();
      } catch {
        this.releaseSpeech();
        this.remaining = estimateNarrationMs(this.spokenText || this.text);
      }
    }
    if (this.speech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Fallback
      }
    }
    this.arm();
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.completion = undefined;
    this.releaseSpeech();
  }
}
