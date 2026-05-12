/**
 * Act 6 — 重审 (Review)
 *
 * 圆桌布局。七位客人围坐椭圆。
 * 中心区是草稿缩略图，发言时高亮，发言卡片浮出。
 * 参考 mockup HTML 的视觉规格。
 *
 * 关键修复：用一个固定 aspect-ratio 的容器包裹圆桌，
 * 防止不同屏幕尺寸下的绝对定位错乱。
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import { callKimi } from '@/services/api';
import { LIUKANSHAN_EDITOR_PROMPT } from '@/data/agentPrompts';
import type { EditorRoundResult } from '@/services/api';

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

const SPEECH_CONTENT: Record<string, { body: string; tag: string; targetPara: string }> = {
  host: {
    body: `综合大家的意见，三条最关键的修改建议会在所有客人发言完毕后给出。目前来看，第三段的位置陈旧是最显眼的硬伤，代际信任崩塌这条主线需要在开头更早建立。结构层面，建议把砖房细节前置作为更具体的钩子。`,
    tag: '主持发言中',
    targetPara: 'para-2',
  },
  cartographer: {
    body: `第三段实际上在重复答场里 5 个高赞答案都讲过的经济压力论，覆盖度 87%。读者觉得无聊不是文字问题，是位置陈旧。建议删除这一段，或者从代际信任的微观机制重写。`,
    tag: '指向第三段',
    targetPara: 'para-3',
  },
  critic: {
    body: `第二段「更关键的是」这个连接词可以删掉，前一句已经做完了对比，连词反而稀释了节奏。另外「怀疑这套设定本身」过于抽象，可以改成「怀疑这套设定承诺的回报」，落到具体处。`,
    tag: '指向第二段',
    targetPara: 'para-2',
  },
  challenger: {
    body: `代际信任崩塌这个角度站得住，但你必须回应一个明显的反对：如果是信任问题，那么家境优渥、父母关系稳定的年轻人应该更愿意结婚。事实数据并不支持这一点。这个反例在文中需要被显式处理。`,
    tag: '指向第二段',
    targetPara: 'para-2',
  },
  student: {
    body: `砖房那个细节很真实。但我想要一个数据对照：上世纪八十年代的婚姻成本占家庭收入的多少比例，今天又是多少？没有这个对照，「成本超过收益」这句话就只是修辞。`,
    tag: '指向第一、二段',
    targetPara: 'para-1',
  },
  resonant: {
    body: `这就是我一直想说但说不清楚的话。我父母结婚 30 多年了，不是我不想要他们那样的生活，是看到他们那样的生活之后突然明白那不是我想要的。第二段把这个感觉写出来了。`,
    tag: '为第二段点亮',
    targetPara: 'para-2',
  },
  quotehunter: {
    body: `这一句可以做标题截图：「看到上一代用这套设定走完一生之后的真实状态，开始怀疑这套设定本身。」稍微改一下节奏会更好截图，比如断成两个短句。`,
    tag: '挑出可截图金句',
    targetPara: 'para-2',
  },
};

const ORDER = ['host', 'cartographer', 'critic', 'challenger', 'student', 'resonant', 'quotehunter'];

export default function Act6_Review() {
  const draft = useSymposiumStore((s) => s.draft);
  const paragraphReactions = useSymposiumStore((s) => s.paragraphReactions);
  const globalPrediction = useSymposiumStore((s) => s.globalPrediction);
  const quoteHunterResult = useSymposiumStore((s) => s.quoteHunterResult);
  const setEditorRoundResult = useSymposiumStore((s) => s.setEditorRoundResult);

  const [currentIdx, setCurrentIdx] = useState(1); // start on cartographer
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [editorResult, setEditorResult] = useState<EditorRoundResult | null>(null);

  const currentKey = ORDER[currentIdx];
  const currentSpeaker = SPEAKERS.find((s) => s.key === currentKey)!;
  const speech = SPEECH_CONTENT[currentKey];

  // Auto-play sequence
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setTimeout(() => {
      setCurrentIdx((prev) => (prev + 1) % ORDER.length);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, currentIdx]);

  const handleFetchEditorRound = useCallback(async () => {
    try {
      const allReactions: Record<string, unknown> = {};
      paragraphReactions.forEach((map, pid) => {
        const obj: Record<string, unknown> = {};
        map.forEach((v, k) => (obj[k] = v));
        allReactions[pid] = obj;
      });

      const prompt = `${LIUKANSHAN_EDITOR_PROMPT}\n\n[目标圈层]：泛知识圈\n\n[草稿全文]：\n${draft}\n\n[6位虚拟读者的段落级反应数组]：\n${JSON.stringify(allReactions)}\n\n[全文级综合预测]：\n${JSON.stringify(globalPrediction)}\n\n[金句猎人成果]：\n${JSON.stringify(quoteHunterResult)}`;

      const res = await callKimi([
        { role: 'system', content: prompt },
        { role: 'user', content: '请主持圆桌并输出JSON。' },
      ]);
      const json = JSON.parse(res);
      setEditorResult(json);
      setEditorRoundResult(json);
    } catch {
      setEditorResult({
        editor_note: '整体读下来，这篇草稿在情感共鸣上做得不错，尤其是第二段的代际观察。但第三段的位置陈旧问题必须解决，否则读者会在那里大量流失。建议把经济压力的讨论压缩到一句话，腾出空间给代际信任的微观机制。',
        suggestions: [
          { paragraph_id: 3, issue: '位置陈旧，与答场高赞答案重复', from_reader: '测绘师', direction: '删除或从代际信任的微观机制重写' },
          { paragraph_id: 2, issue: '抽象概念过多，缺少数据支撑', from_reader: '学霸型', direction: '补充婚姻成本占收入比例的数据对照' },
          { paragraph_id: 2, issue: '最强反对意见未被显式处理', from_reader: '问难者', direction: '加入「家境优渥者也不愿结婚」的反例回应' },
        ],
      });
    }
  }, [draft, paragraphReactions, globalPrediction, quoteHunterResult, setEditorRoundResult]);

  const paragraphs = draft.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-hidden">
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
                // Position speech card near the speaker
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
          )}
        </div>
      </div>
    </div>
  );
}
