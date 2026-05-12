/**
 * Act 7 — 出酒 (Publication)
 *
 * 预览加发布布局。
 * 最终预览（干净的长文阅读视图），发布到知乎圈子 / 复制全文。
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import AgentBadge from '@/components/AgentBadge';

export default function Act7_Publish() {
  const draft = useSymposiumStore((s) => s.draft);
  const selectedQuestion = useSymposiumStore((s) => s.selectedQuestion);
  const editorRoundResult = useSymposiumStore((s) => s.editorRoundResult);

  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = draft;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [draft]);

  const handlePublish = useCallback(() => {
    // Demo: simulate publish success
    setPublished(true);
  }, []);

  const paragraphs = draft.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

  return (
    <div className="h-full flex flex-col items-center px-4 py-8 overflow-y-auto">
      <div className="max-w-prose-narrow w-full flex flex-col gap-8">
        {/* Header */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AgentBadge agent="liukanshan" showRole size="md" />
          <h2 className="font-serif text-h1 font-bold" style={{ color: '#1C1A18' }}>
            出酒
          </h2>
          <p className="text-body font-sans" style={{ color: '#8A847C' }}>
            宴会结束，作品交付
          </p>
        </motion.div>

        {/* Final preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div
            className="rounded p-10"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E3D8',
              boxShadow: '0 1px 3px rgba(28, 26, 24, 0.04)',
            }}
          >
            <div className="mb-6 pb-4" style={{ borderBottom: '1px solid #E8E3D8' }}>
              <span className="text-micro font-sans" style={{ color: '#8A847C', letterSpacing: '0.1em' }}>
                最终预览 · {paragraphs.length} 段 · {draft.length} 字
              </span>
              {selectedQuestion && (
                <p className="text-caption font-sans mt-1" style={{ color: '#4A4641' }}>
                  回答：{selectedQuestion.title}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {paragraphs.map((para, i) => (
                <p
                  key={i}
                  className="font-serif text-body-lg"
                  style={{
                    color: '#1C1A18',
                    lineHeight: 1.75,
                    letterSpacing: '0.02em',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>

            {editorRoundResult && editorRoundResult.suggestions.length > 0 && (
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid #E8E3D8' }}>
                <h4 className="font-serif text-ui font-bold mb-3" style={{ color: '#1C1A18' }}>
                  采纳的修改建议
                </h4>
                <div className="flex flex-col gap-2">
                  {editorRoundResult.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-caption font-sans" style={{ color: '#4A4641' }}>
                      <span className="font-mono text-micro shrink-0" style={{ color: '#5D2A2C' }}>
                        #{s.paragraph_id}
                      </span>
                      <span>{s.direction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded font-sans font-medium text-ui transition-all"
            style={{
              border: '1px solid #4A4641',
              color: '#1C1A18',
              backgroundColor: 'transparent',
              letterSpacing: '0.05em',
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '已复制' : '复制全文'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePublish}
            disabled={published}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded text-white font-sans font-medium text-ui transition-all"
            style={{
              backgroundColor: published ? '#4A6B42' : '#5D2A2C',
              letterSpacing: '0.05em',
              cursor: published ? 'default' : 'pointer',
            }}
          >
            <ExternalLink size={16} />
            {published ? '已发布到知乎圈子' : '发布到知乎圈子'}
          </motion.button>
        </motion.div>

        {/* Post-publish feedback */}
        {published && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded"
            style={{ backgroundColor: 'rgba(74, 107, 66, 0.08)', border: '1px solid #4A6B42' }}
          >
            <p className="text-body font-sans mb-2" style={{ color: '#4A4641' }}>
              发布成功！
            </p>
            <p className="text-caption font-sans" style={{ color: '#8A847C' }}>
              你的答案已在知乎圈子中可见。真实互动数据将在几分钟后同步到这里。
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
