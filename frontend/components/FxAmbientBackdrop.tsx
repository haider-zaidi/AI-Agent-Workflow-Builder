"use client";

import { useReducedMotion } from "framer-motion";

/** Soft neon color orbs drifting behind marketing/auth pages. Dark-only. */
export function FxAmbientBackdrop() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-[20%] top-[8%] h-[min(520px,80vw)] w-[min(520px,80vw)] animate-fx-drift rounded-full bg-fuchsia-500/[0.12] blur-[100px]" />
      <div className="absolute -right-[15%] top-[35%] h-[min(440px,70vw)] w-[min(440px,70vw)] animate-fx-drift-reverse rounded-full bg-cyan-400/[0.1] blur-[90px] [animation-delay:-9s]" />
      <div className="absolute bottom-[5%] left-[20%] h-[min(360px,55vw)] w-[min(360px,55vw)] animate-fx-drift-slow rounded-full bg-violet-500/[0.09] blur-[80px] [animation-delay:-4s]" />
      <div className="absolute left-1/2 top-[45%] h-[min(280px,50vw)] w-[min(280px,50vw)] -translate-x-1/2 animate-fx-pulse-ring rounded-full bg-primary/[0.06] blur-[70px]" />
    </div>
  );
}
