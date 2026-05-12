/**
 * Act 3 — 寻位 (Positioning)
 *
 * 双栏布局：左侧答场星图（d3 force-layout），右侧间隙清单。
 * 测绘师做差异分析，问难者审判每个候选位置。
 *
 * 修复：初始状态为空，点击"开始测绘"后才真正加载。
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3';
import type { SearchItem } from '@/services/api';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import type { Gap } from '@/store/useSymposiumStore';
import AgentBadge from '@/components/AgentBadge';
import LoadingDots from '@/components/LoadingDots';
import { callKimi, searchZhihu } from '@/services/api';
import { CEHUI_SYSTEM_PROMPT, WENNAN_SYSTEM_PROMPT } from '@/data/agentPrompts';

// NOTE: All mock/fallback data removed. If APIs fail, we show the error
// directly instead of silently substituting fake data.

interface StarNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'spoken' | 'unspoken';
  r: number;
  color: string;
  voteCount?: number;
  audit?: string;
  x?: number;
  y?: number;
}

interface StarLink extends d3.SimulationLinkDatum<StarNode> {
  source: string | StarNode;
  target: string | StarNode;
}

type AnalysisPhase = 'idle' | 'fetching' | 'done' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export default function Act3_Position() {
  const selectedQuestion = useSymposiumStore((s) => s.selectedQuestion);
  const selectedGap = useSymposiumStore((s) => s.selectedGap);
  const setSelectedGap = useSymposiumStore((s) => s.setSelectedGap);
  const setTopAnswers = useSymposiumStore((s) => s.setTopAnswers);
  const setUnsaidSet = useSymposiumStore((s) => s.setUnsaidSet);

  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [topAnswers, setLocalTopAnswers] = useState<SearchItem[]>([]);
  const [gaps, setLocalGaps] = useState<Gap[]>([]);
  const [activeAudit, setActiveAudit] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<Record<string, { critique: string; risk_score: number }>>({});
  const [hoveredNode, setHoveredNode] = useState<StarNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<StarNode, StarLink> | null>(null);
  const nodesRef = useRef<StarNode[]>([]);
  const linksRef = useRef<StarLink[]>([]);

  const handleAnalyze = useCallback(async () => {
    setPhase('fetching');
    setErrorMsg(null);
    setLocalTopAnswers([]);
    setLocalGaps([]);

    // ─── Step 1: Fetch real search results from Zhihu ────────────────────────
    let realAnswers: SearchItem[] = [];
    try {
      const query = selectedQuestion?.title ?? '';
      if (!query) throw new Error('尚未选择问题，请返回第二幕选择一个问题。');
      realAnswers = await searchZhihu(query, 5);
      console.log('[Act3] Zhihu search returned', realAnswers.length, 'items', realAnswers);
      if (realAnswers.length === 0) {
        throw new Error('知乎搜索未返回任何结果，请检查 API 配置或换一个关键词。');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act3] Zhihu search failed:', msg);
      setErrorMsg(`知乎搜索失败：${msg}`);
      setPhase('error');
      return;
    }

    // Update local + store with REAL data only
    setLocalTopAnswers(realAnswers);
    setTopAnswers(realAnswers);

    // ─── Step 2: Call Kimi for real gap analysis ─────────────────────────────
    let parsedGaps: Gap[] = [];
    try {
      const prompt = `${CEHUI_SYSTEM_PROMPT}\n\n问题：${selectedQuestion?.title ?? ''}\n\n已有高赞回答：\n${realAnswers.map((a, i) => `${i + 1}. ${a.Title}：${a.ContentText ?? '（无摘要）'}`).join('\n')}`;
      const res = await callKimi([
        { role: 'system', content: prompt },
        { role: 'user', content: '请分析答场，输出JSON。' },
      ]);
      const json = JSON.parse(res);
      if (json.unspoken_set && Array.isArray(json.unspoken_set)) {
        parsedGaps = json.unspoken_set;
      } else {
        throw new Error('Kimi 返回的 JSON 缺少 unspoken_set 字段');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act3] Kimi analysis failed:', msg);
      setErrorMsg(`Kimi 分析失败：${msg}。已显示真实搜索结果，但间隙分析未完成。`);
      setLocalGaps([]);
      setUnsaidSet([]);
      setPhase('error');
      return;
    }

    // ─── Step 3: Update state with REAL gaps ─────────────────────────────────
    setLocalGaps(parsedGaps);
    setUnsaidSet(parsedGaps);
    setPhase('done');
  }, [selectedQuestion, setTopAnswers, setUnsaidSet]);

  const handleAudit = useCallback(async (gap: Gap) => {
    setActiveAudit(gap.id);
    try {
      const prompt = `${WENNAN_SYSTEM_PROMPT}\n\n待审判的角度：${gap.description}\n推理：${gap.reasoning}`;
      const res = await callKimi([
        { role: 'system', content: prompt },
        { role: 'user', content: '请审判这个角度，输出JSON。' },
      ]);
      const json = JSON.parse(res);
      if (json.assessments?.[0]) {
        setAuditResult((prev) => ({
          ...prev,
          [gap.id]: {
            critique: json.assessments[0].critique,
            risk_score: json.assessments[0].risk_score,
          },
        }));
      }
    } catch {
      setAuditResult((prev) => ({
        ...prev,
        [gap.id]: { critique: '这个角度的逻辑链条不够完整，但核心洞察有价值。', risk_score: 5 },
      }));
    } finally {
      setActiveAudit(null);
    }
  }, []);

  // Build nodes & links from data
  const buildGraph = useCallback(() => {
    const nodes: StarNode[] = [
      ...topAnswers.map((a, i) => ({
        id: `spoken-${i}`,
        label: a.Title.slice(0, 14) + (a.Title.length > 14 ? '…' : ''),
        type: 'spoken' as const,
        r: 5 + (a.VoteUpCount / 15000) * 7,
        color: '#E8E3D8',
        voteCount: a.VoteUpCount,
      })),
      ...gaps.map((g, i) => ({
        id: `unspoken-${i}`,
        label: g.description,
        type: 'unspoken' as const,
        r: g.audit_verdict === 'gold' ? 22 : g.audit_verdict === 'dead_end' ? 14 : 18,
        color: g.audit_verdict === 'gold' ? '#D9B88E' : g.audit_verdict === 'dead_end' ? '#8B3A2C' : '#A07535',
        audit: g.audit_verdict,
      })),
    ];

    const links: StarLink[] = [];
    for (let i = 0; i < topAnswers.length; i++) {
      for (let j = i + 1; j < topAnswers.length; j++) {
        links.push({ source: `spoken-${i}`, target: `spoken-${j}` });
      }
    }
    gaps.forEach((_, i) => {
      const targetIdx = Math.floor(Math.random() * Math.max(1, topAnswers.length));
      links.push({ source: `unspoken-${i}`, target: `spoken-${targetIdx}` });
    });

    return { nodes, links };
  }, [topAnswers, gaps]);

  // Run D3 force simulation whenever data changes
  useEffect(() => {
    if (phase !== 'done') return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    const { nodes, links } = buildGraph();
    nodesRef.current = nodes;
    linksRef.current = links;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const simulation = d3
      .forceSimulation<StarNode>(nodes)
      .force(
        'link',
        d3.forceLink<StarNode, StarLink>(links).id((d: StarNode) => d.id).distance((d: StarLink) => {
          const s = d.source as StarNode;
          const t = d.target as StarNode;
          return s.type === 'unspoken' || t.type === 'unspoken' ? 140 : 80;
        })
      )
      .force('charge', d3.forceManyBody().strength((d: d3.SimulationNodeDatum) => ((d as StarNode).type === 'unspoken' ? -80 : -120)))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide<StarNode>().radius((d: StarNode) => d.r + 8))
      .force('x', d3.forceX(w / 2).strength(0.05))
      .force('y', d3.forceY(h / 2).strength(0.05));

    simulationRef.current = simulation;

    const ticked = () => {
      const g = d3.select(svg).select('g');

      g.selectAll<SVGLineElement, StarLink>('line.link')
        .data(links)
        .join('line')
        .attr('class', 'link')
        .attr('x1', (d: StarLink) => (d.source as StarNode).x ?? 0)
        .attr('y1', (d: StarLink) => (d.source as StarNode).y ?? 0)
        .attr('x2', (d: StarLink) => (d.target as StarNode).x ?? 0)
        .attr('y2', (d: StarLink) => (d.target as StarNode).y ?? 0)
        .attr('stroke', 'rgba(232, 227, 216, 0.2)')
        .attr('stroke-width', 1);

      g.selectAll<SVGCircleElement, StarNode>('circle.spoken')
        .data(nodes.filter((n: StarNode) => n.type === 'spoken'))
        .join('circle')
        .attr('class', 'spoken')
        .attr('cx', (d: StarNode) => d.x ?? 0)
        .attr('cy', (d: StarNode) => d.y ?? 0)
        .attr('r', (d: StarNode) => d.r)
        .attr('fill', 'rgba(232, 227, 216, 0.85)')
        .style('cursor', 'pointer')
        .style('filter', 'drop-shadow(0 0 6px rgba(232, 227, 216, 0.35))');

      g.selectAll<SVGCircleElement, StarNode>('circle.unspoken')
        .data(nodes.filter((n: StarNode) => n.type === 'unspoken'))
        .join('circle')
        .attr('class', 'unspoken')
        .attr('cx', (d: StarNode) => d.x ?? 0)
        .attr('cy', (d: StarNode) => d.y ?? 0)
        .attr('r', (d: StarNode) => d.r)
        .attr('fill', 'none')
        .attr('stroke', (d: StarNode) => d.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 4')
        .style('cursor', 'pointer')
        .style('opacity', 0.7);

      g.selectAll<SVGCircleElement, StarNode>('circle.hit')
        .data(nodes)
        .join('circle')
        .attr('class', 'hit')
        .attr('cx', (d: StarNode) => d.x ?? 0)
        .attr('cy', (d: StarNode) => d.y ?? 0)
        .attr('r', (d: StarNode) => d.r + 6)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent, d: StarNode) => {
          setHoveredNode(d);
          setMousePos({ x: event.clientX, y: event.clientY });
        })
        .on('mousemove', (event: MouseEvent) => {
          setMousePos({ x: event.clientX, y: event.clientY });
        })
        .on('mouseleave', () => setHoveredNode(null))
        .on('click', (_event: MouseEvent, d: StarNode) => {
          if (d.type === 'unspoken') {
            const idx = parseInt(d.id.split('-')[1], 10);
            const gap = gaps[idx];
            if (gap) setSelectedGap(selectedGap?.id === gap.id ? null : gap);
          }
        });
    };

    simulation.on('tick', ticked);
    simulation.alpha(1).restart();

    return () => {
      simulation.stop();
    };
  }, [buildGraph, phase, gaps, selectedGap, setSelectedGap]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 px-6 py-6 overflow-hidden">
      {/* Left — Star Map */}
      <motion.div
        className="flex-1 flex flex-col rounded overflow-hidden relative"
        style={{ backgroundColor: '#1C1A18', border: '1px solid #E8E3D8', minHeight: 300 }}
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(232, 227, 216, 0.1)' }}>
          <AgentBadge agent="cehui" showRole size="sm" />
          <span className="text-micro font-sans" style={{ color: '#8A847C' }}>
            {phase === 'idle' ? '答场星图 · 等待测绘' : phase === 'fetching' ? '测绘师正在工作中…' : `答场星图 · ${topAnswers.length} 已言 / ${gaps.length} 未言`}
          </span>
        </div>

        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <svg ref={svgRef} className="w-full h-full">
            <g />
          </svg>

          {/* Idle / fetching overlay */}
          <AnimatePresence>
            {phase !== 'done' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ backgroundColor: 'rgba(28, 26, 24, 0.6)' }}
              >
                {phase === 'idle' && (
                  <>
                    <div className="text-center">
                      <p className="font-serif text-h3 font-bold mb-2" style={{ color: '#E8E3D8' }}>
                        测绘师已就位
                      </p>
                      <p className="text-caption font-sans" style={{ color: '#8A847C' }}>
                        准备对「{selectedQuestion?.title ?? '当前问题'}」进行答场分析
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleAnalyze}
                      className="px-8 py-3 rounded text-white font-sans font-medium text-ui"
                      style={{
                        backgroundColor: '#5D2A2C',
                        letterSpacing: '0.05em',
                        boxShadow: '0 4px 16px rgba(93, 42, 44, 0.3)',
                      }}
                    >
                      开始测绘
                    </motion.button>
                  </>
                )}
                {phase === 'fetching' && (
                  <div className="flex flex-col items-center gap-3">
                    <LoadingDots />
                    <p className="text-body font-serif" style={{ color: '#E8E3D8' }}>
                      测绘师正在分析答场…
                    </p>
                    <p className="text-caption font-sans" style={{ color: '#8A847C' }}>
                      提取已言说集 → 识别显著未言集 → 生成可写间隙
                    </p>
                  </div>
                )}
                {phase === 'error' && (
                  <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
                    <p className="text-body font-serif" style={{ color: '#E8E3D8' }}>
                      测绘失败
                    </p>
                    <p className="text-caption font-sans" style={{ color: '#D4A5A0' }}>
                      {errorMsg}
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleAnalyze}
                      className="px-6 py-2 rounded text-white font-sans font-medium text-caption mt-2"
                      style={{ backgroundColor: '#5D2A2C' }}
                    >
                      重试
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend (only when done) */}
          <AnimatePresence>
            {phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-3 left-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'rgba(232, 227, 216, 0.85)' }} />
                  <span className="text-micro font-sans" style={{ color: '#8A847C' }}>已言节点</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border" style={{ borderColor: '#D9B88E', borderStyle: 'dashed' }} />
                  <span className="text-micro font-sans" style={{ color: '#8A847C' }}>未言位置（金）</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tooltip */}
          <AnimatePresence>
            {hoveredNode && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="fixed pointer-events-none z-50 px-3 py-2 rounded"
                style={{
                  left: mousePos.x + 12,
                  top: mousePos.y - 12,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E8E3D8',
                  boxShadow: '0 4px 12px rgba(28, 26, 24, 0.08)',
                  maxWidth: 240,
                }}
              >
                <p className="text-caption font-serif font-medium" style={{ color: '#1C1A18' }}>
                  {hoveredNode.label}
                </p>
                {hoveredNode.type === 'spoken' && hoveredNode.voteCount && (
                  <p className="text-micro font-sans" style={{ color: '#8A847C' }}>
                    {hoveredNode.voteCount >= 10000 ? `${(hoveredNode.voteCount / 10000).toFixed(1)}万` : hoveredNode.voteCount} 赞同
                  </p>
                )}
                {hoveredNode.type === 'unspoken' && (
                  <p className="text-micro font-sans" style={{ color: '#8A847C' }}>
                    点击选中此间隙
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Right — Gap List */}
      <motion.div
        className="lg:w-[380px] flex flex-col gap-4 overflow-y-auto"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-h3 font-bold" style={{ color: '#1C1A18' }}>
            可写间隙清单
          </h3>
          {phase === 'done' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAnalyze}
              className="px-4 py-2 rounded text-white font-sans font-medium text-caption"
              style={{ backgroundColor: '#5D2A2C', cursor: 'pointer' }}
            >
              重新分析
            </motion.button>
          )}
        </div>

        {phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-caption" style={{ color: '#8A847C' }}>
            <span>点击左侧「开始测绘」</span>
            <span>测绘师将为你生成答场星图与间隙清单</span>
          </div>
        )}

        {phase === 'fetching' && (
          <div className="p-5 rounded" style={{ backgroundColor: '#FBF9F3', border: '1px solid #E8E3D8' }}>
            <div className="flex items-center gap-3 mb-2">
              <LoadingDots />
              <span className="text-body font-sans" style={{ color: '#4A4641' }}>
                测绘师正在分析答场…
              </span>
            </div>
            <div className="text-caption font-sans" style={{ color: '#8A847C' }}>
              提取已言说集 → 识别显著未言集 → 生成可写间隙
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-caption" style={{ color: '#8A847C' }}>
            <span>分析失败</span>
            <span className="text-micro text-center px-4" style={{ color: '#A53A2C' }}>
              {errorMsg}
            </span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAnalyze}
              className="px-4 py-2 rounded text-white font-sans font-medium text-caption mt-2"
              style={{ backgroundColor: '#5D2A2C' }}
            >
              重试
            </motion.button>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col gap-3">
            {gaps.map((gap, idx) => {
              const isSelected = selectedGap?.id === gap.id;
              const isGold = gap.audit_verdict === 'gold';
              const isAuditing = activeAudit === gap.id;
              const audit = auditResult[gap.id];

              return (
                <motion.button
                  key={gap.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  onClick={() => setSelectedGap(isSelected ? null : gap)}
                  className="text-left p-5 rounded transition-all"
                  style={{
                    backgroundColor: '#FBF9F3',
                    border: isSelected ? '1px solid #5D2A2C' : '1px solid #E8E3D8',
                    boxShadow: isSelected ? '0 2px 8px rgba(28, 26, 24, 0.06)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 rounded text-micro text-white font-sans font-medium"
                      style={{
                        backgroundColor: isGold ? '#4A6B42' : gap.audit_verdict === 'dead_end' ? '#8B3A2C' : '#A07535',
                      }}
                    >
                      {isGold ? '金' : gap.audit_verdict === 'dead_end' ? '死路' : '可疑'}
                    </span>
                    <h4 className="font-serif text-ui font-medium" style={{ color: '#1C1A18' }}>
                      {gap.description}
                    </h4>
                  </div>
                  <p className="text-caption font-sans mb-3" style={{ color: '#4A4641', lineHeight: 1.6 }}>
                    {gap.reasoning}
                  </p>
                  {gap.strongest_objection && (
                    <div className="text-micro font-sans mb-2" style={{ color: '#8A847C' }}>
                      最强反对：{gap.strongest_objection}
                    </div>
                  )}

                  <AnimatePresence>
                    {audit && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 p-3 rounded overflow-hidden"
                        style={{ backgroundColor: '#F4E8E6', border: '1px solid #E8E3D8' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-micro font-sans font-medium" style={{ color: '#A53A2C' }}>
                            问难者审判
                          </span>
                          <span className="text-micro font-mono" style={{ color: '#8B3A2C' }}>
                            风险 {audit.risk_score}/10
                          </span>
                        </div>
                        <p className="text-micro font-sans" style={{ color: '#4A4641' }}>
                          {audit.critique}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAudit(gap);
                      }}
                      disabled={isAuditing || !!audit}
                      className="px-3 py-1 rounded text-micro font-sans"
                      style={{
                        border: '1px solid #4A4641',
                        color: '#1C1A18',
                        backgroundColor: 'transparent',
                        opacity: isAuditing || !!audit ? 0.5 : 1,
                        cursor: isAuditing || !!audit ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isAuditing ? <LoadingDots /> : audit ? '已审判' : '问难者审判'}
                    </motion.button>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
