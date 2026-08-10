"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Lock,
  PauseCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/BrandLogo";
import { FxAmbientBackdrop } from "@/components/FxAmbientBackdrop";
import { FxHeroBlock, FxPageEnter, FxReveal, FxStagger, FxStaggerItem } from "@/components/fx-motion";

const FEATURES = [
  {
    title: "Organization isolation",
    description: "Every workflow, run, and step belongs to exactly one organization, enforced in Hasura permissions — not just hidden in the UI.",
    icon: ShieldCheck,
  },
  {
    title: "Owner / editor / viewer roles",
    description: "Sensitive steps like DB writes, notifications, and webhook triggers are owner-only — checked on both the row and the Action.",
    icon: Users,
  },
  {
    title: "Real AI + HTTP steps",
    description: "Chain a live LLM call into an HTTP request, with automatic retry on failure and full input/output captured per attempt.",
    icon: Zap,
  },
  {
    title: "Conditional branching",
    description: "Route execution based on a previous step's output — skip downstream steps when a condition evaluates to false.",
    icon: GitBranch,
  },
  {
    title: "Approval gates",
    description: "Pause a run mid-flight for human sign-off, then resume from the very next step — never from the beginning.",
    icon: PauseCircle,
  },
  {
    title: "Live execution tracking",
    description: "Every status change streams over a GraphQL subscription. No polling, no refresh — watch pending turn to running to completed.",
    icon: Radio,
  },
];

const STATS = [
  { value: "6", label: "Step types" },
  { value: "2", label: "Permission layers" },
  { value: "100%", label: "Real-time, zero polling" },
  { value: "0", label: "Frontend-only auth shortcuts" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Design your workflow",
    body: "Chain LLM calls, HTTP requests, conditionals, approval gates, and DB writes in the order you need.",
    icon: Sparkles,
  },
  {
    step: "02",
    title: "Run it your way",
    body: "Trigger manually from the UI, or start it from any external system with a webhook.",
    icon: Zap,
  },
  {
    step: "03",
    title: "Watch it live, approve when needed",
    body: "Every step streams its status in real time. If it hits an approval gate, an authorized owner signs off and it resumes.",
    icon: CheckCircle2,
  },
];

function PipelinePreview() {
  const rows = [
    { label: "LLM Call", status: "completed" },
    { label: "HTTP Request", status: "completed" },
    { label: "Conditional Branch", status: "running" },
    { label: "Approval Gate", status: "queued" },
  ] as const;

  const dot: Record<string, string> = {
    completed: "bg-emerald-400",
    running: "bg-primary animate-pulse",
    queued: "bg-white/20",
  };
  const text: Record<string, string> = {
    completed: "text-emerald-400",
    running: "text-primary",
    queued: "text-slate-500",
  };
  const icon: Record<string, string> = {
    completed: "✓",
    running: "⟳",
    queued: "○",
  };

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div
          key={r.label}
          className={cn(
            "flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5",
            r.status === "running" && "border-primary/30 bg-primary/[0.06]"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", dot[r.status])} />
            <span className="text-sm text-slate-200">{r.label}</span>
          </div>
          <span className={cn("text-sm font-semibold", text[r.status])}>{icon[r.status]}</span>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/workflows");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="relative min-h-[100dvh] site-bg text-foreground">
      <FxAmbientBackdrop />
      <div className="relative z-[1]">
        <header className="sticky top-0 z-50 w-full pt-1.5 pb-1">
          <nav className="mx-3 flex h-[3.35rem] items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-background/[0.85] px-3 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:mx-6 sm:px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 no-underline">
              <BrandLogo size="sm" />
              <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-base font-semibold tracking-tight text-transparent">
                AI Agent Workflow Builder
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-9 rounded-xl px-4 font-medium hover:bg-white/[0.06]">
                  Sign in
                </Button>
              </Link>
              <Link href="/login?mode=signup">
                <Button size="sm" className="h-9 rounded-xl px-4 font-semibold">
                  Get started
                </Button>
              </Link>
            </div>
          </nav>
        </header>

        <main>
          <FxPageEnter>
            {/* Hero */}
            <section className="relative overflow-hidden landing-hero-mesh landing-hero-grid">
              <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 sm:px-6 md:pb-14 md:pt-14 lg:pb-16 lg:pt-16">
                <div className="grid items-center gap-10 lg:grid-cols-[1fr_min(100%,420px)] lg:gap-14">
                  <FxHeroBlock>
                    <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 shadow-sm backdrop-blur-sm">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Multi-tenant · Secure by default
                    </span>
                    <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl md:leading-[1.06] lg:text-[3.65rem]">
                      Build <span className="landing-hero-keyword">AI agent workflows</span> your whole
                      team can <span className="landing-hero-keyword">trust</span>
                    </h1>
                    <p className="mt-6 max-w-xl text-base font-normal leading-relaxed text-slate-400/95 md:text-lg">
                      Chain LLM calls, HTTP requests, conditionals, approval gates, and database writes into
                      workflows your organization actually owns — with role-based access, real-time execution
                      tracking, and no frontend-only security shortcuts.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link href="/login?mode=signup">
                        <Button size="lg" className="rounded-2xl px-9 font-semibold">
                          Get started free
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href="/login">
                        <Button
                          size="lg"
                          variant="outline"
                          className="rounded-2xl border-white/12 bg-white/[0.04] px-9 font-semibold text-slate-100 hover:border-primary/35 hover:bg-white/[0.09] hover:text-white"
                        >
                          Sign in
                        </Button>
                      </Link>
                    </div>
                    <ul className="mt-8 flex flex-col gap-3 text-slate-400 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
                      {[
                        "Org-level data isolation",
                        "Real-time step status",
                        "Approval gates on sensitive steps",
                      ].map((t) => (
                        <li key={t} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </FxHeroBlock>

                  <FxHeroBlock className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none [animation-delay:120ms]">
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
                      animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                      className="relative"
                    >
                      <div
                        className="absolute -inset-1 rounded-[1.75rem] bg-gradient-to-br from-indigo-500/25 via-fuchsia-500/15 to-primary/20 opacity-70 blur-md"
                        aria-hidden
                      />
                      <div className="relative overflow-hidden rounded-[1.25rem] border border-white/[0.1] bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-200">Customer Complaint Workflow</p>
                          <Badge variant="secondary" className="rounded-lg border-primary/25 bg-primary/10 text-primary">
                            Live
                          </Badge>
                        </div>
                        <PipelinePreview />
                        <div className="mt-4 flex items-start justify-between gap-3 border-t border-white/[0.08] pt-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">Streaming via GraphQL subscription</p>
                            <p className="mt-1 text-xs text-slate-500">No refresh. No polling.</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </FxHeroBlock>
                </div>
              </div>
              <div className="flex justify-center pb-3">
                <a href="#features" className="flex flex-col items-center gap-1 text-slate-500 no-underline transition-colors hover:text-slate-200">
                  <span className="text-xs uppercase tracking-wider">Explore</span>
                  <ChevronDown className="h-5 w-5 animate-bounce" />
                </a>
              </div>
            </section>

            {/* Stats */}
            <section className="border-y border-white/[0.06] py-8 md:py-10">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <FxReveal className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {STATS.map((s) => (
                    <div
                      key={s.label}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-5 text-center shadow-black/20 ring-1 ring-white/[0.04] backdrop-blur-md transition-all duration-300 hover:border-primary/20"
                    >
                      <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                      <p className="mt-1 text-sm text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </FxReveal>
              </div>
            </section>

            {/* Features */}
            <section id="features" className="scroll-mt-14 py-14 md:py-20">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <FxReveal className="mx-auto max-w-2xl text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Built for security first</p>
                  <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                    Every layer checks who you are, twice
                  </h2>
                  <p className="mt-4 text-slate-400">
                    Organization membership and role are verified in Hasura permissions for plain reads and
                    writes, and again in backend Action handlers for triggering runs and approving gates.
                  </p>
                </FxReveal>
                <FxStagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
                  {FEATURES.map((f) => {
                    const Icon = f.icon;
                    return (
                      <FxStaggerItem key={f.title}>
                        <div className="fx-card-hover h-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-black/20 ring-1 ring-white/[0.04] backdrop-blur-md">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                          </div>
                          <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.description}</p>
                        </div>
                      </FxStaggerItem>
                    );
                  })}
                </FxStagger>
              </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="scroll-mt-14 border-t border-white/[0.06] py-14 md:py-20">
              <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <FxReveal className="mx-auto max-w-2xl text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
                  <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">From design to done, live</h2>
                </FxReveal>
                <FxStagger className="mt-10 grid gap-5 md:grid-cols-3" stagger={0.08}>
                  {HOW_IT_WORKS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <FxStaggerItem key={s.step}>
                        <div className="fx-card-hover h-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 ring-1 ring-white/[0.04] backdrop-blur-md">
                          <div className="flex items-center justify-between">
                            <span className="text-3xl font-bold text-white/10">{s.step}</span>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                              <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                            </div>
                          </div>
                          <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
                        </div>
                      </FxStaggerItem>
                    );
                  })}
                </FxStagger>
              </div>
            </section>

            {/* CTA */}
            <section className="pb-20 pt-4 md:pb-24">
              <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
                <FxReveal>
                  <div className="fx-glass relative overflow-hidden rounded-[1.75rem] px-6 py-12 text-center sm:px-12">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-60"
                      style={{
                        background:
                          "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(91,141,239,0.18), transparent 60%)",
                      }}
                      aria-hidden
                    />
                    <div className="relative">
                      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
                        <Lock className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                      <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                        Ready to build your first workflow?
                      </h2>
                      <p className="mx-auto mt-3 max-w-md text-slate-400">
                        Create an account, join an organization, and watch a run go from pending to completed
                        in real time.
                      </p>
                      <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link href="/login?mode=signup">
                          <Button size="lg" className="rounded-2xl px-9 font-semibold">
                            Get started free
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href="/login">
                          <Button size="lg" variant="outline" className="rounded-2xl border-white/12 bg-white/[0.04] px-9 font-semibold text-slate-100">
                            Sign in
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </FxReveal>
              </div>
            </section>
          </FxPageEnter>
        </main>

        <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AI Agent Workflow Builder.
        </footer>
      </div>
    </div>
  );
}
