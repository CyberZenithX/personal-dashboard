export type Prio = 'high' | 'med' | 'low';
export type TagPair = [name: string, color: string];

export interface Task {
  id: number;
  title: string;
  tag: string | null;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:MM
  prio: Prio;
  xp: number;
  sub: string | null;
  done: boolean;
  doneAt: string | null; // ISO
  source: string;
  createdAt: string;
}

export interface NoteLink {
  type: 'Task' | 'Event';
  label: string;
  id?: number;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  tag: string | null;
  source: string; // typed | voice | evening
  links: NoteLink[];
  createdAt: string;
  updatedAt: string;
}

export type EventKind = 'event' | 'task' | 'habit';

export interface EventItem {
  id: number;
  title: string;
  kind: EventKind;
  date: string;
  startMin: number;
  endMin: number;
  repeatDays: number[] | null; // 0 = Sun … 6 = Sat
  source: string;
}

export interface VoiceLog {
  id: number;
  transcript: string;
  itemCount: number;
  createdAt: string;
}

export interface Flags {
  autoSave: boolean;
  matchTasks: boolean;
  confirm: boolean;
  sounds: boolean;
  confetti: boolean;
  autoFreeze: boolean;
  nudges: boolean;
  evening: boolean;
  weekly: boolean;
}

export interface Settings {
  pages: { Tasks: boolean; Notes: boolean; Calendar: boolean };
  taskTags: TagPair[];
  noteTags: TagPair[];
  keys: string[];
  listenModel: string;
  sortModel: string;
  flags: Flags;
  goal: number;
  theme: string;
  density: 'Comfortable' | 'Compact';
  week: 'Mon' | 'Sun';
  time: '24h' | '12h';
  eveningTime: string;
  timezone: string;
}

export interface DayStat {
  checkins: number;
  tasksDone: number;
  tasksTotal: number;
  notes: number;
  score: number;
  xp: number;
}

export interface QuestState {
  key: 'checkin' | 'voice' | 'tasks' | 'evening';
  label: string;
  done: number;
  total: number;
  xp: number;
}

export interface BadgeState {
  key: string;
  label: string;
  sub: string;
  on: boolean;
}

export interface Progress {
  xp: number;
  xpToday: number;
  level: number;
  title: string;
  nextTitle: string | null;
  levelXp: number; // threshold of current level
  nextXp: number; // threshold of next level
  streak: number;
  bestStreak: number;
  freezes: number;
  streakMetToday: boolean;
  days: Record<string, DayStat>;
  quests: QuestState[];
  overdueQuest: { done: number; total: number };
  badges: BadgeState[];
  weekXp: number; // current week (per settings)
  lastWeekXp: number;
  paceXpPerDay: number;
  thingsThisWeek: number;
}

export interface AppState {
  tasks: Task[];
  notes: Note[];
  events: EventItem[];
  voiceLogs: VoiceLog[];
  settings: Settings;
  progress: Progress;
  today: string;
  userName: string;
  aiEngine: 'gemini' | 'local';
}

export interface LevelUp {
  from: number;
  to: number;
}

export interface MutationResult {
  state: AppState;
  toast?: string;
  levelUp?: LevelUp;
  data?: Record<string, unknown>;
}

export type SortType = 'task' | 'note' | 'event' | 'complete';

export interface SortItem {
  type: SortType;
  title: string;
  tag: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  endTime: string | null;
  taskId: number | null;
  body?: string;
}
