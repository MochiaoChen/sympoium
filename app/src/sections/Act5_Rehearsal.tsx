/**
 * Act 5 — 预演 (Rehearsal)
 *
 * 长文阅读栏 + 右侧综合面板。
 * 草稿按段落展示，每段背景按温度上色。
 * 点击段落后在下方展开多视角观点列表（当前为 mock 数据）。
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import LoadingDots from '@/components/LoadingDots';
import { callLLM } from '@/services/api';
import {
  LAOXUE_SYSTEM_PROMPT,
  GANGJING_SYSTEM_PROMPT,
  GONGMING_SYSTEM_PROMPT,
  JINJIE_SYSTEM_PROMPT,
  LUREN_SYSTEM_PROMPT,
  KOL_SYSTEM_PROMPT,
  LIUKANSHAN_PARAGRAPH_PROMPT,
  GLOBAL_PREDICTION_PROMPT,
  QUOTE_HUNTER_PROMPT,
} from '@/data/agentPrompts';
import type { ParagraphReaction } from '@/services/api';

const PERSONAS = [
  { key: 'laoxue', name: '考据组', color: '#4A6FA5', prompt: LAOXUE_SYSTEM_PROMPT },
  { key: 'gangjing', name: '抬杠侠', color: '#C13B3B', prompt: GANGJING_SYSTEM_PROMPT },
  { key: 'gongming', name: '破防选手', color: '#E36AAB', prompt: GONGMING_SYSTEM_PROMPT },
  { key: 'jinjie', name: '截图怪', color: '#F0B62F', prompt: JINJIE_SYSTEM_PROMPT },
  { key: 'luren', name: '划走预备役', color: '#888888', prompt: LUREN_SYSTEM_PROMPT },
  { key: 'kol', name: '业内观察', color: '#2E8B6F', prompt: KOL_SYSTEM_PROMPT },
  { key: 'liukanshan', name: '刘看山', color: '#0066FF', prompt: LIUKANSHAN_PARAGRAPH_PROMPT },
];

// Mock perspectives for each paragraph (will be replaced by LLM output later)
const MOCK_VIEWS: Record<string, string> = {
  laoxue: '论据密度尚可，但缺少一个具体的出处或数据支撑。如果这里能引用一项研究或统计，说服力会显著增强。',
  gangjing: '这一段有个隐含假设：读者默认认同你的前提。如果我不认同，整段都会失效。建议在这里先花一句建立共识。',
  gongming: '读到中间那句的时候确实有触动，但结尾收得太急，情绪还没落地就被打断了。建议把最后一句展开半行。',
  jinjie: '这一段缺乏「截图感」。没有一句能让人直接复制发朋友圈的句子。建议把核心观点压缩成一句带节奏的话。',
  luren: '前三行没有钩子，差点划走。第四行才开始有意思。建议把第四行的核心信息搬到开头。',
  kol: '这个话题在业内已经被讨论过很多轮了，你的切入角度和主流观点差异不够大。需要找到一个更尖锐的差异化立场。',
  liukanshan: '作为编辑，我认为这一段的信息密度和情绪节奏是匹配的，但段落之间的过渡可以更自然一些。',
};

function getHeatColor(score: number): string {
  if (score >= 75) return '#D9B88E';
  if (score >= 60) return '#E8D5B7';
  if (score >= 45) return '#F2EFE7';
  if (score >= 30) return '#DFE2DD';
  return '#C8D4E0';
}

function getLeftBarColor(score: number): string {
  if (score >= 75) return '#D9B88E';
  if (score >= 60) return '#E8D5B7';
  if (score >= 45) return '#B8B1A5';
  if (score >= 30) return '#7AB8FF';
  return '#3A7BD5';
}

export default function Act5_Rehearsal() {
  const draft = useSymposiumStore((s) => s.draft);
  const paragraphReactions = useSymposiumStore((s) => s.paragraphReactions);
  const setParagraphReactions = useSymposiumStore((s) => s.setParagraphReactions);
  const globalPrediction = useSymposiumStore((s) => s.globalPrediction);
  const setGlobalPrediction = useSymposiumStore((s) => s.setGlobalPrediction);
  const quoteHunterResult = useSymposiumStore((s) => s.quoteHunterResult);
  const setQuoteHunterResult = useSymposiumStore((s) => s.setQuoteHunterResult);

  const [isRehearsing, setIsRehearsing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [rehearsalErrors, setRehearsalErrors] = useState<string[]>([]);
  const [expandedPara, setExpandedPara] = useState<number | null>(null);

  const paragraphs = useMemo(() => {
    return draft
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [draft]);

  const handleRehearse = useCallback(async () => {
    if (paragraphs.length === 0) return;
    setIsRehearsing(true);
    setShowResults(false);
    setRehearsalErrors([]);

    const newReactions = new Map<number, Map<string, ParagraphReaction>>();
    const errors: string[] = [];

    for (let pid = 0; pid < paragraphs.length; pid++) {
      newReactions.set(pid, new Map());
      const paraText = paragraphs[pid];
      const fullDraft = draft;

      await Promise.all(
        PERSONAS.map(async (persona) => {
          try {
            const res = await callLLM(
              [
                { role: 'system', content: persona.prompt },
                {
                  role: 'user',
                  content: `[目标圈层]：泛知识圈\n\n[草稿全文]：\n${fullDraft}\n\n[当前段落 paragraph_id=${pid}，共 ${paragraphs.length} 段]：\n${paraText}\n\n请按你的人设阅读这一段并给出反应。`,
                },
              ],
              0.85
            );
            const json = JSON.parse(res);
            newReactions.get(pid)!.set(persona.key, {
              danmu: json.danmu ?? '...',
              continue_prob: json.continue_prob ?? 50,
              emoji: json.emoji ?? '😐',
              highlight_phrase: json.highlight_phrase ?? null,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[Act5] Persona ${persona.key} failed:`, msg);
            errors.push(`${persona.name}反应获取失败`);
          }
        })
      );
    }

    setParagraphReactions(newReactions);

    // Global prediction
    try {
      const gp = await callLLM(
        [
          { role: 'system', content: GLOBAL_PREDICTION_PROMPT },
          { role: 'user', content: `[草稿全文]：\n${draft}` },
        ],
        0.3
      );
      setGlobalPrediction(JSON.parse(gp));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act5] Global prediction failed:', msg);
      errors.push('全局预测获取失败');
      setGlobalPrediction(null);
    }

    // Quote hunter
    try {
      const qh = await callLLM(
        [
          { role: 'system', content: QUOTE_HUNTER_PROMPT },
          { role: 'user', content: `[草稿全文]：\n${draft}` },
        ],
        0.6
      );
      setQuoteHunterResult(JSON.parse(qh));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act5] Quote hunter failed:', msg);
      errors.push('金句猎人获取失败');
      setQuoteHunterResult(null);
    }

    if (errors.length > 0) {
      setRehearsalErrors(errors);
    }
    setIsRehearsing(false);
    setShowResults(true);
  }, [draft, paragraphs, setParagraphReactions, setGlobalPrediction, setQuoteHunterResult]);

  const getParaScore = (pid: number): number => {
    const map = paragraphReactions.get(pid);
    if (!map || map.size === 0) return 50;
    let sum = 0;
    map.forEach((r) => (sum += r.continue_prob));
    return Math.round(sum / map.size);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 px-6 py-6 overflow-hidden">
      {/* Left — Draft with heatmap + paragraph perspectives */}
      <motion.div
        className="flex-1 flex flex-col max-w-prose-narrow overflow-hidden"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-h3 font-bold" style={{ color: '#1C1A18' }}>
            你的草稿
          </h3>
          <span className="text-caption font-sans" style={{ color: '#8A847C' }}>
            {paragraphs.length} 段 · {draft.length} 字
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex flex-col gap-6">
            {paragraphs.map((para, pid) => {
              const score = getParaScore(pid);
              const bg = getHeatColor(score);
              const leftBar = getLeftBarColor(score);
              const isExpanded = expandedPara === pid;

              return (
                <div key={pid} className="relative">
                  {/* Paragraph container — clickable */}
                  <motion.div
                    className="relative p-4 rounded cursor-pointer transition-all"
                    style={{
                      backgroundColor: bg,
                      borderLeft: `3px solid ${leftBar}`,
                    }}
                    onClick={() => setExpandedPara(isExpanded ? null : pid)}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span
                      className="absolute -left-6 top-1/2 -translate-y-1/2 text-micro font-mono"
                      style={{ color: '#B8B1A5' }}
                    >
                      §{pid + 1}
                    </span>
                    <p
                      className="font-serif text-body-lg"
                      style={{ color: '#1C1A18', lineHeight: 1.75 }}
                    >
                      {para}
                    </p>

                    {/* Score badge */}
                    {showResults && (
                      <div
                        className="absolute top-2 right-2 px-2 py-0.5 rounded text-micro font-sans"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.7)',
                          color: '#4A4641',
                          border: '1px solid #E8E3D8',
                        }}
                      >
                        留存 {score}%
                      </div>
                    )}

                    {/* Expand hint */}
                    {showResults && (
                      <div
                        className="mt-2 text-micro font-sans flex items-center gap-1"
                        style={{ color: '#8A847C' }}
                      >
                        <span>{isExpanded ? '▾' : '▸'}</span>
                        <span>{isExpanded ? '收起视角' : '点击展开多视角观点'}</span>
                      </div>
                    )}
                  </motion.div>

                  {/* Expanded perspective list */}
                  <AnimatePresence>
                    {isExpanded && showResults && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div
                          className="mt-3 rounded p-4"
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E8E3D8',
                            boxShadow: '0 4px 16px rgba(28, 26, 24, 0.04)',
                          }}
                        >
                          <div
                            className="flex items-center justify-between mb-3 pb-2"
                            style={{ borderBottom: '1px solid #E8E3D8' }}
                          >
                            <span className="text-caption font-sans font-medium" style={{ color: '#4A4641' }}>
                              段{pid + 1} · 多视角反应
                            </span>
                            <span className="text-micro font-sans" style={{ color: '#8A847C' }}>
                              {PERSONAS.length} 个视角
                            </span>
                          </div>

                          <div className="flex flex-col gap-2.5">
                            {PERSONAS.map((p) => {
                              // Use mock views for now. Later these will come from LLM.
                              const viewText = MOCK_VIEWS[p.key] ?? '暂无观点';
                              return (
                                <div
                                  key={p.key}
                                  className="p-3 rounded"
                                  style={{
                                    backgroundColor: '#FBF9F3',
                                    border: `1px solid ${p.color}25`,
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    <span
                                      className="text-micro font-sans font-medium"
                                      style={{ color: p.color }}
                                    >
                                      {p.name}
                                    </span>
                                  </div>
                                  <p
                                    className="text-caption font-serif"
                                    style={{ color: '#1C1A18', lineHeight: 1.7 }}
                                  >
                                    {viewText}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action bar */}
        {!showResults && (
          <div className="mt-4 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRehearse}
              disabled={isRehearsing || paragraphs.length === 0}
              className="px-8 py-3 rounded text-white font-sans font-medium text-ui"
              style={{
                backgroundColor:
                  isRehearsing || paragraphs.length === 0
                    ? 'rgba(93, 42, 44, 0.4)'
                    : '#5D2A2C',
                cursor:
                  isRehearsing || paragraphs.length === 0
                    ? 'not-allowed'
                    : 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {isRehearsing ? <LoadingDots color="#fff" /> : '开始预演'}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Right — Prediction + Quotes */}
      <motion.div
        className="lg:w-80 flex flex-col gap-4 overflow-hidden"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {/* Empty state */}
        {!showResults && (
          <div
            className="flex-1 rounded flex flex-col items-center justify-center gap-3 p-6"
            style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
          >
            <span className="text-caption font-sans" style={{ color: '#8A847C' }}>
              预演结束后
            </span>
            <span className="text-caption font-sans" style={{ color: '#8A847C' }}>
              综合预测与金句猎人将显示在这里
            </span>
          </div>
        )}

        {/* Error banner */}
        <AnimatePresence>
          {showResults && rehearsalErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded"
              style={{ backgroundColor: '#F4E8E6', border: '1px solid #E8E3D8' }}
            >
              <p className="text-micro font-sans font-medium mb-1" style={{ color: '#A53A2C' }}>
                部分数据获取失败
              </p>
              {rehearsalErrors.map((err, i) => (
                <p key={i} className="text-micro font-sans" style={{ color: '#8B3A2C' }}>
                  · {err}
                </p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global prediction bars */}
        <AnimatePresence>
          {showResults && globalPrediction && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded"
              style={{
                backgroundColor: '#FBF9F3',
                border: '1px solid #E8E3D8',
              }}
            >
              <h4
                className="font-serif text-ui font-bold mb-4"
                style={{ color: '#1C1A18' }}
              >
                综合预测
              </h4>
              {[
                { label: '点赞率', value: globalPrediction.like_rate, color: '#4A6B42' },
                { label: '评论率', value: globalPrediction.comment_rate, color: '#4A6B8A' },
                { label: '收藏率', value: globalPrediction.favorite_rate, color: '#A07535' },
                { label: '划走率', value: globalPrediction.swipe_away_rate, color: '#8B3A2C' },
              ].map((item) => (
                <div key={item.label} className="mb-3">
                  <div className="flex items-center justify-between text-caption font-sans mb-1">
                    <span style={{ color: '#4A4641' }}>{item.label}</span>
                    <span className="font-mono" style={{ color: item.color }}>
                      {item.value}%
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: '#E8E3D8' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{
                        duration: 1.2,
                        ease: [0.22, 0.61, 0.36, 1],
                      }}
                    />
                  </div>
                </div>
              ))}

              {globalPrediction.risk_points.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid #E8E3D8' }}>
                  <h5
                    className="text-caption font-sans font-medium mb-2"
                    style={{ color: '#8B3A2C' }}
                  >
                    风险点
                  </h5>
                  {globalPrediction.risk_points.map((rp, i) => (
                    <div
                      key={i}
                      className="text-micro font-sans mb-1"
                      style={{ color: '#4A4641' }}
                    >
                      · {rp.text} — {rp.reason}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quote hunter */}
        <AnimatePresence>
          {showResults && quoteHunterResult && quoteHunterResult.quotes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded"
              style={{
                backgroundColor: '#FBF9F3',
                border: '1px solid #E8E3D8',
              }}
            >
              <h4
                className="font-serif text-ui font-bold mb-3"
                style={{ color: '#1C1A18' }}
              >
                金句猎人
              </h4>
              {quoteHunterResult.quotes.map((q, i) => (
                <div
                  key={i}
                  className="mb-2 p-3 rounded"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E8E3D8',
                  }}
                >
                  <p
                    className="text-caption font-serif mb-1"
                    style={{ color: '#1C1A18' }}
                  >
                    「{q.text}」
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-micro font-mono"
                      style={{ color: '#A07535' }}
                    >
                      {q.viral_score}分
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-micro text-white font-sans"
                      style={{ backgroundColor: '#A07535' }}
                    >
                      {q.tag}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
