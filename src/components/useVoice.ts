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

export type VoiceMode = 'listening' | 'review' | 'saving';

export function useVoice() {
  const { state, act, flash } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<VoiceMode>('listening');
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [typed, setTyped] = useState('');
  const [supported, setSupported] = useState(true);
  const [showTyping, setShowTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [items, setItems] = useState<SortItem[]>([]);
  const [engine, setEngine] = useState<'gemini' | 'local'>(state.aiEngine);
  const [sorting, setSorting] = useState(false);

  const rec = useRef<SpeechRecognitionLike | null>(null);
  const active = useRef(false);
  const seq = useRef(0);
  const base = useRef('');
  const lastFinal = useRef('');

  const text = (supported && !showTyping ? `${finalText} ${interim}` : typed).replace(/\s+/g, ' ').trim();
  const settled = (supported && !showTyping ? finalText : typed).replace(/\s+/g, ' ').trim();

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

  // start recognition
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
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
      setSupported(false);
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
    try { r.start(); } catch { /* ignore */ }
    return () => {
      active.current = false;
      try { r.abort(); } catch { /* ignore */ }
    };
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

  const stopListening = () => {
    active.current = false;
    try { rec.current?.stop(); } catch { /* ignore */ }
  };

  const saveItems = useCallback(async (list: SortItem[], transcript: string) => {
    setMode('saving');
    const r = await act('POST', '/api/capture', { transcript, items: list });
    if (r) router.push('/');
    else setMode('review');
  }, [act, router]);

  const finish = async () => {
    if (mode !== 'listening') return;
    stopListening();
    const t = text;
    if (!t) { flash('Nothing heard'); router.push('/'); return; }
    setMode('saving');
    const list = await sortNow(t);
    if (!list.length) { flash("Couldn't find anything to save"); setMode('review'); return; }
    const s = state.settings;
    const needsReview = !s.flags.autoSave || (s.flags.confirm && list.some((i) => i.type === 'event'));
    if (needsReview) setMode('review');
    else await saveItems(list, t);
  };

  const cancel = () => {
    stopListening();
    router.push('/');
  };

  const xp = items.reduce((a, it) => a + (it.type === 'complete' ? state.tasks.find((t) => t.id === it.taskId)?.xp ?? 10 : 5), 0);

  return {
    mode, text, settled, interim, finalText, typed, setTyped, supported, showTyping, setShowTyping, error, elapsed, items, setItems,
    engine, sorting, xp, finish, cancel, saveReview: () => saveItems(items, text), removeItem: (i: number) => setItems((l) => l.filter((_, j) => j !== i))
  };
}

export function fmtElapsed(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
