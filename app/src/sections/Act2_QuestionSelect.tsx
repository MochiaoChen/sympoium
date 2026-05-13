/**
 * Act 2 — 择题 (Question Selection)
 *
 * 列表布局。话题展开成具体的知乎问题清单。
 * 每行展示问题标题、回答数、饱和度评分。
 */

import { useEffect, useState, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ThumbsUp, TrendingUp, TrendingDown, ArrowRight, ExternalLink } from 'lucide-react';
import { searchZhihu } from '@/services/api';
import type { SearchItem } from '@/services/api';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import AgentBadge from '@/components/AgentBadge';
import LoadingDots from '@/components/LoadingDots';

export default function Act2_QuestionSelect() {
  const selectedTopic = useSymposiumStore((s) => s.selectedTopic);
  const selectedQuestion = useSymposiumStore((s) => s.selectedQuestion);
  const setSelectedQuestion = useSymposiumStore((s) => s.setSelectedQuestion);

  const [results, setResults] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [topAnswerUrls, setTopAnswerUrls] = useState('');

  useEffect(() => {
    if (selectedTopic && results.length === 0) {
      setIsLoading(true);
      searchZhihu(selectedTopic, 5)
        .then((list) => setResults(list))
        .catch((err) => console.error('Search failed:', err))
        .finally(() => setIsLoading(false));
    }
  }, [selectedTopic, results.length]);

  const handleSelect = useCallback(
    (item: SearchItem) => {
      setSelectedQuestion(
        selectedQuestion?.title === item.Title
          ? null
          : { title: item.Title, url: item.Url }
      );
    },
    [selectedQuestion, setSelectedQuestion]
  );

  const handleUseUrlDirectly = useCallback(() => {
    if (topAnswerUrls.trim()) {
      setSelectedQuestion({
        title: topAnswerUrls.trim(),
        url: topAnswerUrls.trim(),
      });
    }
  }, [topAnswerUrls, setSelectedQuestion]);

  const getSaturation = (votes: number) => {
    if (votes > 10000) return { value: 92, level: 'high' as const, color: '#8B3A2C' };
    if (votes > 3000) return { value: 67, level: 'medium' as const, color: '#A07535' };
    return { value: 34, level: 'low' as const, color: '#4A6B42' };
  };

  const getTrendArrow = (level: string) => {
    if (level === 'high') return <TrendingDown size={14} color="#8B3A2C" />;
    if (level === 'medium') return <ArrowRight size={14} color="#A07535" />;
    return <TrendingUp size={14} color="#4A6B42" />;
  };

  return (
    <div className="h-full flex flex-col items-center px-4 py-8 overflow-y-auto">
      <div className="max-w-prose-default w-full flex flex-col gap-6">
        {/* 望气者 header */}
        <motion.div
          className="flex items-start gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AgentBadge agent="wangqi" showRole size="sm" />
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div
              className="rounded"
              style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
            >
              <div className="flex">
                <div
                  className="shrink-0"
                  style={{ width: 4, backgroundColor: '#4A6B8A', borderRadius: '4px 0 0 4px' }}
                />
                <div className="flex-1 p-5">
                  <div className="font-serif font-medium text-ui mb-2" style={{ color: '#4A6B8A' }}>
                    望气者
                  </div>
                  <div className="font-serif text-body" style={{ color: '#1C1A18' }}>
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <LoadingDots />
                        <span style={{ color: '#8A847C' }}>正在搜索相关问题...</span>
                      </div>
                    ) : (
                      <>
                        已选定话题。
                        <span className="font-semibold" style={{ color: '#5D2A2C' }}>
                          「{selectedTopic}」
                        </span>
                        以下是在此话题下最值得回答的问题清单。
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Topic header bar */}
        {!isLoading && (
          <motion.div
            className="p-5 rounded"
            style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="font-serif text-h2 font-bold" style={{ color: '#1C1A18' }}>
              {selectedTopic}
            </h2>
            <div className="mt-3 h-px w-full" style={{ backgroundColor: '#E8E3D8' }} />
          </motion.div>
        )}

        {/* Question list */}
        <div className="flex flex-col gap-3">
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-12">
              <LoadingDots />
              <p className="text-body" style={{ color: '#8A847C' }}>
                正在搜索相关问题...
              </p>
            </div>
          )}

          {!isLoading &&
            results.map((item, idx) => {
              const sat = getSaturation(item.VoteUpCount);
              const isSelected = selectedQuestion?.title === item.Title;
              const previewText = (item.ContentText ?? '').trim();
              const hasPreview = previewText.length > 0;
              const hasUrl = !!item.Url && /^https?:/.test(item.Url);

              return (
                <Fragment key={idx}>
                  <motion.button
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + idx * 0.1,
                      ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number],
                    }}
                    whileHover={{ x: 4 }}
                    onClick={() => handleSelect(item)}
                    className="relative text-left p-5 rounded transition-all"
                    style={{
                      backgroundColor: '#FBF9F3',
                      border: isSelected ? '1px solid #5D2A2C' : '1px solid #E8E3D8',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(28, 26, 24, 0.06)'
                        : '0 1px 3px rgba(28, 26, 24, 0.04)',
                      borderLeft: isSelected ? '3px solid #5D2A2C' : '1px solid #E8E3D8',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3
                        className="font-serif text-h3 font-medium flex-1"
                        style={{ color: '#1C1A18' }}
                      >
                        {item.Title}
                      </h3>
                      <span
                        className="shrink-0 px-3 py-1 rounded text-caption text-white font-sans font-medium"
                        style={{ backgroundColor: sat.color, letterSpacing: '0.05em' }}
                      >
                        热度 {sat.value}%
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <span className="flex items-center gap-1 text-caption font-sans" style={{ color: '#8A847C' }}>
                        <ThumbsUp size={13} />
                        {item.VoteUpCount >= 10000
                          ? `${(item.VoteUpCount / 10000).toFixed(1)}万`
                          : item.VoteUpCount}
                        赞同
                      </span>
                      <span className="flex items-center gap-1 text-caption font-sans" style={{ color: '#8A847C' }}>
                        <MessageCircle size={13} />
                        {item.CommentCount} 评论
                      </span>
                      <span className="flex items-center gap-1 text-caption font-sans" style={{ color: '#8A847C' }}>
                        {getTrendArrow(sat.level)}
                        {sat.level === 'high' ? '讨论饱和' : sat.level === 'medium' ? '讨论适中' : '新鲜角度'}
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E8E3D8' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: sat.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${sat.value}%` }}
                        transition={{ duration: 0.6, delay: 0.8 + idx * 0.1 }}
                      />
                    </div>
                  </motion.button>

                  {/* Preview card — only when this question is selected */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="-mt-1 ml-4 p-5 rounded"
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E8E3D8',
                          borderLeft: '3px solid #D9B88E',
                        }}
                      >
                        {/* Author row */}
                        {(item.AuthorName || item.AuthorAvatar) && (
                          <div className="flex items-center gap-2 mb-3">
                            {item.AuthorAvatar && (
                              <img
                                src={item.AuthorAvatar}
                                alt={item.AuthorName ?? '作者'}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full object-cover"
                                style={{ border: '1px solid #E8E3D8' }}
                              />
                            )}
                            <span className="text-caption font-serif font-medium" style={{ color: '#1C1A18' }}>
                              {item.AuthorName ?? '匿名作者'}
                            </span>
                            {item.AuthorityLevel && (
                              <span
                                className="text-micro font-sans px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: '#F0EBE0', color: '#4A4641' }}
                              >
                                {item.AuthorityLevel}
                              </span>
                            )}
                            <span className="text-micro font-sans" style={{ color: '#8A847C' }}>
                              · {item.ContentType || 'Answer'}
                            </span>
                          </div>
                        )}

                        {/* Preview text */}
                        {hasPreview ? (
                          <p
                            className="text-body font-serif mb-4 line-clamp-6"
                            style={{ color: '#4A4641', lineHeight: 1.75, letterSpacing: '0.015em' }}
                          >
                            {previewText}
                          </p>
                        ) : (
                          <p className="text-caption font-sans mb-4" style={{ color: '#8A847C' }}>
                            （此条无摘要预览，可点右侧链接到知乎查看完整内容）
                          </p>
                        )}

                        {/* Footer: open on Zhihu */}
                        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #F0EBE0' }}>
                          <span className="text-micro font-sans" style={{ color: '#8A847C', letterSpacing: '0.08em' }}>
                            点"下一步"进入第三幕分析答场,或先到知乎看完整内容
                          </span>
                          {hasUrl && (
                            <a
                              href={item.Url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-caption font-sans font-medium transition-all hover:translate-x-0.5"
                              style={{ color: '#5D2A2C' }}
                            >
                              在知乎打开
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
        </div>

        {/* Paste top answer URLs for Act 3 */}
        {!isLoading && (
          <motion.div
            className="p-5 rounded"
            style={{
              backgroundColor: '#FBF9F3',
              border: '1.5px dashed #E8E3D8',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <p className="text-body font-sans font-medium mb-2" style={{ color: '#4A4641' }}>
              粘贴该问题的高赞回答链接（用于第三幕分析，可选）
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={topAnswerUrls}
                onChange={(e) => setTopAnswerUrls(e.target.value)}
                placeholder="粘贴高赞回答链接，多个用逗号分隔..."
                className="flex-1 px-4 py-2.5 rounded text-body font-serif outline-none"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#1C1A18',
                  border: '1px solid #E8E3D8',
                }}
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUseUrlDirectly}
                disabled={!topAnswerUrls.trim()}
                className="px-5 py-2.5 rounded text-white font-sans font-medium"
                style={{
                  backgroundColor: topAnswerUrls.trim() ? '#4A6B8A' : 'rgba(74, 107, 138, 0.3)',
                  cursor: topAnswerUrls.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                }}
              >
                使用此链接
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
