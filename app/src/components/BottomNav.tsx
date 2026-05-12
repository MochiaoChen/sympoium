/**
 * BottomNav — 底部导航栏
 *
 * 固定底部，border-top，左侧状态/返回，右侧主操作按钮
 */

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useSymposiumStore, ACT_NAMES, ACT_AGENTS } from '@/store/useSymposiumStore';

export default function BottomNav() {
  const currentAct = useSymposiumStore((s) => s.currentAct);
  const setCurrentAct = useSymposiumStore((s) => s.setCurrentAct);
  const selectedTopic = useSymposiumStore((s) => s.selectedTopic);
  const selectedQuestion = useSymposiumStore((s) => s.selectedQuestion);
  const selectedGap = useSymposiumStore((s) => s.selectedGap);
  const draft = useSymposiumStore((s) => s.draft);

  const canGoForward = () => {
    if (currentAct === 1) return !!selectedTopic;
    if (currentAct === 2) return !!selectedQuestion;
    if (currentAct === 3) return !!selectedGap;
    if (currentAct === 4) return draft.trim().length > 20;
    if (currentAct === 5) return true;
    if (currentAct === 6) return true;
    if (currentAct === 7) return false;
    return true;
  };

  const handleBack = () => {
    if (currentAct > 1) setCurrentAct(currentAct - 1);
  };

  const handleForward = () => {
    if (currentAct < 7 && canGoForward()) setCurrentAct(currentAct + 1);
  };

  const forwardLabel =
    currentAct === 6 ? '出酒' : currentAct === 7 ? '完成' : '下一步';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 h-[72px] flex items-center px-6"
      style={{
        backgroundColor: '#F7F4ED',
        borderTop: '1px solid #E8E3D8',
      }}
    >
      {/* Left — Back button */}
      <div className="w-1/4 flex justify-start">
        {currentAct > 1 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded transition-all"
            style={{
              border: '1px solid #4A4641',
              color: '#1C1A18',
              backgroundColor: 'transparent',
              fontFamily: '"Noto Sans SC", sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.05em',
            }}
          >
            <ArrowLeft size={16} />
            返回
          </motion.button>
        )}
      </div>

      {/* Center — Act title + agent subtitle */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2
          className="font-serif text-h3 font-bold"
          style={{ color: '#1C1A18', letterSpacing: '0.02em' }}
        >
          {ACT_NAMES[currentAct]}
        </h2>
        <span className="text-caption font-sans" style={{ color: '#8A847C' }}>
          {ACT_AGENTS[currentAct]}
        </span>
      </div>

      {/* Right — Forward button */}
      <div className="w-1/4 flex justify-end">
        {currentAct < 7 && (
          <motion.button
            whileHover={canGoForward() ? { scale: 1.02, y: -1 } : {}}
            whileTap={canGoForward() ? { scale: 0.98 } : {}}
            onClick={handleForward}
            disabled={!canGoForward()}
            className="flex items-center gap-2 px-6 py-2.5 rounded transition-all"
            style={{
              backgroundColor: canGoForward() ? '#5D2A2C' : 'rgba(93, 42, 44, 0.25)',
              color: 'white',
              cursor: canGoForward() ? 'pointer' : 'not-allowed',
              fontFamily: '"Noto Sans SC", sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.05em',
            }}
          >
            {forwardLabel}
            <ArrowRight size={16} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
