/**
 * Act 1 — 起意 (Inspiration)
 *
 * 信息流布局。望气者把当下世界用四个面向呈现给用户。
 * 用户选择一个目标问题（或主题）。
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { fetchHotList } from '@/services/api';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import AgentBadge from '@/components/AgentBadge';
import LoadingDots from '@/components/LoadingDots';

export default function Act1_Inspiration() {
  const hotList = useSymposiumStore((s) => s.hotList);
  const selectedTopic = useSymposiumStore((s) => s.selectedTopic);
  const setHotList = useSymposiumStore((s) => s.setHotList);
  const setSelectedTopic = useSymposiumStore((s) => s.setSelectedTopic);
  const setIsLoading = useSymposiumStore((s) => s.setIsLoading);

  const [customInput, setCustomInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (hotList.length === 0) {
      setIsFetching(true);
      setIsLoading(true, '望气者正在观测今日热榜...');
      fetchHotList(10)
        .then((list) => setHotList(list))
        .catch((err) => console.error('Failed to fetch hot list:', err))
        .finally(() => {
          setIsFetching(false);
          setIsLoading(false);
        });
    }
  }, [hotList.length, setHotList, setIsLoading]);

  const handleSelectTopic = useCallback(
    (topic: string) => {
      setSelectedTopic(topic === selectedTopic ? '' : topic);
    },
    [selectedTopic, setSelectedTopic]
  );

  const handleCustomSubmit = useCallback(() => {
    if (customInput.trim()) setSelectedTopic(customInput.trim());
  }, [customInput, setSelectedTopic]);

  return (
    <div className="h-full flex flex-col items-center px-4 py-8 overflow-y-auto">
      <div className="max-w-prose-wide w-full flex flex-col items-center gap-8">
        {/* 望气者 Introduction */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <AgentBadge agent="wangqi" showRole size="md" />
          <motion.div
            className="w-full max-w-prose-default"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div
              className="rounded"
              style={{
                backgroundColor: '#FBF9F3',
                border: '1px solid #E8E3D8',
                boxShadow: '0 1px 3px rgba(28, 26, 24, 0.04)',
              }}
            >
              <div className="flex">
                <div
                  className="shrink-0"
                  style={{
                    width: 4,
                    backgroundColor: '#4A6B8A',
                    borderRadius: '4px 0 0 4px',
                  }}
                />
                <div className="flex-1 p-6">
                  <div
                    className="font-serif font-medium text-ui mb-2"
                    style={{ color: '#4A6B8A', letterSpacing: '0.05em' }}
                  >
                    望气者
                  </div>
                  <div className="font-serif text-body" style={{ color: '#1C1A18', lineHeight: 1.7 }}>
                    {isFetching ? (
                      <div className="flex items-center gap-3">
                        <LoadingDots />
                        <span style={{ color: '#8A847C' }}>正在观测今日热榜...</span>
                      </div>
                    ) : (
                      <>
                        <p>欢迎来到会饮。</p>
                        <p className="mt-2">
                          在下望气者，观测今日知乎热榜与阁下兴趣的交汇。以下是当前最值得关注的气流，选一个感兴趣的方向，我们开始这场写作之旅。
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Hot List Cards */}
        {!isFetching && hotList.length > 0 && (
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} color="#5D2A2C" />
              <h3 className="font-serif text-h2 font-bold" style={{ color: '#1C1A18' }}>
                今日热榜 · 值得关注
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotList.slice(0, 9).map((item, idx) => {
                const isSelected = selectedTopic === item.Title;
                const crossScore = Math.max(60, 95 - idx * 4);

                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.8 + idx * 0.08,
                      ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number],
                    }}
                    whileHover={{ y: -2 }}
                    onClick={() => handleSelectTopic(item.Title)}
                    className="relative text-left p-6 rounded transition-all"
                    style={{
                      backgroundColor: '#FBF9F3',
                      border: isSelected ? '1px solid #5D2A2C' : '1px solid #E8E3D8',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(28, 26, 24, 0.06)'
                        : '0 1px 3px rgba(28, 26, 24, 0.04)',
                    }}
                  >
                    <span
                      className="absolute top-3 right-3 px-2 py-0.5 rounded text-micro text-white font-sans"
                      style={{ backgroundColor: '#5D2A2C', letterSpacing: '0.1em' }}
                    >
                      热榜
                    </span>

                    <h4
                      className="font-serif text-h3 font-medium mt-2 mb-3 pr-12"
                      style={{ color: '#1C1A18' }}
                    >
                      {item.Title}
                    </h4>

                    {item.Summary && (
                      <p className="text-body mb-4 line-clamp-2" style={{ color: '#4A4641' }}>
                        {item.Summary}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-ui" style={{ color: '#5D2A2C' }}>
                        {crossScore}
                      </span>
                      <span className="text-caption" style={{ color: '#8A847C' }}>%</span>
                    </div>

                    <div
                      className="mt-3 h-1 rounded-full overflow-hidden"
                      style={{ backgroundColor: '#E8E3D8' }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: '#5D2A2C' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${crossScore}%` }}
                        transition={{ duration: 0.8, delay: 1 + idx * 0.15 }}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Custom Input Section */}
        <motion.div
          className="w-full max-w-prose-default"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <div
            className="p-6 rounded"
            style={{
              backgroundColor: '#FBF9F3',
              border: '1px solid #E8E3D8',
              boxShadow: '0 1px 3px rgba(28, 26, 24, 0.04)',
            }}
          >
            <p className="text-body mb-3 font-sans font-medium" style={{ color: '#4A4641' }}>
              或者，输入你自己的话题或知乎问题链接：
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="今天想写点什么"
                className="flex-1 px-4 py-3 rounded text-body font-serif outline-none transition-all"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#1C1A18',
                  border: '1px solid #E8E3D8',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#5D2A2C';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E3D8';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomSubmit();
                }}
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCustomSubmit}
                disabled={!customInput.trim()}
                className="px-6 py-3 rounded text-white font-sans font-medium transition-all flex items-center gap-2"
                style={{
                  backgroundColor: customInput.trim() ? '#5D2A2C' : 'rgba(93, 42, 44, 0.25)',
                  cursor: customInput.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  letterSpacing: '0.05em',
                }}
              >
                进入会饮
                <ExternalLink size={16} />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Selected indicator */}
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-3 rounded"
            style={{
              backgroundColor: 'rgba(93, 42, 44, 0.06)',
              border: '1px solid #5D2A2C',
            }}
          >
            <p className="text-body font-sans" style={{ color: '#4A4641' }}>
              已选定：
              <span className="font-semibold" style={{ color: '#5D2A2C' }}>
                {selectedTopic}
              </span>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
