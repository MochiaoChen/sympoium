/**
 * Navbar — 顶栏 + 横向时间轴
 *
 * 顶栏 64px：左侧 logo，右侧用户信息
 * 时间轴 48px：7 个小圆点，已完成的幕用绛红实心圆，当前幕用绛红空心圆带 2px 边框，未到达的幕用墨色三级实心圆
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSymposiumStore, ACT_NAMES } from '@/store/useSymposiumStore';

export default function Navbar() {
  const currentAct = useSymposiumStore((s) => s.currentAct);
  const setCurrentAct = useSymposiumStore((s) => s.setCurrentAct);

  const handleClick = useCallback(
    (act: number) => {
      if (act <= currentAct + 1 && act <= 7) {
        setCurrentAct(act);
      }
    },
    [currentAct, setCurrentAct]
  );

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: '#F7F4ED',
        borderBottom: '1px solid #E8E3D8',
      }}
    >
      <div className="max-w-canvas mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-serif font-bold text-[22px]"
            style={{ letterSpacing: '0.08em', color: '#1C1A18' }}
          >
            会饮
          </span>
          <span
            className="font-serif italic text-caption"
            style={{ color: '#8A847C', letterSpacing: '0.04em' }}
          >
            Symposium
          </span>
        </div>

        {/* User area */}
        <div className="flex items-center gap-3 text-caption font-sans" style={{ color: '#8A847C' }}>
          <span>Mochiao</span>
          <div
            className="w-7 h-7 rounded-full grid place-items-center text-micro font-serif font-medium"
            style={{
              backgroundColor: '#FBF9F3',
              border: '1px solid #E8E3D8',
              color: '#4A4641',
            }}
          >
            M
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div
        className="h-12 flex items-center justify-center"
        style={{ borderTop: '1px solid #E8E3D8' }}
      >
        <div className="flex items-center gap-0 max-w-2xl w-full justify-center px-4">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((act, idx) => {
            const isCompleted = act < currentAct;
            const isCurrent = act === currentAct;
            const isUnlocked = act <= currentAct + 1;

            return (
              <div key={act} className="flex items-center flex-1">
                {idx > 0 && (
                  <div
                    className="flex-1 h-px mx-2"
                    style={{
                      backgroundColor: act <= currentAct ? '#5D2A2C' : '#E8E3D8',
                      opacity: act <= currentAct ? 0.4 : 1,
                    }}
                  />
                )}

                <button
                  onClick={() => handleClick(act)}
                  disabled={!isUnlocked}
                  className="flex flex-col items-center gap-1 relative"
                  style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed' }}
                >
                  <motion.div
                    whileHover={isUnlocked ? { scale: 1.15 } : {}}
                    className="relative flex items-center justify-center"
                  >
                    {isCurrent ? (
                      <div
                        className="rounded-full"
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: '#F7F4ED',
                          border: '2px solid #5D2A2C',
                          boxShadow: '0 0 0 4px rgba(93, 42, 44, 0.08)',
                        }}
                      />
                    ) : (
                      <div
                        className="rounded-full"
                        style={{
                          width: 8,
                          height: 8,
                          backgroundColor: isCompleted ? '#5D2A2C' : '#B8B1A5',
                        }}
                      />
                    )}
                  </motion.div>

                  <span
                    className="text-micro whitespace-nowrap font-sans"
                    style={{
                      color: isCurrent ? '#5D2A2C' : isCompleted ? '#4A4641' : '#B8B1A5',
                      fontWeight: isCurrent ? 500 : 400,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {ACT_NAMES[act]}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
