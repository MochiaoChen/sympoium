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

const KIMI_KEY = __KIMI_API_KEY__;
const ZHIHU_SECRET = __ZHIHU_ACCESS_SECRET__;

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
