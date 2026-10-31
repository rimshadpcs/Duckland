"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "over";

const BEST_KEY = "feynduck-run-best";
const DUCK_SIZE = 56;
const BLOCK_SIZE = 40;
const GRAVITY = 0.9;
const JUMP_VELOCITY = -15;
const START_SPEED = 6;
const SPEED_GAIN = 0.0025;
const POOL_SIZE = 4;

type Block = { x: number; active: boolean };

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be blocked; the best score just won't persist.
  }
}

const pad = (value: number) => String(Math.floor(value)).padStart(5, "0");

// A tiny endless runner for the footer: the duck hops over "?" gaps.
// Space, the up arrow or a tap jumps; it only listens while the footer is on screen.
export function DuckRun() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [best, setBest] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const duckRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const inViewRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const game = useRef({ y: 0, vy: 0, speed: START_SPEED, score: 0, nextGap: 0, last: 0, blocks: [] as Block[] });

  useEffect(() => setBest(readBest()), []);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const draw = () => {
    const g = game.current;
    if (duckRef.current) duckRef.current.style.transform = `translateY(${g.y}px)`;
    g.blocks.forEach((block, index) => {
      const el = blockRefs.current[index];
      if (!el) return;
      el.style.display = block.active ? "grid" : "none";
      el.style.transform = `translateX(${block.x}px)`;
    });
    if (scoreRef.current) scoreRef.current.textContent = pad(g.score);
  };

  const stop = () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  const tick = useCallback((now: number) => {
    const g = game.current;
    const stage = stageRef.current;
    if (!stage) return;
    const dt = Math.min(3, g.last ? (now - g.last) / 16.67 : 1);
    g.last = now;

    const width = stage.clientWidth;
    const duckLeft = Math.round(width * 0.12);

    g.vy += GRAVITY * dt;
    g.y = Math.min(0, g.y + g.vy * dt);
    if (g.y === 0) g.vy = 0;

    g.speed += SPEED_GAIN * dt;
    g.score += 0.12 * dt * (g.speed / START_SPEED);

    g.nextGap -= g.speed * dt;
    if (g.nextGap <= 0) {
      const free = g.blocks.find((block) => !block.active);
      if (free) {
        free.active = true;
        free.x = width + BLOCK_SIZE;
      }
      g.nextGap = 300 + Math.random() * 360;
    }

    for (const block of g.blocks) {
      if (!block.active) continue;
      block.x -= g.speed * dt;
      if (block.x < -BLOCK_SIZE) block.active = false;
      // The duck's box, shrunk a little so near misses feel fair.
      const overlapsX = block.x < duckLeft + DUCK_SIZE - 12 && block.x + BLOCK_SIZE > duckLeft + 12;
      const overlapsY = -g.y < BLOCK_SIZE - 8;
      if (overlapsX && overlapsY) {
        draw();
        stop();
        const finalScore = Math.floor(g.score);
        if (finalScore > readBest()) {
          saveBest(finalScore);
          setBest(finalScore);
        }
        setPhaseBoth("over");
        return;
      }
    }

    draw();
    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    game.current = {
      y: 0,
      vy: 0,
      speed: START_SPEED,
      score: 0,
      nextGap: 200,
      last: 0,
      blocks: Array.from({ length: POOL_SIZE }, () => ({ x: 0, active: false })),
    };
    setPhaseBoth("running");
    stop();
    frameRef.current = window.requestAnimationFrame(tick);
  }, [tick]);

  const act = useCallback(() => {
    if (phaseRef.current !== "running") {
      start();
      return;
    }
    if (game.current.y === 0) game.current.vy = JUMP_VELOCITY;
  }, [start]);

  // Listen for keys only while the game is on screen, and never steal keys from form fields.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (!entry.isIntersecting && phaseRef.current === "running") {
          stop();
          setPhaseBoth("idle");
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(stage);

    const onKey = (event: KeyboardEvent) => {
      if (!inViewRef.current || (event.code !== "Space" && event.code !== "ArrowUp")) return;
      const target = event.target;
      if (target instanceof Element && target !== stage && target.closest("input, textarea, select, button, a, [contenteditable]")) {
        return;
      }
      event.preventDefault();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      stop();
    };
  }, [act]);

  return (
    <div
      ref={stageRef}
      className={`sk-run is-${phase}`}
      tabIndex={0}
      role="group"
      aria-label="Feynduck run, a small game. Press space or tap to jump over the gaps."
      onPointerDown={(event) => {
        event.preventDefault();
        stageRef.current?.focus();
        act();
      }}
    >
      <span className="sk-cloud is-a" aria-hidden="true" />
      <span className="sk-cloud is-b" aria-hidden="true" />
      <span className="sk-cloud is-c" aria-hidden="true" />

      <div className="sk-run-score" aria-hidden="true">
        <span>
          Clarity
          <b ref={scoreRef}>00000</b>
        </span>
        <span>
          Best
          <b>{pad(best)}</b>
        </span>
      </div>

      {phase !== "running" ? (
        <div className="sk-run-title">
          <strong>{phase === "over" ? "Gap!" : "feynduck run"}</strong>
          <span>
            {phase === "over" ? "Press space or tap to try again" : "Press space or tap to play"}
            <i aria-hidden="true">_</i>
          </span>
        </div>
      ) : null}

      <div className="sk-run-duck" ref={duckRef} aria-hidden="true">
        <img src="/feynduckhead.png" alt="" width={DUCK_SIZE} height={DUCK_SIZE} />
      </div>
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <div
          key={index}
          className="sk-run-block"
          ref={(el) => {
            blockRefs.current[index] = el;
          }}
          aria-hidden="true"
        >
          ?
        </div>
      ))}
      <div className="sk-run-ground" aria-hidden="true" />
    </div>
  );
}
