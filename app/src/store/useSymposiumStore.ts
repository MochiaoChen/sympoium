/**
 * Global State Store — 会饮 (Symposium)
 *
 * Zustand store holding the complete state for all 7 acts.
 * This is the single source of truth for all data flowing between acts.
 */

import { create } from 'zustand';
import type {
  HotListItem,
  SearchItem,
  ParagraphReaction,
  GlobalPrediction,
  QuoteHunterResult,
  EditorRoundResult,
} from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Gap {
  id: string;
  description: string;
  reasoning: string;
  audit_verdict: 'gold' | 'questionable' | 'dead_end';
  strongest_objection?: string;
  defense_strategy?: string;
}

export interface WritingSkeleton {
  title_candidates: string[];
  opening_hooks: string[];
  key_arguments: {
    point: string;
    evidence_suggestion: string;
    counter_defense: string;
  }[];
  structure: string[];
}

// ─── Store Interface ─────────────────────────────────────────────────────────

interface SymposiumState {
  // Navigation
  currentAct: number;
  setCurrentAct: (act: number) => void;

  // Act 1 — 起意 (Inspiration)
  hotList: HotListItem[];
  selectedTopic: string;
  setHotList: (list: HotListItem[]) => void;
  setSelectedTopic: (t: string) => void;

  // Act 2 — 择题 (Question Selection)
  selectedQuestion: { title: string; url: string } | null;
  setSelectedQuestion: (q: { title: string; url: string } | null) => void;

  // Act 3 — 寻位 (Positioning)
  topAnswers: SearchItem[];
  saidSet: string[];
  unsaidSet: Gap[];
  selectedGap: Gap | null;
  setTopAnswers: (a: SearchItem[]) => void;
  setSaidSet: (s: string[]) => void;
  setUnsaidSet: (g: Gap[]) => void;
  setSelectedGap: (g: Gap | null) => void;

  // Act 4 — 下笔 (Writing)
  skeleton: WritingSkeleton | null;
  setSkeleton: (s: WritingSkeleton | null) => void;

  // Act 5 — 预演 (Rehearsal)
  draft: string;
  setDraft: (d: string) => void;
  targetCircle: string;
  setTargetCircle: (c: string) => void;
  paragraphReactions: Map<number, Map<string, ParagraphReaction>>;
  setParagraphReactions: (p: Map<number, Map<string, ParagraphReaction>>) => void;
  globalPrediction: GlobalPrediction | null;
  setGlobalPrediction: (p: GlobalPrediction | null) => void;
  quoteHunterResult: QuoteHunterResult | null;
  setQuoteHunterResult: (q: QuoteHunterResult | null) => void;

  // Act 6 — 重审 (Review)
  editorRoundResult: EditorRoundResult | null;
  setEditorRoundResult: (r: EditorRoundResult | null) => void;
  roundtableSpeaking: string | null;
  setRoundtableSpeaking: (s: string | null) => void;

  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  setIsLoading: (loading: boolean, message?: string) => void;

  // Reset
  resetAll: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const ACT_NAMES = [
  '',          // index 0 unused
  '起意',     // Act 1
  '择题',     // Act 2
  '寻位',     // Act 3
  '下笔',     // Act 4
  '预演',     // Act 5
  '重审',     // Act 6
  '出酒',     // Act 7
];

export const ACT_AGENTS = [
  '',                          // index 0 unused
  '望气者',                   // Act 1
  '望气者',                   // Act 2
  '测绘师 · 问难者',         // Act 3
  '执笔者',                   // Act 4
  '众生席 · 六人预演',       // Act 5
  '刘看山 · 圆桌会',         // Act 6
  '刘看山',                   // Act 7
];

// ─── Store Implementation ────────────────────────────────────────────────────

const initialState = {
  currentAct: 1,

  // Act 1
  hotList: [],
  selectedTopic: '',

  // Act 2
  selectedQuestion: null,

  // Act 3
  topAnswers: [],
  saidSet: [],
  unsaidSet: [],
  selectedGap: null,

  // Act 4
  skeleton: null,

  // Act 5
  draft: '',
  targetCircle: '',
  paragraphReactions: new Map<number, Map<string, ParagraphReaction>>(),
  globalPrediction: null,
  quoteHunterResult: null,

  // Act 6
  editorRoundResult: null,
  roundtableSpeaking: null,

  // Loading
  isLoading: false,
  loadingMessage: '',
};

export const useSymposiumStore = create<SymposiumState>((set) => ({
  ...initialState,

  // Navigation
  setCurrentAct: (act) => set({ currentAct: act }),

  // Act 1
  setHotList: (list) => set({ hotList: list }),
  setSelectedTopic: (t) => set({ selectedTopic: t }),

  // Act 2
  setSelectedQuestion: (q) => set({ selectedQuestion: q }),

  // Act 3
  setTopAnswers: (a) => set({ topAnswers: a }),
  setSaidSet: (s) => set({ saidSet: s }),
  setUnsaidSet: (g) => set({ unsaidSet: g }),
  setSelectedGap: (g) => set({ selectedGap: g }),

  // Act 4
  setSkeleton: (s) => set({ skeleton: s }),

  // Act 5
  setDraft: (d) => set({ draft: d }),
  setTargetCircle: (c) => set({ targetCircle: c }),
  setParagraphReactions: (p) => set({ paragraphReactions: p }),
  setGlobalPrediction: (p) => set({ globalPrediction: p }),
  setQuoteHunterResult: (q) => set({ quoteHunterResult: q }),

  // Act 6
  setEditorRoundResult: (r) => set({ editorRoundResult: r }),
  setRoundtableSpeaking: (s) => set({ roundtableSpeaking: s }),

  // Loading
  setIsLoading: (loading, message = '') =>
    set({ isLoading: loading, loadingMessage: message }),

  // Reset
  resetAll: () => set({ ...initialState }),
}));
