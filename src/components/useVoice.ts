'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './store';
import type { SortItem } from '@/lib/types';

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SpeechRecognitionLike;

interface LiveSession {
  sendRealtimeInput(p: unknown): void;
  close(): void;
}

export type VoiceMode = 'listening' | 'review' | 'saving';
/** Where the words come from: Gemini Live, the browser's speech recognition, or the keyboard. */
export type VoiceSource = 'live' | 'browser' | 'typed';

const WORKLET = `class P extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('pcm-capture', P);`;

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function useVoice() {
  const { state, act, flash } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<VoiceMode>('listening');
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [typed, setTyped] = useState('');
  const [source, setSource] = useState<VoiceSource>('browser');
  const [starting, setStarting] = useState(true);
  const [showTyping, setShowTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [items, setItems] = useState<SortItem[]>([]);
  const [engine, setEngine] = useState<'gemini' | 'local'>(state.aiEngine);
  const [sorting, setSorting] = useState(false);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const rec = useRef<SpeechRecognitionLike | null>(null);
  const active = useRef(false);
  const seq = useRef(0);
  const base = useRef('');
  const lastFinal = useRef('');
  const textRef = useRef('');
  const live = useRef<{ session: LiveSession; ctx: AudioContext; stream: MediaStream; lastAt: number } | null>(null);
  const liveText = useRef('');
  const run = useRef(0);

  const supported = source !== 'typed';
  const text = (supported && !showTyping ? `${finalText} ${interim}` : typed).replace(/\s+/g, ' ').trim();
  textRef.current = text;

  const sortNow = useCallback(async (t: string): Promise<SortItem[]> => {
    const id = ++seq.current;
    setSorting(true);
    try {
      const res = await fetch('/api/classify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t }) });
      const json = (await res.json()) as { items?: SortItem[]; engine?: 'gemini' | 'local' };
      if (id === seq.current && json.items) {
        setItems(json.items);
        if (json.engine) setEngine(json.engine);
      }
      return json.items ?? [];
    } catch {
      return [];
    } finally {
      if (id === seq.current) setSorting(false);
    }
  }, []);

  /* ---------------------------------------------------------- Web Speech */
  const startBrowser = useCallback((): boolean => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return false;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let fin = '';
      let tmp = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript + ' ';
        else tmp += res[0].transcript;
      }
      lastFinal.current = base.current + fin;
      setFinalText(lastFinal.current);
      setInterim(tmp);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      active.current = false;
      setSource('typed');
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access is blocked. Type instead, or allow the mic in your browser settings.' : "Speech recognition isn't available right now. Type instead.");
    };
    r.onend = () => {
      if (active.current) {
        base.current = lastFinal.current;
        try { r.start(); } catch { /* already started */ }
      }
    };
    rec.current = r;
    active.current = true;
    setSource('browser');
    try { r.start(); } catch { /* ignore */ }
    return true;
  }, []);

  /* ---------------------------------------------------------- Gemini Live */
  async function startLive(myRun: number, attempt = 0): Promise<boolean> {
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let session: LiveSession | null = null;
    const stale = () => run.current !== myRun;
    const release = () => {
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
      try { session?.close(); } catch { /* ignore */ }
    };
    try {
      const tokRes = await fetch('/api/voice/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attempt }) });
      if (stale()) return true;
      if (!tokRes.ok) return false; // no key, or every Live model has been tried
      const { token, model, label, textOnly } = (await tokRes.json()) as { token: string; model: string; label: string; textOnly: boolean };

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      } catch {
        if (stale()) return true;
        setSource('typed');
        setError('Microphone access is blocked. Type instead, or allow the mic in your browser settings.');
        return true; // handled: nothing else to try without a mic
      }
      if (stale()) { release(); return true; }

      const { GoogleGenAI, Modality } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
      let opened = false;
      let dead = false;
      session = await ai.live.connect({
        model,
        config: {
          responseModalities: [textOnly ? Modality.TEXT : Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'You are a silent dictation transcriber. Never speak or answer; the user is dictating notes and tasks.'
        },
        callbacks: {
          onopen: () => { opened = true; },
          onmessage: (m) => {
            const t = m.serverContent?.inputTranscription?.text;
            if (t) {
              liveText.current += t;
              if (live.current) live.current.lastAt = Date.now();
              setFinalText(liveText.current);
              setInterim('');
            }
            if (m.serverContent?.turnComplete && liveText.current && !liveText.current.endsWith(' ')) liveText.current += ' ';
          },
          onerror: () => { dead = true; },
          onclose: () => {
            dead = true;
            // dropped mid-dictation: continue on the next Live model, then the browser's recogniser,
            // keeping the words captured so far
            if (active.current && live.current) {
              teardownLive();
              void startLive(myRun, attempt + 1).then((ok) => {
                if (ok || run.current !== myRun || !active.current) return;
                base.current = liveText.current;
                lastFinal.current = liveText.current;
                if (!startBrowser()) {
                  setSource('typed');
                  setTyped(liveText.current.trim());
                }
              });
            } else if (!opened) {
              dead = true;
            }
          }
        }
      });
      if (stale()) { release(); return true; }
      if (dead) {
        release();
        console.warn(`[voice] ${label} could not connect, trying the next model`);
        return startLive(myRun, attempt + 1);
      }

      ctx = new AudioContext();
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
      if (stale()) { release(); return true; }
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-capture');
      const mute = ctx.createGain();
      mute.gain.value = 0;
      src.connect(node).connect(mute).connect(ctx.destination);

      // linear resample to 16 kHz mono PCM16, sent in ~100 ms frames
      const ratio = ctx.sampleRate / 16000;
      let pos = 0;
      let carry = new Float32Array(0);
      const out: number[] = [];
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (!active.current) return;
        const inp = new Float32Array(carry.length + e.data.length);
        inp.set(carry);
        inp.set(e.data, carry.length);
        while (pos + 1 < inp.length) {
          const i0 = Math.floor(pos);
          const f = pos - i0;
          const v = inp[i0] * (1 - f) + inp[i0 + 1] * f;
          out.push(Math.max(-1, Math.min(1, v)) * 0x7fff);
          pos += ratio;
        }
        const used = Math.floor(pos);
        carry = inp.slice(used);
        pos -= used;
        if (out.length >= 1600) {
          const pcm = new Int16Array(out.splice(0, out.length));
          try {
            session?.sendRealtimeInput({ audio: { data: b64(new Uint8Array(pcm.buffer)), mimeType: 'audio/pcm;rate=16000' } });
          } catch { /* socket closed */ }
        }
      };

      live.current = { session: session as LiveSession, ctx, stream, lastAt: Date.now() };
      active.current = true;
      setSource('live');
      setUsedModel(label);
      return true;
    } catch (err) {
      console.warn('[voice] Gemini Live attempt failed', attempt, err);
      release();
      if (stale()) return true;
      live.current = null;
      return startLive(myRun, attempt + 1);
    }
  }

  function teardownLive() {
    const l = live.current;
    live.current = null;
    if (!l) return;
    try { l.session.close(); } catch { /* ignore */ }
    l.stream.getTracks().forEach((t) => t.stop());
    void l.ctx.close().catch(() => {});
  }

  // choose the listening engine once
  useEffect(() => {
    const myRun = ++run.current;
    (async () => {
      let ok = false;
      if (state.aiEngine === 'gemini') ok = await startLive(myRun);
      if (run.current !== myRun) return;
      if (!ok && !startBrowser()) setSource('typed');
      setStarting(false);
    })();
    return () => {
      run.current++;
      active.current = false;
      try { rec.current?.abort(); } catch { /* ignore */ }
      teardownLive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // timer
  useEffect(() => {
    if (mode !== 'listening') return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  // live sorting while speaking / typing
  useEffect(() => {
    if (mode !== 'listening') return;
    if (!text) { setItems([]); return; }
    const t = setTimeout(() => void sortNow(text), 900);
    return () => clearTimeout(t);
  }, [text, mode, sortNow]);

  /** Stop capturing. For Gemini Live this lets the last words finish transcribing first. */
  const stopListening = async () => {
    active.current = false;
    try { rec.current?.stop(); } catch { /* ignore */ }
    const l = live.current;
    if (l) {
      try { l.session.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* ignore */ }
      l.stream.getTracks().forEach((t) => t.stop());
      const start = Date.now();
      // wait until the transcript has been quiet for ~900 ms (max 4 s)
      while (Date.now() - start < 4000 && Date.now() - Math.max(l.lastAt, start) < 900) await new Promise((r) => setTimeout(r, 150));
      teardownLive();
    }
  };

  const saveItems = useCallback(async (list: SortItem[], transcript: string) => {
    setMode('saving');
    const r = await act('POST', '/api/capture', { transcript, items: list });
    if (r) router.push('/');
    else setMode('review');
  }, [act, router]);

  const finish = async () => {
    if (mode !== 'listening') return;
    setMode('saving');
    await stopListening();
    const t = textRef.current;
    if (!t) { flash('Nothing heard'); router.push('/'); return; }
    const list = await sortNow(t);
    if (!list.length) { flash("Couldn't find anything to save"); setMode('review'); return; }
    const s = state.settings;
    const needsReview = !s.flags.autoSave || (s.flags.confirm && list.some((i) => i.type === 'event'));
    if (needsReview) setMode('review');
    else await saveItems(list, t);
  };

  const cancel = () => {
    active.current = false;
    try { rec.current?.abort(); } catch { /* ignore */ }
    teardownLive();
    router.push('/');
  };

  const xp = items.reduce((a, it) => a + (it.type === 'complete' ? state.tasks.find((t) => t.id === it.taskId)?.xp ?? 10 : 5), 0);

  const short = (m: string) => m.replace('Gemini ', '');
  const s = state.settings;
  const chip =
    source === 'live' && engine === 'gemini' ? `${short(usedModel ?? s.listenModel)} → ${short(s.sortModel)}`
    : engine === 'gemini' ? `${source === 'typed' ? 'Typed' : 'Browser speech'} → ${short(s.sortModel)}`
    : source === 'live' ? `${short(usedModel ?? s.listenModel)} → built-in sorter`
    : 'Built-in sorter';

  return {
    mode, text, settled: text, interim, finalText, typed, setTyped, supported, starting, source, chip, showTyping, setShowTyping, error, elapsed, items, setItems,
    engine, sorting, xp, finish, cancel, saveReview: () => saveItems(items, text), removeItem: (i: number) => setItems((l) => l.filter((_, j) => j !== i))
  };
}

export function fmtElapsed(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
