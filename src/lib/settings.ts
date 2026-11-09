import type { Settings } from './types';

export const DEFAULT_KEYS: [string, string][] = [
  ['New task', 'T'],
  ['New note', 'N'],
  ['New event', 'E'],
  ['Hold to talk', 'Space'],
  ['Complete selected', 'X'],
  ['Push to tomorrow', 'Shift + →'],
  ['Search everything', 'Ctrl + K']
];

export const TAG_PALETTE = ['#7FB2FF', '#FFC85C', '#FF9E7A', '#D59CFF', '#C6F432', '#5EE0C1'];

/** First = main model; when a model can't connect the rest are tried in this order. */
export const LISTEN_MODELS = ['Gemini 3.5 Transcribe Live', 'Gemini 3 Flash Live', 'Gemini 3.8 Live', 'Gemini 2.5 Flash Native Audio Dialog'];
export const SORT_MODELS = ['Gemini 3.5 Flash Lite', 'Gemini 3 Flash'];

/** Settings label -> Gemini API model ID (verified against the live ListModels endpoint). */
export const LISTEN_MODEL_IDS: Record<string, string> = {
  'Gemini 3 Flash Live': 'gemini-3.1-flash-live-preview',
  'Gemini 2.5 Flash Native Audio Dialog': 'gemini-2.5-flash-native-audio-preview-12-2025',
  'Gemini 3.8 Live': 'gemini-3.8-live',
  'Gemini 3.5 Transcribe Live': 'gemini-3.5-transcribe-live'
};
export const SORT_MODEL_IDS: Record<string, string> = {
  'Gemini 3.5 Flash Lite': 'gemini-3.5-flash-lite',
  'Gemini 3 Flash': 'gemini-3-flash-preview'
};

export const DEFAULT_SETTINGS: Settings = {
  pages: { Tasks: true, Notes: true, Calendar: true },
  taskTags: [
    ['#work', '#7FB2FF'],
    ['#life', '#FFC85C'],
    ['#health', '#FF9E7A'],
    ['#study', '#D59CFF']
  ],
  noteTags: [
    ['#ideas', '#FFC85C'],
    ['#meetings', '#7FB2FF'],
    ['#journal', '#FF9E7A'],
    ['#content', '#C6F432']
  ],
  keys: DEFAULT_KEYS.map((k) => k[1]),
  listenModel: 'Gemini 3.5 Transcribe Live',
  sortModel: SORT_MODELS[0],
  flags: {
    autoSave: true,
    matchTasks: true,
    confirm: false,
    sounds: true,
    confetti: true,
    autoFreeze: true,
    nudges: true,
    evening: true,
    weekly: false
  },
  goal: 5,
  theme: 'Night',
  density: 'Comfortable',
  week: 'Mon',
  time: '24h',
  eveningTime: '21:00',
  timezone: 'UTC'
};

export function mergeSettings(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    pages: { ...DEFAULT_SETTINGS.pages, ...(s.pages ?? {}) },
    flags: { ...DEFAULT_SETTINGS.flags, ...(s.flags ?? {}) },
    keys: Array.isArray(s.keys) && s.keys.length === DEFAULT_KEYS.length ? s.keys : DEFAULT_SETTINGS.keys,
    taskTags: Array.isArray(s.taskTags) ? s.taskTags : DEFAULT_SETTINGS.taskTags,
    noteTags: Array.isArray(s.noteTags) ? s.noteTags : DEFAULT_SETTINGS.noteTags
  };
}

export const THEMES: { name: string; bg: string; accent: string; accent2: string; lockLvl: number }[] = [
  { name: 'Night', bg: '#0E1014', accent: '#C6F432', accent2: '#FFB36B', lockLvl: 1 },
  { name: 'Ocean', bg: '#0B1622', accent: '#5EE0C1', accent2: '#7FB2FF', lockLvl: 4 },
  { name: 'Dusk', bg: '#1C1412', accent: '#FF9E7A', accent2: '#FFC85C', lockLvl: 8 },
  { name: 'Gold', bg: '#16130B', accent: '#FFD15C', accent2: '#FFF3D6', lockLvl: 15 },
  { name: 'Amethyst', bg: '#140C22', accent: '#B57CFF', accent2: '#E7C8FF', lockLvl: 30 }
];

/** The prompt shown in Settings → Voice and AI, and sent to the classifier. */
export function buildPrompt(s: Pick<Settings, 'taskTags' | 'noteTags' | 'flags'>): string {
  const list = (arr: [string, string][]) => arr.map((t) => t[0]).join(', ') || '(none)';
  return (
    'You sort what the user typed or said into items.\n' +
    'Return JSON only: { "items": [ { "type": "task" | "note" | "event", "title": string, "tag": string, "due": string | null } ] }\n\n' +
    'Allowed task tags: ' + list(s.taskTags) + '\n' +
    'Allowed note tags: ' + list(s.noteTags) + '\n' +
    'If nothing fits, use "untagged". Never invent a tag.' +
    (s.flags.matchTasks
      ? '\nIf the user says they finished something, match it to an open task and return { "type": "complete", "taskId" }.'
      : '')
  );
}
