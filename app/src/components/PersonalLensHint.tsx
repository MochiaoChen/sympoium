/**
 * PersonalLensHint — 一条「以 @你 为视角」的提示条
 *
 * 仅在登录且 user.headline / description 存在时显示。
 * 用于 Act 2/3/4 顶部，强化「我已经知道你是谁」的体感。
 */

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useSymposiumStore } from '@/store/useSymposiumStore';

interface PersonalLensHintProps {
  hint?: string; // 可选的场景化提示，例如「这些问题里你最可能写出差异化的」
}

export default function PersonalLensHint({ hint }: PersonalLensHintProps) {
  const zhihuUser = useSymposiumStore((s) => s.zhihuUser);
  if (!zhihuUser) return null;
  const tag = zhihuUser.headline?.trim() || zhihuUser.description?.trim();
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-caption font-sans"
      style={{
        backgroundColor: 'rgba(93,42,44,0.06)',
        border: '1px solid rgba(93,42,44,0.18)',
        color: '#5D2A2C',
        letterSpacing: '0.04em',
        maxWidth: '100%',
      }}
    >
      <Sparkles size={12} />
      <span className="font-medium">以 @{zhihuUser.fullname} 为视角</span>
      {tag ? (
        <>
          <span style={{ color: '#8A847C' }}>·</span>
          <span style={{ color: '#4A4641' }} className="truncate">
            {tag}
          </span>
        </>
      ) : null}
      {hint ? (
        <>
          <span style={{ color: '#8A847C' }}>·</span>
          <span style={{ color: '#4A4641' }} className="truncate">
            {hint}
          </span>
        </>
      ) : null}
    </motion.div>
  );
}
