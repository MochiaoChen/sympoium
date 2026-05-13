/**
 * API Service Layer — 会饮 (Symposium)
 *
 * All external API calls go through this module.
 * Zhihu API calls use /api/zhihu proxy (avoids CORS).
 * Kimi API calls use /api/kimi proxy (avoids CORS).
 */

// ─── Environment ─────────────────────────────────────────────────────────────

declare const __KIMI_API_KEY__: string;
declare const __ZHIHU_ACCESS_SECRET__: string;
declare const __DEEPSEEK_API_KEY__: string;
declare const __ZHIHU_APP_ID__: string;
declare const __ZHIHU_APP_KEY__: string;
declare const __ZHIHU_REDIRECT_URI__: string;

const KIMI_KEY = __KIMI_API_KEY__;
const ZHIHU_SECRET = __ZHIHU_ACCESS_SECRET__;
const DEEPSEEK_KEY = __DEEPSEEK_API_KEY__;
const ZHIHU_APP_ID = __ZHIHU_APP_ID__;
const ZHIHU_APP_KEY = __ZHIHU_APP_KEY__;
const ZHIHU_REDIRECT_URI = __ZHIHU_REDIRECT_URI__;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HotListItem {
  Title: string;
  Url: string;
  ThumbnailUrl: string;
  Summary: string;
}

export interface SearchItem {
  Title: string;
  ContentType: string;
  ContentID: string;
  ContentText: string;
  Url: string;
  CommentCount: number;
  VoteUpCount: number;
  AuthorName: string;
  AuthorAvatar: string;
  AuthorityLevel: string;
}

export interface ParagraphReaction {
  danmu: string;
  continue_prob: number;
  emoji: string;
  highlight_phrase: string | null;
}

export interface GlobalPrediction {
  like_rate: number;
  comment_rate: number;
  favorite_rate: number;
  swipe_away_rate: number;
  first_three_lines_survival: number;
  risk_points: { text: string; reason: string }[];
  rationale: string;
}

export interface QuoteHunterResult {
  quotes: { text: string; viral_score: number; tag: string }[];
}

export interface EditorRoundResult {
  editor_note: string;
  suggestions: {
    paragraph_id: number;
    issue: string;
    from_reader: string;
    direction: string;
  }[];
}

// ─── Act 3 — Terrain model (answer-field cartography) ────────────────────────

export type TerrainDimension = 'viewpoint' | 'knowledge' | 'experience';

export interface Cluster {
  cluster_id: string;
  label: string;
  answer_count: number;
  /** 0-based indices into the topAnswers array; one answer ∈ exactly one cluster. */
  member_indices: number[];
  total_upvotes: number;
  representative_summary: string;
  dimension: TerrainDimension;
  x: number;
  y: number;
}

export interface BlindSpot {
  gap_id: string;
  description: string;
  reasoning: string;
  dimension: TerrainDimension;
  potential_value: number;
  suggested_background: string;
  x: number;
  y: number;
}

export interface TerrainMeta {
  total_answers_analyzed: number;
  saturation_level: 'low' | 'medium' | 'high';
  dominant_dimension: TerrainDimension;
}

export interface TerrainResult {
  clusters: Cluster[];
  blind_spots: BlindSpot[];
  meta: TerrainMeta;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function zhihuHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${ZHIHU_SECRET}`,
    'Content-Type': 'application/json',
    'X-Request-Timestamp': getTimestamp(),
  };
}

// ─── Zhihu API (via proxy) ──────────────────────────────────────────────────

export async function fetchHotList(limit: number = 10): Promise<HotListItem[]> {
  const url = `/api/zhihu/api/v1/content/hot_list?Limit=${limit}`;
  const res = await fetch(url, { headers: zhihuHeaders() });
  if (!res.ok) throw new Error(`Hot list fetch failed: ${res.status}`);
  const data = await res.json();
  return data.Data?.Items ?? [];
}

export async function searchZhihu(query: string, count: number = 5): Promise<SearchItem[]> {
  const url = `/api/zhihu/api/v1/content/zhihu_search?Query=${encodeURIComponent(query)}&Count=${count}`;
  const res = await fetch(url, { headers: zhihuHeaders() });
  if (!res.ok) throw new Error(`Zhihu search failed: ${res.status}`);
  const data = await res.json();
  return data.Data?.Items ?? [];
}

export async function searchGlobal(query: string, count: number = 10): Promise<SearchItem[]> {
  const url = `/api/zhihu/api/v1/content/global_search?Query=${encodeURIComponent(query)}&Count=${count}`;
  const res = await fetch(url, { headers: zhihuHeaders() });
  if (!res.ok) throw new Error(`Global search failed: ${res.status}`);
  const data = await res.json();
  return data.Data?.Items ?? [];
}

// Parallel zhihu_search + global_search, dedupe by (ContentType, ContentID),
// sort by VoteUpCount desc. Mirrors AmongAnswers backend.zhihu.search_combined.
export async function searchCombined(query: string): Promise<SearchItem[]> {
  const [siteRes, globalRes] = await Promise.allSettled([
    searchZhihu(query, 10),
    searchGlobal(query, 20),
  ]);
  const merged: SearchItem[] = [];
  if (siteRes.status === 'fulfilled') merged.push(...siteRes.value);
  if (globalRes.status === 'fulfilled') merged.push(...globalRes.value);

  const seen = new Set<string>();
  const deduped: SearchItem[] = [];
  for (const it of merged) {
    const key = `${it.ContentType}:${it.ContentID}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  deduped.sort((a, b) => (b.VoteUpCount ?? 0) - (a.VoteUpCount ?? 0));
  return deduped;
}

export type LLMProvider = 'kimi' | 'deepseek';

// ─── DeepSeek API (via proxy) ───────────────────────────────────────────────

const DEEPSEEK_BASE = '/api/deepseek';

export async function callDeepSeek(
  messages: { role: string; content: string }[],
  temperature: number = 0.7
): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function callDeepSeekStream(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  temperature: number = 0.7
): Promise<void> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek stream error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') return;
        try {
          const json = JSON.parse(jsonStr);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch {
          // ignore malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Kimi API (via proxy) ───────────────────────────────────────────────────

const KIMI_BASE = '/api/kimi';

export async function callKimi(
  messages: { role: string; content: string }[],
  temperature: number = 0.7
): Promise<string> {
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-128k',
      messages,
      temperature,
    }),
  });
  if (!res.ok) throw new Error(`Kimi API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function callKimiStream(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  temperature: number = 0.7
): Promise<void> {
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-128k',
      messages,
      temperature,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Kimi stream error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') return;
        try {
          const json = JSON.parse(jsonStr);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch {
          // ignore malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Zhihu OAuth ──────────────────────────────────────────────────────────────

export interface ZhihuUser {
  uid: number;
  fullname: string;
  gender: string;
  headline: string;
  description: string;
  avatar_path: string;
  phone_no: string;
  email: string;
}

export function getZhihuAuthUrl(): string {
  const params = new URLSearchParams({
    redirect_uri: ZHIHU_REDIRECT_URI,
    app_id: ZHIHU_APP_ID,
    response_type: 'code',
  });
  return `https://openapi.zhihu.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('/api/zhihu-oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      app_id: ZHIHU_APP_ID,
      app_key: ZHIHU_APP_KEY,
      grant_type: 'authorization_code',
      redirect_uri: ZHIHU_REDIRECT_URI,
      code,
    }).toString(),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth response missing access_token');
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

export async function fetchZhihuUser(accessToken: string): Promise<ZhihuUser> {
  const res = await fetch('/api/zhihu-oauth/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error(`Fetch user failed: ${res.status}`);
  const data = await res.json();
  // OAuth user endpoint returns the user object directly (not wrapped in Code/Message)
  return data as ZhihuUser;
}

// ─── Unified LLM entrypoint ──────────────────────────────────────────────────

export async function callLLM(
  messages: { role: string; content: string }[],
  temperature: number = 0.7,
  provider?: LLMProvider
): Promise<string> {
  const p = provider ?? getDefaultProvider();
  if (p === 'deepseek') {
    return callDeepSeek(messages, temperature);
  }
  return callKimi(messages, temperature);
}

export async function callLLMStream(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  temperature: number = 0.7,
  provider?: LLMProvider
): Promise<void> {
  const p = provider ?? getDefaultProvider();
  if (p === 'deepseek') {
    return callDeepSeekStream(messages, onChunk, temperature);
  }
  return callKimiStream(messages, onChunk, temperature);
}

function getDefaultProvider(): LLMProvider {
  try {
    const stored = localStorage.getItem('sympoium_llm_provider');
    if (stored === 'kimi' || stored === 'deepseek') return stored;
  } catch { /* ignore */ }
  return 'deepseek';
}

// ─── 知乎直答 (Zhihu Zhida) ──────────────────────────────────────────────────
// OpenAI 兼容接口，POST https://developer.zhihu.com/v1/chat/completions
// 鉴权复用 ZHIHU_ACCESS_SECRET (Bearer) + X-Request-Timestamp。
// 模型：zhida-fast-1p5 | zhida-thinking-1p5 | zhida-agent

export type ZhidaModel = 'zhida-fast-1p5' | 'zhida-thinking-1p5' | 'zhida-agent';

function zhidaHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${ZHIHU_SECRET}`,
    'Content-Type': 'application/json',
    'X-Request-Timestamp': getTimestamp(),
  };
}

export async function callZhida(
  messages: { role: string; content: string }[],
  model: ZhidaModel = 'zhida-thinking-1p5',
): Promise<string> {
  const res = await fetch('/api/zhihu/v1/chat/completions', {
    method: 'POST',
    headers: zhidaHeaders(),
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw new Error(`Zhida API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function callZhidaStream(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
  model: ZhidaModel = 'zhida-thinking-1p5',
): Promise<void> {
  const res = await fetch('/api/zhihu/v1/chat/completions', {
    method: 'POST',
    headers: zhidaHeaders(),
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Zhida stream error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') return;
        try {
          const json = JSON.parse(jsonStr);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onChunk(delta);
        } catch {
          // ignore malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── JSON-mode LLM helpers ───────────────────────────────────────────────────
// Salvage a JSON object from a response that may be wrapped in code fences or
// padded with prose. Mirrors AmongAnswers backend.kimi._strip_to_json.
function stripToJson(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return t.slice(start, end + 1);
  return t;
}

// DeepSeek call with response_format=json_object enforced.
async function callDeepSeekJson(
  messages: { role: string; content: string }[],
  temperature: number,
): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// Strict JSON-mode call with salvage fallback. Returns parsed JSON as T.
// Uses response_format on DeepSeek; on Kimi (no native JSON mode), relies on
// the prompt + stripToJson salvage.
export async function callLLMJson<T = unknown>(
  messages: { role: string; content: string }[],
  temperature: number = 0.3,
  provider?: LLMProvider,
): Promise<T> {
  const p = provider ?? getDefaultProvider();
  const raw = p === 'deepseek'
    ? await callDeepSeekJson(messages, temperature)
    : await callKimi(messages, temperature);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(stripToJson(raw)) as T;
  }
}
