/**
 * Act 5 — 预演 (Rehearsal)
 *
 * 圆桌布局。七位客人围坐椭圆，依次发言。
 * 一次「开始预演」并行触发：① 全局预测 ② 金句猎人 ③ 主编综合 — 不再依赖段落级弹幕。
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import { callLLM } from '@/services/api';
import {
  LIUKANSHAN_EDITOR_PROMPT,
  GLOBAL_PREDICTION_PROMPT,
  QUOTE_HUNTER_PROMPT,
} from '@/data/agentPrompts';
import type { EditorRoundResult, GlobalPrediction, QuoteHunterResult } from '@/services/api';
import type { Gap } from '@/store/useSymposiumStore';

interface Speaker {
  key: string;
  name: string;
  role: string;
  color: string;
  colorSoft: string;
  topPct: number;
  leftPct: number;
  activeTopPct: number;
  activeLeftPct: number;
  cardOrigin: string;
}

const SPEAKERS: Speaker[] = [
  { key: 'host', name: '刘看山', role: '主编', color: '#0066FF', colorSoft: 'rgba(0,102,255,0.1)', topPct: 8, leftPct: 50, activeTopPct: 10, activeLeftPct: 50, cardOrigin: 'top' },
  { key: 'cartographer', name: '测绘师', role: '答场分析', color: '#3D5C42', colorSoft: 'rgba(61,92,66,0.12)', topPct: 22, leftPct: 22, activeTopPct: 24, activeLeftPct: 24, cardOrigin: 'left' },
  { key: 'critic', name: '校雠', role: '文字精校', color: '#8B6B3A', colorSoft: 'rgba(139,107,58,0.12)', topPct: 22, leftPct: 78, activeTopPct: 24, activeLeftPct: 76, cardOrigin: 'right' },
  { key: 'challenger', name: '问难者', role: '立场审判', color: '#A53A2C', colorSoft: 'rgba(165,58,44,0.12)', topPct: 50, leftPct: 10, activeTopPct: 50, activeLeftPct: 12, cardOrigin: 'left' },
  { key: 'student', name: '学霸型', role: '众生 / 科技理性', color: '#1F3A5F', colorSoft: 'rgba(31,58,95,0.12)', topPct: 50, leftPct: 90, activeTopPct: 50, activeLeftPct: 88, cardOrigin: 'right' },
  { key: 'resonant', name: '共鸣型', role: '众生 / 情感共鸣', color: '#8B5A6B', colorSoft: 'rgba(139,90,107,0.12)', topPct: 78, leftPct: 76, activeTopPct: 76, activeLeftPct: 74, cardOrigin: 'right' },
  { key: 'quotehunter', name: '金句猎人', role: '众生 / 金句采集', color: '#8B7355', colorSoft: 'rgba(139,115,85,0.12)', topPct: 78, leftPct: 24, activeTopPct: 76, activeLeftPct: 26, cardOrigin: 'left' },
];

const ORDER = ['host', 'cartographer', 'critic', 'challenger', 'student', 'resonant', 'quotehunter'];

interface Speech {
  body: string;
  tag: string;
  targetPara: string;
}

function getSpeakerSpeech(
  key: string,
  draft: string,
  paragraphs: string[],
  editorResult: EditorRoundResult | null,
  selectedGap: Gap | null,
  globalPrediction: GlobalPrediction | null,
  quoteHunterResult: QuoteHunterResult | null,
): Speech {
  const fallback = (hint: string): Speech => ({
    body: hint,
    tag: '等待数据',
    targetPara: 'para-0',
  });

  switch (key) {
    case 'host': {
      if (editorResult?.editor_note) {
        return {
          body: editorResult.editor_note,
          tag: '主编综合',
          targetPara: 'para-0',
        };
      }
      return fallback('主编综合尚未生成。点击右下角「生成主编综合」后，刘看山会基于前六幕的数据给出综合意见。');
    }
    case 'cartographer': {
      if (selectedGap) {
        return {
          body: `从答场测绘来看，我们选择的间隙是「${selectedGap.description}」。${selectedGap.reasoning} 这个位置的价值在于${selectedGap.audit_verdict === 'gold' ? '已经被验证为高潜力方向。' : '仍需要进一步论证。'}`,
          tag: '答场定位',
          targetPara: 'para-0',
        };
      }
      return fallback('答场间隙尚未选定。请在第三幕完成测绘并选择一个间隙。');
    }
    case 'critic': {
      const wordCount = draft.length;
      const paraCount = paragraphs.length;
      if (wordCount === 0) return fallback('草稿尚未输入。请在第四幕完成初稿。');
      const avgLen = Math.round(wordCount / (paraCount || 1));
      return {
        body: `全文 ${wordCount} 字，${paraCount} 段，平均每段 ${avgLen} 字。${avgLen > 300 ? '段落偏长，建议拆分为更易读的短段。' : avgLen < 80 ? '段落偏短，节奏快但可能缺乏深度展开。' : '段落长度适中，阅读节奏良好。'}`,
        tag: '结构审读',
        targetPara: 'para-0',
      };
    }
    case 'challenger': {
      if (selectedGap?.strongest_objection) {
        return {
          body: `对当前间隙的核心反驳：${selectedGap.strongest_objection} ${selectedGap.defense_strategy ? '建议的应对策略是：' + selectedGap.defense_strategy : '目前尚未准备应对策略。'}`,
          tag: '立场审判',
          targetPara: 'para-0',
        };
      }
      return fallback('立场审判需要先在第三幕选择间隙并完成问难者的审判。');
    }
    case 'student': {
      if (globalPrediction) {
        return {
          body: `基于预演数据，全文点赞率预测 ${globalPrediction.like_rate}%，评论率 ${globalPrediction.comment_rate}%，划走率 ${globalPrediction.swipe_away_rate}%。${globalPrediction.first_three_lines_survival > 70 ? '前三行留存表现良好。' : '前三行需要加强钩子。'} ${globalPrediction.risk_points.length > 0 ? '存在 ' + globalPrediction.risk_points.length + ' 个风险点需要注意。' : '未发现明显风险点。'}`,
          tag: '数据视角',
          targetPara: 'para-0',
        };
      }
      return fallback('预演数据尚未生成。请在第五幕完成预演。');
    }
    case 'resonant': {
      if (quoteHunterResult && quoteHunterResult.quotes.length > 0) {
        const q = quoteHunterResult.quotes[0];
        return {
          body: `这一句让我有共鸣：「${q.text}」。它的传播力评分是 ${q.viral_score} 分，标签为「${q.tag}」。读者很可能因为这句话而停下来。`,
          tag: '情感共鸣',
          targetPara: 'para-0',
        };
      }
      return fallback('金句猎人尚未发现高传播力句子。请在第五幕完成预演。');
    }
    case 'quotehunter': {
      if (quoteHunterResult && quoteHunterResult.quotes.length > 0) {
        const total = quoteHunterResult.quotes.reduce((s, q) => s + q.viral_score, 0);
        const avg = Math.round(total / quoteHunterResult.quotes.length);
        return {
          body: `本次共捕获 ${quoteHunterResult.quotes.length} 条候选金句，平均传播力 ${avg} 分。最高分的句子建议作为标题截图或开篇钩子使用。`,
          tag: '金句汇总',
          targetPara: 'para-0',
        };
      }
      return fallback('金句库为空。请在第五幕完成预演，让金句猎人扫描全文。');
    }
    default:
      return fallback('该角色尚未准备好发言。');
  }
}

export default function Act5_Rehearsal() {
  const draft = useSymposiumStore((s) => s.draft);
  const globalPrediction = useSymposiumStore((s) => s.globalPrediction);
  const quoteHunterResult = useSymposiumStore((s) => s.quoteHunterResult);
  const selectedGap = useSymposiumStore((s) => s.selectedGap);
  const setEditorRoundResult = useSymposiumStore((s) => s.setEditorRoundResult);
  const setGlobalPrediction = useSymposiumStore((s) => s.setGlobalPrediction);
  const setQuoteHunterResult = useSymposiumStore((s) => s.setQuoteHunterResult);

  const [currentIdx, setCurrentIdx] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [editorResult, setEditorResult] = useState<EditorRoundResult | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const currentKey = ORDER[currentIdx];
  const currentSpeaker = SPEAKERS.find((s) => s.key === currentKey)!;

  const paragraphs = draft.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

  const speech = getSpeakerSpeech(
    currentKey,
    draft,
    paragraphs,
    editorResult,
    selectedGap,
    globalPrediction,
    quoteHunterResult
  );

  // Auto-play sequence
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setTimeout(() => {
      setCurrentIdx((prev) => (prev + 1) % ORDER.length);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, currentIdx]);

  const handleFetchEditorRound = useCallback(async () => {
    setEditorError(null);
    if (!draft.trim()) {
      setEditorError('草稿为空，请先在第四幕完成下笔。');
      return;
    }

    // Run the three independent generations in parallel so the seven speakers
    // populate together rather than in three serial waves.
    const [predictionRes, quotesRes] = await Promise.allSettled([
      callLLM(
        [
          { role: 'system', content: GLOBAL_PREDICTION_PROMPT },
          { role: 'user', content: `[草稿全文]：\n${draft}` },
        ],
        0.3,
      ),
      callLLM(
        [
          { role: 'system', content: QUOTE_HUNTER_PROMPT },
          { role: 'user', content: `[草稿全文]：\n${draft}` },
        ],
        0.6,
      ),
    ]);

    let prediction: GlobalPrediction | null = null;
    if (predictionRes.status === 'fulfilled') {
      try {
        prediction = JSON.parse(predictionRes.value);
        setGlobalPrediction(prediction);
      } catch (e) {
        console.error('[Act5] Global prediction parse failed:', e);
      }
    }

    let quotes: QuoteHunterResult | null = null;
    if (quotesRes.status === 'fulfilled') {
      try {
        quotes = JSON.parse(quotesRes.value);
        setQuoteHunterResult(quotes);
      } catch (e) {
        console.error('[Act5] Quote hunter parse failed:', e);
      }
    }

    try {
      const prompt = `${LIUKANSHAN_EDITOR_PROMPT}\n\n[草稿全文]：\n${draft}\n\n[全文级综合预测]：\n${JSON.stringify(prediction)}\n\n[金句猎人成果]：\n${JSON.stringify(quotes)}`;
      const res = await callLLM([
        { role: 'system', content: prompt },
        { role: 'user', content: '请主持圆桌并输出JSON。' },
      ]);
      const json = JSON.parse(res);
      setEditorResult(json);
      setEditorRoundResult(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act5] Editor round failed:', msg);
      setEditorError(`主编圆桌获取失败：${msg}`);
      setEditorResult(null);
      setEditorRoundResult(null);
    }
  }, [draft, setEditorRoundResult, setGlobalPrediction, setQuoteHunterResult]);

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-y-auto">
      {/* Stage — fixed aspect ratio container to prevent layout breakage */}
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: 0 }}>
        <div
          className="relative w-full"
          style={{ aspectRatio: '2.2 / 1', maxWidth: 1200, maxHeight: '90%' }}
        >
          {/* Subtle elliptical table outline */}
          <div
            className="absolute top-1/2 left-1/2 pointer-events-none"
            style={{
              width: '75%',
              height: '75%',
              transform: 'translate(-50%, -50%)',
              border: '1px dashed #E8E3D8',
              borderRadius: '50%',
              opacity: 0.5,
            }}
          />

          {/* Scene label */}
          <div
            className="absolute top-2 left-2 text-caption font-serif z-10"
            style={{ color: '#8A847C', letterSpacing: '0.18em' }}
          >
            <span className="font-serif italic" style={{ color: '#5D2A2C' }}>scene</span>
            <span className="ml-2">七位客人围坐圆桌，依次发言</span>
          </div>

          {/* Stage note */}
          <div
            className="absolute bottom-2 right-2 text-caption font-serif italic z-10"
            style={{ color: '#8A847C', letterSpacing: '0.06em' }}
          >
            第 {currentIdx + 1} 位发言 / 共 7 位 · 全部发言完毕后由主编综合
          </div>

          {/* Agents */}
          {SPEAKERS.map((sp) => {
            const isActive = sp.key === currentKey;
            const isInactive = !isActive;
            const top = isActive ? sp.activeTopPct : sp.topPct;
            const left = isActive ? sp.activeLeftPct : sp.leftPct;

            return (
              <motion.div
                key={sp.key}
                className="absolute flex flex-col items-center gap-1 cursor-pointer"
                style={{
                  top: `${top}%`,
                  left: `${left}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isActive ? 10 : 2,
                }}
                animate={{ opacity: isInactive ? 0.42 : 1 }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                onClick={() => {
                  const idx = ORDER.indexOf(sp.key);
                  if (idx >= 0) setCurrentIdx(idx);
                }}
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.2 : 1,
                    boxShadow: isActive ? `0 0 0 4px ${sp.colorSoft}` : '0 0 0 0px transparent',
                  }}
                  className="rounded-full"
                  style={{
                    width: isActive ? 12 : 10,
                    height: isActive ? 12 : 10,
                    backgroundColor: sp.color,
                  }}
                />
                <span
                  className="font-serif font-medium text-ui whitespace-nowrap"
                  style={{
                    color: isActive ? sp.color : '#1C1A18',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.05em',
                  }}
                >
                  {sp.name}
                </span>
                <span
                  className="text-micro font-sans"
                  style={{ color: '#8A847C', letterSpacing: '0.1em' }}
                >
                  {sp.role}
                </span>
              </motion.div>
            );
          })}

          {/* Central draft card */}
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              transform: 'translate(-50%, -50%)',
              zIndex: 3,
              width: 420,
              maxWidth: '85%',
            }}
          >
            <div
              className="rounded p-6"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E8E3D8',
                boxShadow: '0 1px 0 #EFEBE2, 0 8px 32px rgba(28, 26, 24, 0.04), 0 2px 8px rgba(28, 26, 24, 0.02)',
              }}
            >
              <div
                className="flex items-center justify-between text-micro font-sans mb-3 pb-3"
                style={{ color: '#8A847C', letterSpacing: '0.1em', borderBottom: '1px solid #EFEBE2' }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#8A847C' }} />
                  草稿 v1.0
                </span>
                <span>{draft.length} 字 · {paragraphs.length} 段</span>
              </div>

              <h2 className="font-serif text-ui font-bold mb-3" style={{ color: '#1C1A18', lineHeight: 1.5 }}>
                {paragraphs[0]?.slice(0, 50) ?? '草稿标题'}{paragraphs[0] && paragraphs[0].length > 50 ? '…' : ''}
              </h2>

              <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                {paragraphs.slice(0, 3).map((para, i) => {
                  const temp = i === 2 ? 'cold' : i === 1 ? 'warm' : 'mild';
                  const bg = temp === 'warm' ? 'rgba(232, 213, 183, 0.18)' : temp === 'cold' ? 'rgba(200, 212, 224, 0.28)' : 'rgba(223, 226, 221, 0.25)';
                  const borderL = temp === 'warm' ? '#E8D5B7' : temp === 'cold' ? '#C8D4E0' : '#DFE2DD';
                  return (
                    <p
                      key={i}
                      className="text-caption font-serif p-1.5"
                      style={{
                        backgroundColor: bg,
                        borderLeft: `2px solid ${borderL}`,
                        color: '#4A4641',
                        lineHeight: 1.85,
                      }}
                    >
                      <span className="font-sans text-micro mr-2" style={{ color: '#B8B1A5', letterSpacing: '0.12em' }}>
                        §{i + 1}
                      </span>
                      {para.slice(0, 70)}…
                    </p>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Speech card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentKey}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute"
              style={{
                zIndex: 5,
                width: 320,
                maxWidth: '75%',
                top: `${currentSpeaker.topPct}%`,
                left: `${currentSpeaker.leftPct}%`,
                transform:
                  currentSpeaker.cardOrigin === 'top'
                    ? 'translate(-50%, 20px)'
                    : currentSpeaker.cardOrigin === 'left'
                    ? 'translate(20px, -50%)'
                    : 'translate(calc(-100% - 20px), -50%)',
              }}
            >
              <div
                className="rounded p-5"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E8E3D8',
                  borderLeft: `3px solid ${currentSpeaker.color}`,
                  boxShadow: '0 2px 0 #EFEBE2, 0 12px 36px rgba(28, 26, 24, 0.06), 0 4px 12px rgba(28, 26, 24, 0.03)',
                }}
              >
                <div className="flex items-center justify-between mb-3 pb-2.5" style={{ borderBottom: '1px solid #EFEBE2' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentSpeaker.color }} />
                    <span className="font-serif font-bold text-ui" style={{ color: '#1C1A18', letterSpacing: '0.05em' }}>
                      {currentSpeaker.name}
                    </span>
                  </div>
                  <span className="text-micro font-sans" style={{ color: '#8A847C', letterSpacing: '0.1em' }}>
                    {currentSpeaker.role}
                  </span>
                </div>

                <p
                  className="text-caption font-serif"
                  style={{ color: '#4A4641', lineHeight: 1.85, letterSpacing: '0.015em' }}
                >
                  {speech.body}
                </p>

                <div className="mt-3 pt-2.5 flex items-center justify-between" style={{ borderTop: '1px solid #EFEBE2' }}>
                  <span className="text-micro font-sans flex items-center gap-1.5" style={{ color: '#8A847C', letterSpacing: '0.08em' }}>
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: currentSpeaker.color, opacity: 0.6 }} />
                    {speech.tag}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentIdx((prev) => (prev - 1 + ORDER.length) % ORDER.length)}
                      className="w-6 h-6 grid place-items-center rounded border text-caption"
                      style={{ borderColor: '#E8E3D8', backgroundColor: '#FBF9F3', color: '#8A847C' }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setCurrentIdx((prev) => (prev + 1) % ORDER.length)}
                      className="w-6 h-6 grid place-items-center rounded border text-caption"
                      style={{ borderColor: '#E8E3D8', backgroundColor: '#FBF9F3', color: '#8A847C' }}
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Editor round result */}
          <AnimatePresence>
            {editorResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-1/2 left-1/2"
                style={{
                  transform: 'translate(-50%, -50%)',
                  zIndex: 6,
                  width: 480,
                  maxWidth: '90%',
                }}
              >
                <div
                  className="rounded p-8"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E8E3D8',
                    borderLeft: '3px solid #0066FF',
                    boxShadow: '0 12px 48px rgba(28, 26, 24, 0.08)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0066FF' }} />
                    <span className="font-serif font-bold text-ui" style={{ color: '#1C1A18' }}>
                      刘看山 · 主编综合
                    </span>
                  </div>
                  <p className="text-body font-serif mb-6" style={{ color: '#4A4641', lineHeight: 1.75 }}>
                    {editorResult.editor_note}
                  </p>
                  <div className="flex flex-col gap-3">
                    {editorResult.suggestions.map((s, i) => (
                      <div key={i} className="p-4 rounded" style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-micro" style={{ color: '#5D2A2C' }}>#{s.paragraph_id}</span>
                          <span className="text-caption font-sans font-medium" style={{ color: '#1C1A18' }}>{s.issue}</span>
                        </div>
                        <div className="text-micro font-sans" style={{ color: '#8A847C' }}>
                          来自 {s.from_reader} · {s.direction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #E8E3D8' }}>
        <div className="flex items-center gap-3 text-caption font-sans" style={{ color: '#8A847C' }}>
          <span className="font-serif italic">已发言 {currentIdx + 1} / 7</span>
          <span>·</span>
          <span>建议清单将在所有客人发言结束后生成</span>
        </div>
        <div className="flex gap-3">
          {!editorResult && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAutoPlaying((p) => !p)}
              className="px-5 py-2.5 rounded font-sans font-medium text-ui transition-all"
              style={{
                border: '1px solid #4A4641',
                color: '#1C1A18',
                backgroundColor: 'transparent',
                letterSpacing: '0.05em',
              }}
            >
              {isAutoPlaying ? '暂停发言' : '自动发言'}
            </motion.button>
          )}
          {!editorResult && (
            <div className="flex items-center gap-3">
              {editorError && (
                <span className="text-micro font-sans" style={{ color: '#A53A2C' }}>
                  {editorError}
                </span>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleFetchEditorRound}
                className="px-6 py-2.5 rounded text-white font-sans font-medium text-ui transition-all"
                style={{
                  backgroundColor: '#5D2A2C',
                  letterSpacing: '0.05em',
                }}
              >
                生成主编综合
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
