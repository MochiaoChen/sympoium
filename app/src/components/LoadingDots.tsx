/**
 * LoadingDots — 跳动省略号
 *
 * 用打字机或者跳动的省略号替代「AI思考中」的转圈圈动画。
 */

import { motion } from 'framer-motion';

interface LoadingDotsProps {
  color?: string;
}

export default function LoadingDots({
  color = '#8A847C',
}: LoadingDotsProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 4,
            height: 4,
            backgroundColor: color,
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            y: [0, -3, 0],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}
