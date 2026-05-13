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
  GlobalPrediction,
  QuoteHunterResult,
  EditorRoundResult,
  ZhihuUser,
  LLMProvider,
  Cluster,
  TerrainDimension,
  TerrainMeta,
} from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

// Gap = blind spot from the TERRAIN model (Act 3 cartography).
// Legacy fields (audit_verdict / strongest_objection / defense_strategy) are kept
// optional so Act 5's "圆桌会" speeches continue to type-check; Act 3 derives
// audit_verdict from potential_value for backward-compatible UI.
export interface Gap {
  id: string;
  description: string;
  reasoning: string;
  // ── New terrain fields ──
  dimension: TerrainDimension;
  potential_value: number; // 1..5
  suggested_background: string;
  x: number; // 0..100
  y: number; // 0..100
  // ── Legacy fields (optional, derived/populated as available) ──
  audit_verdict?: 'gold' | 'questionable' | 'dead_end';
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
  clusters: Cluster[];
  terrainMeta: TerrainMeta | null;
  saidSet: string[];
  unsaidSet: Gap[];
  selectedGap: Gap | null;
  setTopAnswers: (a: SearchItem[]) => void;
  setClusters: (c: Cluster[]) => void;
  setTerrainMeta: (m: TerrainMeta | null) => void;
  setSaidSet: (s: string[]) => void;
  setUnsaidSet: (g: Gap[]) => void;
  setSelectedGap: (g: Gap | null) => void;

  // Act 4 — 下笔 (Writing)
  skeleton: WritingSkeleton | null;
  setSkeleton: (s: WritingSkeleton | null) => void;

  // Act 4 — 下笔 (Writing): draft setter lives here
  draft: string;
  setDraft: (d: string) => void;

  // Act 5 — 预演 (Rehearsal): roundtable + global prediction + quote hunter
  globalPrediction: GlobalPrediction | null;
  setGlobalPrediction: (p: GlobalPrediction | null) => void;
  quoteHunterResult: QuoteHunterResult | null;
  setQuoteHunterResult: (q: QuoteHunterResult | null) => void;
  editorRoundResult: EditorRoundResult | null;
  setEditorRoundResult: (r: EditorRoundResult | null) => void;
  roundtableSpeaking: string | null;
  setRoundtableSpeaking: (s: string | null) => void;

  // Auth
  zhihuAccessToken: string | null;
  zhihuUser: ZhihuUser | null;
  setZhihuAccessToken: (token: string | null) => void;
  setZhihuUser: (user: ZhihuUser | null) => void;
  logout: () => void;

  // LLM Provider
  llmProvider: LLMProvider;
  setLLMProvider: (p: LLMProvider) => void;

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
  '预演',     // Act 5 (was 重审)
  '出酒',     // Act 6 (was 出酒/Act 7)
];

export const ACT_AGENTS = [
  '',                          // index 0 unused
  '望气者',                   // Act 1
  '望气者',                   // Act 2
  '测绘师 · 问难者',         // Act 3
  '执笔者',                   // Act 4
  '刘看山 · 圆桌会',         // Act 5 (七人圆桌预演)
  '刘看山',                   // Act 6 (出酒)
];

// ─── Store Implementation ────────────────────────────────────────────────────

// Load persisted auth state
function loadPersistedAuth() {
  try {
    const token = localStorage.getItem('sympoium_zhihu_token');
    const userJson = localStorage.getItem('sympoium_zhihu_user');
    const user = userJson ? (JSON.parse(userJson) as ZhihuUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

const persistedAuth = loadPersistedAuth();

const initialState = {
  currentAct: 1,

  // Act 1
  hotList: [],
  selectedTopic: '',

  // Act 2
  selectedQuestion: null,

  // Act 3
  topAnswers: [],
  clusters: [],
  terrainMeta: null,
  saidSet: [],
  unsaidSet: [],
  selectedGap: null,

  // Act 4
  skeleton: null,

  // Act 4
  draft: '',

  // Act 5 (roundtable rehearsal)
  globalPrediction: null,
  quoteHunterResult: null,
  editorRoundResult: null,
  roundtableSpeaking: null,

  // Auth
  zhihuAccessToken: persistedAuth.token,
  zhihuUser: persistedAuth.user,

  // LLM Provider
  llmProvider: (() => {
    try {
      const stored = localStorage.getItem('sympoium_llm_provider');
      if (stored === 'kimi' || stored === 'deepseek') return stored;
    } catch { /* ignore */ }
    return 'deepseek' as LLMProvider;
  })(),

  // Loading
  isLoading: false,
  loadingMessage: '',
};

export const useSymposiumStore = create<SymposiumState>((set) => ({
  ...initialState,

  // Navigation
  setCurrentAct: (act) => set({ currentAct: act }),

  // Auth
  setZhihuAccessToken: (token) => {
    if (token) localStorage.setItem('sympoium_zhihu_token', token);
    else localStorage.removeItem('sympoium_zhihu_token');
    set({ zhihuAccessToken: token });
  },
  setZhihuUser: (user) => {
    if (user) localStorage.setItem('sympoium_zhihu_user', JSON.stringify(user));
    else localStorage.removeItem('sympoium_zhihu_user');
    set({ zhihuUser: user });
  },
  logout: () => {
    localStorage.removeItem('sympoium_zhihu_token');
    localStorage.removeItem('sympoium_zhihu_user');
    set({ zhihuAccessToken: null, zhihuUser: null });
  },

  // Act 1
  setHotList: (list) => set({ hotList: list }),
  setSelectedTopic: (t) => set({ selectedTopic: t }),

  // Act 2
  setSelectedQuestion: (q) => set({ selectedQuestion: q }),

  // Act 3
  setTopAnswers: (a) => set({ topAnswers: a }),
  setClusters: (c) => set({ clusters: c }),
  setTerrainMeta: (m) => set({ terrainMeta: m }),
  setSaidSet: (s) => set({ saidSet: s }),
  setUnsaidSet: (g) => set({ unsaidSet: g }),
  setSelectedGap: (g) => set({ selectedGap: g }),

  // Act 4
  setSkeleton: (s) => set({ skeleton: s }),

  // Act 4
  setDraft: (d) => set({ draft: d }),

  // Act 5 (roundtable rehearsal)
  setGlobalPrediction: (p) => set({ globalPrediction: p }),
  setQuoteHunterResult: (q) => set({ quoteHunterResult: q }),
  setEditorRoundResult: (r) => set({ editorRoundResult: r }),
  setRoundtableSpeaking: (s) => set({ roundtableSpeaking: s }),

  // LLM Provider
  setLLMProvider: (p) => {
    localStorage.setItem('sympoium_llm_provider', p);
    set({ llmProvider: p });
  },

  // Loading
  setIsLoading: (loading, message = '') =>
    set({ isLoading: loading, loadingMessage: message }),

  // Reset
  resetAll: () => {
    // Preserve auth and provider across reset
    const { zhihuAccessToken, zhihuUser, llmProvider } = useSymposiumStore.getState();
    set({
      ...initialState,
      zhihuAccessToken,
      zhihuUser,
      llmProvider,
    });
  },
}));
