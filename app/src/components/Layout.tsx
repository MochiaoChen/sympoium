/**
 * Layout — Wraps the entire app
 *
 * Includes Navbar + BottomNav.
 * Main content area between them (pt-28 pb-[72px]).
 * Background: paper.
 * Handles act transitions with Framer Motion.
 */

import { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useSymposiumStore } from '@/store/useSymposiumStore';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const currentAct = useSymposiumStore((s) => s.currentAct);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const setCurrentAct = useSymposiumStore.getState().setCurrentAct;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (currentAct < 7) setCurrentAct(currentAct + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentAct > 1) setCurrentAct(currentAct - 1);
      } else if (e.key >= '1' && e.key <= '7') {
        const act = parseInt(e.key, 10);
        if (act <= currentAct + 1) setCurrentAct(act);
      }
    },
    [currentAct]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ backgroundColor: '#F7F4ED' }}
    >
      <Navbar />

      <main className="flex-1 pt-28 pb-[72px] relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAct}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{
              duration: 0.3,
              ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number],
            }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
