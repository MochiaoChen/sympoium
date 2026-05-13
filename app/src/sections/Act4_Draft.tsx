/**
 * Act 4 — 下笔 (Writing)
 *
 * 编辑器加侧栏布局。
 * 左侧编辑器（720px），右侧骨架侧栏（320px）。
 * 执笔者基于用户选定的位置生成结构化骨架。
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import AgentBadge from '@/components/AgentBadge';
import LoadingDots from '@/components/LoadingDots';
import { callLLM } from '@/services/api';
import { SKELETON_GENERATION_PROMPT } from '@/data/agentPrompts';

export default function Act4_Draft() {
  const selectedGap = useSymposiumStore((s) => s.selectedGap);
  const draft = useSymposiumStore((s) => s.draft);
  const setDraft = useSymposiumStore((s) => s.setDraft);
  const skeleton = useSymposiumStore((s) => s.skeleton);
  const setSkeleton = useSymposiumStore((s) => s.setSkeleton);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSkeleton = useCallback(async () => {
    if (!selectedGap) return;
    setIsGenerating(true);
    setError(null);
    try {
      const prompt = `${SKELETON_GENERATION_PROMPT}\n\n写作角度：${selectedGap.description}\n推理：${selectedGap.reasoning}`;
      const res = await callLLM([
        { role: 'system', content: prompt },
        { role: 'user', content: '请生成写作骨架，输出JSON。' },
      ]);
      const json = JSON.parse(res);
      setSkeleton(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act4] Skeleton generation failed:', msg);
      setError(`骨架生成失败：${msg}`);
      setSkeleton(null);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedGap, setSkeleton]);

  return (
    <div className="h-full flex gap-6 px-6 py-6 overflow-hidden">
      {/* Left — Editor */}
      <motion.div
        className="flex-1 flex flex-col max-w-prose-default"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-h3 font-bold" style={{ color: '#1C1A18' }}>
            你的草稿
          </h3>
          <span className="text-caption font-sans" style={{ color: '#8A847C' }}>
            {draft.length} 字
          </span>
        </div>
        <div
          className="flex-1 rounded overflow-hidden"
          style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="在这里写下你的草稿，或者粘贴已有内容..."
            className="w-full h-full p-6 resize-none outline-none font-serif text-body-lg"
            style={{
              backgroundColor: 'transparent',
              color: '#1C1A18',
              lineHeight: 1.75,
              letterSpacing: '0.02em',
            }}
          />
        </div>
      </motion.div>

      {/* Right — Skeleton sidebar */}
      <motion.div
        className="w-80 flex flex-col gap-4 overflow-y-auto"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AgentBadge agent="zhibizhe" showRole size="sm" />

        {!skeleton && (
          <motion.div
            className="p-6 rounded"
            style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-body font-serif mb-4" style={{ color: '#4A4641' }}>
              基于你选定的位置
              <span className="font-semibold" style={{ color: '#5D2A2C' }}>
                「{selectedGap?.description}」
              </span>
              ，执笔者可以为你生成一份结构化骨架。
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateSkeleton}
              disabled={isGenerating}
              className="w-full py-3 rounded text-white font-sans font-medium text-ui"
              style={{
                backgroundColor: isGenerating ? 'rgba(93, 42, 44, 0.4)' : '#5D2A2C',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {isGenerating ? <LoadingDots color="#fff" /> : '生成骨架'}
            </motion.button>
            {error && (
              <p className="text-micro font-sans mt-3" style={{ color: '#A53A2C' }}>
                {error}
              </p>
            )}
          </motion.div>
        )}

        {skeleton && (
          <>
            {/* Title candidates */}
            <motion.div
              className="p-5 rounded"
              style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h4 className="font-serif text-ui font-bold mb-3" style={{ color: '#1C1A18' }}>
                标题候选
              </h4>
              <div className="flex flex-col gap-2">
                {skeleton.title_candidates.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setDraft(draft ? `${t}\n\n${draft}` : t)}
                    className="text-left p-3 rounded transition-all hover:translate-x-1"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E8E3D8',
                      fontFamily: '"Noto Serif SC", serif',
                      fontSize: '14px',
                      color: '#1C1A18',
                      lineHeight: 1.6,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Opening hooks */}
            <motion.div
              className="p-5 rounded"
              style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h4 className="font-serif text-ui font-bold mb-3" style={{ color: '#1C1A18' }}>
                开头钩子
              </h4>
              <div className="flex flex-col gap-2">
                {skeleton.opening_hooks.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setDraft(draft ? `${h}\n\n${draft}` : h)}
                    className="text-left p-3 rounded transition-all hover:translate-x-1"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E8E3D8',
                      fontFamily: '"Noto Serif SC", serif',
                      fontSize: '14px',
                      color: '#4A4641',
                      lineHeight: 1.6,
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Key arguments */}
            <motion.div
              className="p-5 rounded"
              style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="font-serif text-ui font-bold mb-3" style={{ color: '#1C1A18' }}>
                关键论点序列
              </h4>
              <div className="flex flex-col gap-3">
                {skeleton.key_arguments.map((arg, i) => (
                  <div
                    key={i}
                    className="p-3 rounded"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E3D8' }}
                  >
                    <div className="font-serif text-caption font-medium mb-1" style={{ color: '#5D2A2C' }}>
                      {i + 1}. {arg.point}
                    </div>
                    <div className="text-micro font-sans mb-1" style={{ color: '#4A4641' }}>
                      举证：{arg.evidence_suggestion}
                    </div>
                    <div className="text-micro font-sans" style={{ color: '#8A847C' }}>
                      防御：{arg.counter_defense}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Structure */}
            <motion.div
              className="p-5 rounded"
              style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h4 className="font-serif text-ui font-bold mb-3" style={{ color: '#1C1A18' }}>
                结构大纲
              </h4>
              <div className="flex flex-col gap-1">
                {skeleton.structure.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-caption font-sans" style={{ color: '#4A4641' }}>
                    <span className="text-micro font-mono" style={{ color: '#8A847C' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
