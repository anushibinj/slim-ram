import { useStoreApi } from "@xyflow/react";
import { useEffect, useRef } from "react";
import type { TrafficClass } from "../../sim";
import { useGameStore } from "../../store/gameStore";

const CLASS_COLORS: Record<TrafficClass, string> = {
  static: "#14b8a6", // teal
  read: "#3b82f6", // blue
  write: "#ec4899", // pink
};

const RPS_PER_DOT = 15;
const MAX_DOTS_PER_EDGE = 14;
const DOT_SPEED_PX_PER_S = 90;
const DOT_RADIUS = 3;

interface Particle {
  phase: number; // 0..1 progress along the edge
  trafficClass: TrafficClass;
}

/**
 * Animates request dots travelling along edges, density proportional to
 * that edge's rps and colour-coded by traffic class. Runs its own
 * requestAnimationFrame loop reading node positions, the viewport
 * transform, and simState directly from the stores via getState() —
 * never through React state or props — so it can hit 60fps independent
 * of the 10Hz sim tick and any React re-renders elsewhere in the tree.
 */
export function ParticleLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flowStoreApi = useStoreApi();
  const particlesByEdge = useRef(new Map<string, Particle[]>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    let lastTs: number | null = null;

    function resize() {
      const canvasEl = canvasRef.current;
      const parent = canvasEl?.parentElement;
      if (!canvasEl || !parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvasEl.width = parent.clientWidth * dpr;
      canvasEl.height = parent.clientHeight * dpr;
      canvasEl.style.width = `${parent.clientWidth}px`;
      canvasEl.style.height = `${parent.clientHeight}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    function frame(ts: number) {
      const dtSeconds = lastTs === null ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;

      const canvasEl = canvasRef.current;
      if (!canvasEl || !ctx) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      const [tx, ty, zoom] = flowStoreApi.getState().transform;
      const { graph, positions, simState } = useGameStore.getState();
      const width = canvasEl.clientWidth;
      const height = canvasEl.clientHeight;

      ctx.clearRect(0, 0, width, height);

      for (const edge of graph.edges) {
        const from = positions[edge.source];
        const to = positions[edge.target];
        if (!from || !to) continue;

        // Node cards are ~150x60; approximate anchor points at their
        // right/left edge midpoints in flow space before projecting.
        const x1 = (from.x + 150) * zoom + tx;
        const y1 = (from.y + 30) * zoom + ty;
        const x2 = to.x * zoom + tx;
        const y2 = (to.y + 30) * zoom + ty;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;

        const edgeMetrics = simState.edges[edge.id];
        const rps = edgeMetrics?.rps ?? 0;
        const targetCount = Math.max(0, Math.min(MAX_DOTS_PER_EDGE, Math.round(rps / RPS_PER_DOT)));

        let particles = particlesByEdge.current.get(edge.id);
        if (!particles) {
          particles = [];
          particlesByEdge.current.set(edge.id, particles);
        }

        while (particles.length < targetCount) {
          particles.push({ phase: Math.random(), trafficClass: pickClass(edgeMetrics) });
        }
        if (particles.length > targetCount) particles.length = targetCount;

        const phaseStep = (DOT_SPEED_PX_PER_S * dtSeconds) / length;
        for (const p of particles) {
          p.phase = (p.phase + phaseStep) % 1;
          const px = x1 + dx * p.phase;
          const py = y1 + dy * p.phase;
          ctx.beginPath();
          ctx.arc(px, py, DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = CLASS_COLORS[p.trafficClass];
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [flowStoreApi]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden="true"
    />
  );
}

function pickClass(edgeMetrics: { byClass: Record<TrafficClass, number> } | undefined): TrafficClass {
  if (!edgeMetrics) return "read";
  const { static: s, read, write } = edgeMetrics.byClass;
  const total = s + read + write;
  if (total <= 0) return "read";
  const r = Math.random() * total;
  if (r < s) return "static";
  if (r < s + read) return "read";
  return "write";
}
