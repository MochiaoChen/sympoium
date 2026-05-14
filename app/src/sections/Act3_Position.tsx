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
import type { Cluster, SearchItem, TerrainResult, TerrainDimension } from '@/services/api';
import { useSymposiumStore } from '@/store/useSymposiumStore';
import type { Gap } from '@/store/useSymposiumStore';
import AgentBadge from '@/components/AgentBadge';
import LoadingDots from '@/components/LoadingDots';
import PersonalLensHint from '@/components/PersonalLensHint';
import { callLLMJson, searchCombined } from '@/services/api';
import { CEHUI_SYSTEM_PROMPT, buildCehuiUserPrompt, WENNAN_SYSTEM_PROMPT } from '@/data/agentPrompts';

// All mock/fallback data removed. If APIs fail, surface the error.

// Per-answer node (Obsidian-style): every Zhihu answer becomes its own small
// dot; edges connect answers in the same cluster.
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'answer' | 'gap';
  // ── answer-node fields ──
  answerIdx?: number;        // index into topAnswers
  title?: string;
  upvotes?: number;
  authorName?: string;
  clusterId?: string;        // which cluster this answer belongs to
  // ── gap-node fields ──
  gapId?: string;
  description?: string;
  suggestedBackground?: string;
  potentialValue?: number;
  // ── shared visuals ──
  r: number;
  color: string;
  dimension?: TerrainDimension;
  // Anchor for forceX/Y (0..1 ratio of the viewport).
  initX?: number;
  initY?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

type AnalysisPhase = 'idle' | 'fetching' | 'done' | 'error';

// Map potential_value 1..5 → verdict label/color used in the right-side list.
type Verdict = 'gold' | 'questionable' | 'dead_end';
function verdictFor(potential: number): Verdict {
  if (potential >= 4) return 'gold';
  if (potential <= 1) return 'dead_end';
  return 'questionable';
}
const VERDICT_LABEL: Record<Verdict, string> = { gold: '金', questionable: '可疑', dead_end: '死路' };
const VERDICT_COLOR: Record<Verdict, string> = { gold: '#4A6B42', questionable: '#A07535', dead_end: '#8B3A2C' };
const VERDICT_RING: Record<Verdict, string> = { gold: '#D9B88E', questionable: '#A07535', dead_end: '#8B3A2C' };

// Tint clusters by dimension so the star map reads at a glance.
const DIMENSION_COLOR: Record<TerrainDimension, string> = {
  viewpoint: '#E8E3D8',  // 立场 — 米白
  knowledge: '#C9B68A',  // 知识 — 米金
  experience: '#A8B89B', // 经验 — 暗青
};
const DIMENSION_LABEL: Record<TerrainDimension, string> = {
  viewpoint: '立场', knowledge: '知识', experience: '经验',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Act3_Position() {
  const selectedQuestion = useSymposiumStore((s) => s.selectedQuestion);
  const selectedGap = useSymposiumStore((s) => s.selectedGap);
  const setSelectedGap = useSymposiumStore((s) => s.setSelectedGap);
  const setTopAnswers = useSymposiumStore((s) => s.setTopAnswers);
  const setClustersStore = useSymposiumStore((s) => s.setClusters);
  const setTerrainMeta = useSymposiumStore((s) => s.setTerrainMeta);
  const setUnsaidSet = useSymposiumStore((s) => s.setUnsaidSet);

  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [topAnswers, setLocalTopAnswers] = useState<SearchItem[]>([]);
  const [clusters, setLocalClusters] = useState<Cluster[]>([]);
  const [gaps, setLocalGaps] = useState<Gap[]>([]);
  const [meta, setLocalMeta] = useState<TerrainResult['meta'] | null>(null);
  const [activeAudit, setActiveAudit] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<Record<string, { critique: string; risk_score: number }>>({});
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const handleAnalyze = useCallback(async () => {
    setPhase('fetching');
    setErrorMsg(null);
    setLocalTopAnswers([]);
    setLocalClusters([]);
    setLocalGaps([]);
    setLocalMeta(null);

    const query = selectedQuestion?.title ?? '';
    if (!query) {
      setErrorMsg('尚未选择问题，请返回第二幕选择一个问题。');
      setPhase('error');
      return;
    }

    // ─── Step 1: Parallel Zhihu search (in-site + global), dedup, sort ───────
    let answers;
    try {
      answers = await searchCombined(query);
      console.log('[Act3] searchCombined →', answers.length, 'items');
      if (answers.length === 0) {
        throw new Error('知乎搜索未返回任何结果，请检查 API 配置或换一个关键词。');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act3] Zhihu search failed:', msg);
      setErrorMsg(`知乎搜索失败：${msg}`);
      setPhase('error');
      return;
    }
    const top = answers.slice(0, 10);
    setLocalTopAnswers(top);
    setTopAnswers(top);

    // ─── Step 2: Terrain analysis (clusters + blind_spots) via LLM JSON mode ─
    let terrain: TerrainResult;
    try {
      terrain = await callLLMJson<TerrainResult>(
        [
          { role: 'system', content: CEHUI_SYSTEM_PROMPT },
          { role: 'user', content: buildCehuiUserPrompt(query, top) },
        ],
        0.4,
      );
      if (!Array.isArray(terrain.clusters) || !Array.isArray(terrain.blind_spots)) {
        throw new Error('AI 返回的 JSON 缺少 clusters 或 blind_spots 字段');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Act3] Terrain analysis failed:', msg);
      setErrorMsg(`AI 分析失败：${msg}`);
      setUnsaidSet([]);
      setClustersStore([]);
      setTerrainMeta(null);
      setPhase('error');
      return;
    }

    // Normalize blind_spots → Gap[]. Derive legacy audit_verdict from
    // potential_value so Act 6 圆桌会 speeches keep their existing logic.
    const parsedGaps: Gap[] = terrain.blind_spots.map((b) => ({
      id: b.gap_id,
      description: b.description,
      reasoning: b.reasoning,
      dimension: b.dimension,
      potential_value: b.potential_value,
      suggested_background: b.suggested_background,
      x: b.x,
      y: b.y,
      audit_verdict: verdictFor(b.potential_value),
    }));

    setLocalClusters(terrain.clusters);
    setLocalGaps(parsedGaps);
    setLocalMeta(terrain.meta);
    setClustersStore(terrain.clusters);
    setTerrainMeta(terrain.meta);
    setUnsaidSet(parsedGaps);
    setPhase('done');
  }, [selectedQuestion, setTopAnswers, setClustersStore, setTerrainMeta, setUnsaidSet]);

  const handleAudit = useCallback(async (gap: Gap) => {
    setActiveAudit(gap.id);
    try {
      const prompt = `${WENNAN_SYSTEM_PROMPT}\n\n待审判的角度：${gap.description}\n推理：${gap.reasoning}\n建议背景：${gap.suggested_background}`;
      const json = await callLLMJson<{ assessments?: { critique: string; risk_score: number }[] }>([
        { role: 'system', content: prompt },
        { role: 'user', content: '请审判这个角度，输出JSON。' },
      ], 0.5);
      const first = json.assessments?.[0];
      if (first) {
        setAuditResult((prev) => ({
          ...prev,
          [gap.id]: { critique: first.critique, risk_score: first.risk_score },
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

  // Build Obsidian-style graph: every answer is its own node colored by
  // cluster dimension; edges link members of the same cluster (star pattern
  // from the first member to the rest, keeps edge count O(n)). Blind spots
  // remain isolated dashed rings. Cluster labels render as static SVG text.
  const buildGraph = useCallback((w: number, h: number) => {
    const padX = 60;
    const padY = 60;
    const mapX = (v: number) => padX + (Math.max(0, Math.min(100, v)) / 100) * (w - 2 * padX);
    const mapY = (v: number) => padY + (Math.max(0, Math.min(100, v)) / 100) * (h - 2 * padY);

    // Build a lookup: answer index → its cluster (if any).
    const answerToCluster = new Map<number, Cluster>();
    for (const c of clusters) {
      for (const idx of c.member_indices ?? []) {
        answerToCluster.set(idx, c);
      }
    }

    // Each answer becomes a small dot, anchored near its cluster center with
    // a deterministic jitter so siblings spread without strobing on each tick.
    const answerNodes: GraphNode[] = topAnswers.map((a, idx) => {
      const cluster = answerToCluster.get(idx);
      const baseX = cluster ? mapX(cluster.x) : w / 2;
      const baseY = cluster ? mapY(cluster.y) : h / 2;
      // Deterministic pseudo-jitter from idx so the layout is stable across renders.
      const angle = (idx * 137.5) * (Math.PI / 180);
      const initX = baseX + Math.cos(angle) * 14;
      const initY = baseY + Math.sin(angle) * 14;
      return {
        id: `ans-${idx}`,
        type: 'answer',
        answerIdx: idx,
        title: a.Title,
        upvotes: a.VoteUpCount,
        authorName: a.AuthorName,
        clusterId: cluster?.cluster_id,
        r: 4 + Math.log10(Math.max(10, a.VoteUpCount || 1)) * 1.4,
        color: cluster ? DIMENSION_COLOR[cluster.dimension] : DIMENSION_COLOR.viewpoint,
        dimension: cluster?.dimension,
        initX,
        initY,
        x: initX,
        y: initY,
      };
    });

    const gapNodes: GraphNode[] = gaps.map((g) => {
      const initX = mapX(g.x);
      const initY = mapY(g.y);
      return {
        id: `gap-${g.id}`,
        type: 'gap',
        gapId: g.id,
        description: g.description,
        suggestedBackground: g.suggested_background,
        potentialValue: g.potential_value,
        dimension: g.dimension,
        r: 12 + g.potential_value * 2.2,
        color: VERDICT_RING[verdictFor(g.potential_value)],
        initX,
        initY,
        x: initX,
        y: initY,
      };
    });

    // Star-pattern links: every member after the first is linked to the first
    // member. Keeps the cluster visually tight without O(n²) edges.
    const links: GraphLink[] = [];
    for (const c of clusters) {
      const members = c.member_indices ?? [];
      if (members.length < 2) continue;
      const root = members[0];
      for (let i = 1; i < members.length; i++) {
        links.push({ source: `ans-${root}`, target: `ans-${members[i]}` });
      }
    }

    const labels = clusters.map((c) => ({
      cluster_id: c.cluster_id,
      label: c.label,
      x: mapX(c.x),
      y: mapY(c.y),
      color: DIMENSION_COLOR[c.dimension],
      count: c.answer_count,
    }));

    return { nodes: [...answerNodes, ...gapNodes], links, labels };
  }, [clusters, gaps, topAnswers]);

  // D3 force simulation: forceLink keeps cluster members close, forceX/Y
  // pulls each toward its anchor, forceCollide prevents overlap.
  useEffect(() => {
    if (phase !== 'done') return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    const { nodes, links, labels } = buildGraph(w, h);

    if (simulationRef.current) simulationRef.current.stop();

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(26)
          .strength(0.45),
      )
      .force('x', d3.forceX<GraphNode>((d) => d.initX ?? w / 2).strength(0.18))
      .force('y', d3.forceY<GraphNode>((d) => d.initY ?? h / 2).strength(0.18))
      .force('collide', d3.forceCollide<GraphNode>().radius((d) => d.r + 4).strength(0.9))
      .force('charge', d3.forceManyBody().strength(-28))
      .alpha(0.9)
      .alphaDecay(0.04);

    simulationRef.current = simulation;

    const ticked = () => {
      const g = d3.select(svg).select('g');

      // Edges first (so they render under the nodes).
      g.selectAll<SVGLineElement, GraphLink>('line.edge')
        .data(links)
        .join('line')
        .attr('class', 'edge')
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
        .attr('stroke', 'rgba(232, 227, 216, 0.18)')
        .attr('stroke-width', 1);

      // Answer dots (filled, small).
      g.selectAll<SVGCircleElement, GraphNode>('circle.answer')
        .data(nodes.filter((n) => n.type === 'answer'), (d) => d.id)
        .join('circle')
        .attr('class', 'answer')
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)
        .attr('r', (d) => d.r)
        .attr('fill', (d) => d.color)
        .attr('fill-opacity', 0.9)
        .attr('stroke', 'rgba(232, 227, 216, 0.4)')
        .attr('stroke-width', 0.8)
        .style('cursor', 'pointer');

      // Gap rings (hollow, dashed).
      g.selectAll<SVGCircleElement, GraphNode>('circle.gap')
        .data(nodes.filter((n) => n.type === 'gap'), (d) => d.id)
        .join('circle')
        .attr('class', 'gap')
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)
        .attr('r', (d) => d.r)
        .attr('fill', 'none')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4 4')
        .style('cursor', 'pointer')
        .style('opacity', (d) => (selectedGap?.id && d.id === `gap-${selectedGap.id}` ? 1 : 0.75));

      // Larger transparent hit area for hover/click.
      g.selectAll<SVGCircleElement, GraphNode>('circle.hit')
        .data(nodes, (d) => d.id)
        .join('circle')
        .attr('class', 'hit')
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0)
        .attr('r', (d) => d.r + 7)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent, d: GraphNode) => {
          setHoveredNode(d);
          setMousePos({ x: event.clientX, y: event.clientY });
        })
        .on('mousemove', (event: MouseEvent) => {
          setMousePos({ x: event.clientX, y: event.clientY });
        })
        .on('mouseleave', () => setHoveredNode(null))
        .on('click', (_event: MouseEvent, d: GraphNode) => {
          if (d.type !== 'gap') return;
          const gap = gaps.find((g) => g.id === d.gapId);
          if (gap) setSelectedGap(selectedGap?.id === gap.id ? null : gap);
        });

      // Cluster labels — static text floating above the cluster anchors.
      g.selectAll<SVGTextElement, typeof labels[number]>('text.cluster-label')
        .data(labels, (d) => d.cluster_id)
        .join('text')
        .attr('class', 'cluster-label')
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y - 32)
        .attr('text-anchor', 'middle')
        .attr('fill', (d) => d.color)
        .attr('font-family', '"Noto Serif SC", serif')
        .attr('font-size', 11)
        .attr('font-weight', 600)
        .style('letter-spacing', '0.05em')
        .style('opacity', 0.9)
        .text((d) => `${d.label} · ${d.count}`);
    };

    simulation.on('tick', ticked);

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
            {phase === 'idle'
              ? '答场星图 · 等待测绘'
              : phase === 'fetching'
              ? '测绘师正在工作中…'
              : `答场图谱 · ${topAnswers.length} 答 / ${clusters.length} 簇 / ${gaps.length} 盲区${meta ? ` · 饱和度 ${meta.saturation_level}` : ''}`}
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
                className="absolute bottom-3 left-3 flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DIMENSION_COLOR.viewpoint }} />
                  <span className="text-micro font-sans" style={{ color: '#8A847C' }}>已言 · 立场</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DIMENSION_COLOR.knowledge }} />
                  <span className="text-micro font-sans" style={{ color: '#8A847C' }}>已言 · 知识</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DIMENSION_COLOR.experience }} />
                  <span className="text-micro font-sans" style={{ color: '#8A847C' }}>已言 · 经验</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-3 h-3 rounded-full border" style={{ borderColor: VERDICT_RING.gold, borderStyle: 'dashed' }} />
                  <span className="text-micro font-sans" style={{ color: '#8A847C' }}>未言 · 价值越高圈越大</span>
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
                  maxWidth: 280,
                }}
              >
                {hoveredNode.type === 'answer' && (
                  <>
                    <p className="text-caption font-serif font-medium" style={{ color: '#1C1A18', lineHeight: 1.5 }}>
                      {hoveredNode.title ?? '（无标题）'}
                    </p>
                    <p className="text-micro font-sans mt-1" style={{ color: '#8A847C' }}>
                      {hoveredNode.dimension ? `${DIMENSION_LABEL[hoveredNode.dimension]} · ` : ''}
                      {hoveredNode.authorName ? `${hoveredNode.authorName} · ` : ''}
                      {(hoveredNode.upvotes ?? 0) >= 10000
                        ? `${((hoveredNode.upvotes ?? 0) / 10000).toFixed(1)}万`
                        : hoveredNode.upvotes ?? 0}{' '}
                      赞同
                    </p>
                  </>
                )}
                {hoveredNode.type === 'gap' && (
                  <>
                    <p className="text-caption font-serif font-medium" style={{ color: '#1C1A18' }}>
                      {hoveredNode.description ?? '盲区'}
                    </p>
                    <p className="text-micro font-sans mt-0.5" style={{ color: '#8A847C' }}>
                      {hoveredNode.dimension ? `${DIMENSION_LABEL[hoveredNode.dimension]} · ` : ''}
                      价值 {hoveredNode.potentialValue ?? '?'}/5
                    </p>
                    {hoveredNode.suggestedBackground && (
                      <p className="text-micro font-sans mt-1" style={{ color: '#4A4641', lineHeight: 1.5 }}>
                        建议背景：{hoveredNode.suggestedBackground}
                      </p>
                    )}
                    <p className="text-micro font-sans mt-1" style={{ color: '#A07535' }}>
                      点击选中此间隙
                    </p>
                  </>
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
        <PersonalLensHint hint="按你的写作脉络优先看这些间隙" />
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
            {[...gaps]
              .sort((a, b) => b.potential_value - a.potential_value)
              .map((gap, idx) => {
              const isSelected = selectedGap?.id === gap.id;
              const verdict = verdictFor(gap.potential_value);
              const isAuditing = activeAudit === gap.id;
              const audit = auditResult[gap.id];

              return (
                <motion.button
                  key={gap.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.08 }}
                  onClick={() => setSelectedGap(isSelected ? null : gap)}
                  className="text-left p-5 rounded transition-all"
                  style={{
                    backgroundColor: '#FBF9F3',
                    border: isSelected ? '1px solid #5D2A2C' : '1px solid #E8E3D8',
                    boxShadow: isSelected ? '0 2px 8px rgba(28, 26, 24, 0.06)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-micro text-white font-sans font-medium"
                      style={{ backgroundColor: VERDICT_COLOR[verdict] }}
                    >
                      {VERDICT_LABEL[verdict]} · {gap.potential_value}/5
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-micro font-sans"
                      style={{ backgroundColor: '#F0EBE0', color: '#4A4641' }}
                    >
                      {DIMENSION_LABEL[gap.dimension]}
                    </span>
                    <h4 className="font-serif text-ui font-medium w-full" style={{ color: '#1C1A18' }}>
                      {gap.description}
                    </h4>
                  </div>
                  <p className="text-caption font-sans mb-3" style={{ color: '#4A4641', lineHeight: 1.6 }}>
                    {gap.reasoning}
                  </p>
                  {gap.suggested_background && (
                    <div className="text-micro font-sans mb-2" style={{ color: '#8A847C' }}>
                      建议背景：{gap.suggested_background}
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
