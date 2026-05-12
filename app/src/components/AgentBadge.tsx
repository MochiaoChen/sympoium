/**
 * AgentBadge — 角色徽标
 *
 * 一个 8×8 的色点（该角色签名色填充）
 * 紧跟角色名（思源宋体 Medium，14px，墨色一级）
 * 整体高度 20px
 * 色点与名字之间 6px 间距
 * 名字下方可选 caption（黑体 Regular，12px，墨色三级）
 *
 * **不要做圆形头像。** 不要用 emoji。色点就够了。
 */

import { AGENT_CONFIG, type AgentKey } from '@/data/agentPrompts';

interface AgentBadgeProps {
  agent: AgentKey;
  showRole?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export default function AgentBadge({
  agent,
  showRole = true,
  size = 'md',
  className = '',
}: AgentBadgeProps) {
  const config = AGENT_CONFIG[agent];
  if (!config) return null;

  const dotSize = size === 'sm' ? 6 : 8;
  const nameSize = size === 'sm' ? 'text-caption' : 'text-ui';
  const roleSize = size === 'sm' ? 'text-micro' : 'text-caption';

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block rounded-full shrink-0"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: config.color,
          }}
        />
        <span
          className={`font-serif font-medium ${nameSize}`}
          style={{ color: '#1C1A18', letterSpacing: '0.05em' }}
        >
          {config.name}
        </span>
      </div>
      {showRole && (
        <span
          className={`font-sans ${roleSize} ml-3.5`}
          style={{ color: '#8A847C', letterSpacing: '0.1em' }}
        >
          {config.role}
        </span>
      )}
    </div>
  );
}
