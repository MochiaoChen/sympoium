/**
 * ChatPanel — Act 4 右侧 AI 对话栏
 *
 * 两种模式可切换：
 *   - "全网搜"  → DeepSeek (callLLM, 用 zhihuUser/profile/draft 上下文不在这里管)
 *   - "知乎搜"  → 知乎直答 (callZhida, zhida-thinking-1p5)
 *
 * 维护多轮对话历史，发送时把整段历史送给模型。
 * 切换 provider 时保留消息历史。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Globe, MessagesSquare, AlertCircle, User as UserIcon } from 'lucide-react';
import { callLLM, callZhidaStream } from '@/services/api';
import LoadingDots from '@/components/LoadingDots';

type Mode = 'deepseek' | 'zhida';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string; // zhida-thinking 的思考过程；与 content 并存
  provider?: Mode; // 标记是哪个模型答的（切换 provider 时区分）
}

const MODE_LABEL: Record<Mode, string> = { deepseek: '全网搜', zhida: '知乎搜' };
const MODE_HINT: Record<Mode, string> = {
  deepseek: 'DeepSeek · 通用知识',
  zhida: '知乎直答 · 站内内容',
};

export default function ChatPanel() {
  const [mode, setMode] = useState<Mode>('deepseek');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Build conversation history for the API.
    // Only role+content; strip the provider tag.
    const history = next.map((m) => ({ role: m.role, content: m.content }));

    try {
      if (mode === 'zhida') {
        // zhida-thinking-1p5 推理可达 17s+，TencentEdgeOne 对非 stream 请求会在 30s 前
        // 返 554；只能走 streaming，边推理边把 token append 到这条 assistant 消息。
        // 思考过程（reasoning_content）和最终答案（content）分开累计。
        const aiId = `a-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { id: aiId, role: 'assistant', content: '', reasoning: '', provider: 'zhida' },
        ]);
        await callZhidaStream(
          history,
          (chunk, kind) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== aiId) return m;
                if (kind === 'reasoning') return { ...m, reasoning: (m.reasoning ?? '') + chunk };
                return { ...m, content: m.content + chunk };
              }),
            );
          },
          'zhida-thinking-1p5',
        );
        // Stream 结束后，若 content 还是空（模型只产出推理就停了），用占位提示
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aiId) return m;
            if (m.content.trim() !== '') return m;
            return {
              ...m,
              content: (m.reasoning ?? '').trim()
                ? '（模型只产出了推理，未给出最终回答 —— 见下方思考过程）'
                : '（模型返回为空）',
            };
          }),
        );
      } else {
        const reply = await callLLM(history, 0.7, 'deepseek');
        const aiMsg: ChatMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply.trim() || '（模型返回为空）',
          provider: 'deepseek',
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ChatPanel] send failed:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, mode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex flex-col h-full rounded overflow-hidden"
      style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
    >
      {/* ── Header: title + toggle ───────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #EFEBE2' }}
      >
        <div className="flex items-center gap-2">
          <MessagesSquare size={15} style={{ color: '#5D2A2C' }} />
          <span className="font-serif font-bold text-ui" style={{ color: '#1C1A18', letterSpacing: '0.02em' }}>
            AI 对话
          </span>
        </div>
        <div
          className="flex items-center rounded overflow-hidden"
          style={{ border: '1px solid #E8E3D8', backgroundColor: '#FFFFFF' }}
        >
          {(['deepseek', 'zhida'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex items-center gap-1 px-2.5 py-1 text-micro font-sans font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? '#5D2A2C' : 'transparent',
                color: mode === m ? '#FFFFFF' : '#4A4641',
                letterSpacing: '0.05em',
              }}
              title={MODE_HINT[m]}
            >
              {m === 'deepseek' ? <Globe size={11} /> : <MessagesSquare size={11} />}
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Provider hint line ───────────────────────────────────── */}
      <div
        className="px-4 py-1.5 text-micro font-sans"
        style={{
          color: '#8A847C',
          backgroundColor: '#F4F1EA',
          borderBottom: '1px solid #EFEBE2',
          letterSpacing: '0.05em',
        }}
      >
        {MODE_HINT[mode]}
      </div>

      {/* ── Message list ─────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4 py-8">
            <p className="text-caption font-serif" style={{ color: '#4A4641' }}>
              试试问一个问题
            </p>
            <p className="text-micro font-sans" style={{ color: '#8A847C', lineHeight: 1.7 }}>
              「全网搜」走 DeepSeek，适合通识/概念/数据查证；<br />
              「知乎搜」走知乎直答，适合找 Zhihu 站内素材和真实案例。
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar circle */}
              <div
                className="shrink-0 w-6 h-6 rounded-full grid place-items-center"
                style={{
                  backgroundColor: m.role === 'user' ? '#5D2A2C' : m.provider === 'zhida' ? '#1AAEE8' : '#4A6B8A',
                  color: '#FFFFFF',
                }}
              >
                {m.role === 'user' ? <UserIcon size={11} /> : m.provider === 'zhida' ? '直' : 'D'}
              </div>
              {/* Bubble（assistant 时如果有 reasoning，分两段：思考过程 + 回答） */}
              <div className="flex flex-col gap-1.5" style={{ maxWidth: '85%' }}>
                {m.role === 'assistant' && m.reasoning && m.reasoning.trim() && (
                  <details
                    open={!m.content || m.content.trim() === ''}
                    className="rounded text-micro font-serif"
                    style={{
                      backgroundColor: '#F4F1EA',
                      border: '1px dashed #D8D2C4',
                      color: '#4A4641',
                      padding: '6px 10px',
                      lineHeight: 1.65,
                    }}
                  >
                    <summary
                      className="cursor-pointer select-none font-sans"
                      style={{ color: '#8A847C', letterSpacing: '0.05em' }}
                    >
                      思考过程
                    </summary>
                    <div
                      className="mt-1"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {m.reasoning}
                    </div>
                  </details>
                )}
                <div
                  className="px-3 py-2 rounded text-caption font-serif"
                  style={{
                    backgroundColor: m.role === 'user' ? '#5D2A2C' : '#FFFFFF',
                    color: m.role === 'user' ? '#FFFFFF' : '#1C1A18',
                    border: m.role === 'user' ? 'none' : '1px solid #E8E3D8',
                    lineHeight: 1.7,
                    letterSpacing: '0.015em',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading bubble */}
        {isLoading && (
          <div className="flex gap-2">
            <div
              className="shrink-0 w-6 h-6 rounded-full grid place-items-center"
              style={{
                backgroundColor: mode === 'zhida' ? '#1AAEE8' : '#4A6B8A',
                color: '#FFFFFF',
              }}
            >
              {mode === 'zhida' ? '直' : 'D'}
            </div>
            <div
              className="px-3 py-2 rounded"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E3D8' }}
            >
              <LoadingDots />
            </div>
          </div>
        )}

        {/* Error inline */}
        {error && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded"
            style={{ backgroundColor: '#FDEEEC', border: '1px solid #E8C5BF' }}
          >
            <AlertCircle size={13} style={{ color: '#A53A2C', flexShrink: 0, marginTop: 2 }} />
            <span className="text-micro font-sans" style={{ color: '#A53A2C', lineHeight: 1.6 }}>
              {error}
            </span>
          </div>
        )}
      </div>

      {/* ── Input ────────────────────────────────────────────────── */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid #EFEBE2' }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={mode === 'zhida' ? '问知乎直答：例如某话题有哪些经典案例' : '问 DeepSeek:例如这个概念怎么解释'}
            rows={2}
            className="flex-1 px-3 py-2 rounded text-caption font-serif outline-none resize-none"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#1C1A18',
              border: '1px solid #E8E3D8',
              lineHeight: 1.6,
              maxHeight: 140,
            }}
          />
          <motion.button
            whileHover={input.trim() && !isLoading ? { scale: 1.03 } : {}}
            whileTap={input.trim() && !isLoading ? { scale: 0.97 } : {}}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-3 py-2 rounded text-white font-sans transition-all"
            style={{
              backgroundColor: input.trim() && !isLoading ? '#5D2A2C' : 'rgba(93,42,44,0.25)',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            }}
            title="Enter 发送，Shift+Enter 换行"
          >
            <Send size={14} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
