"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Workflow } from "lucide-react";
import { nhost } from "@/lib/nhost";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { FxAmbientBackdrop } from "@/components/FxAmbientBackdrop";
import { FxPageEnter } from "@/components/fx-motion";

type Mode = "signin" | "signup";

const inputClass =
  "h-11 rounded-xl border-white/10 bg-black/20 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30";

export default function LoginPage() {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/workflows");
  }, [isAuthenticated, router]);

  // Read ?mode=signup without useSearchParams, so this page doesn't need a
  // Suspense boundary just to support a link from the landing page's CTA.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result =
        mode === "signin"
          ? await nhost.auth.signIn({ email, password })
          : await nhost.auth.signUp({ email, password });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (!result.session) {
        // Only reachable if email verification is required server-side.
        setNotice("Account created. Check your email to verify it, then sign in.");
        setMode("signin");
        return;
      }

      router.replace("/workflows");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not reach the auth server: ${err.message}`
          : "Could not reach the auth server."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col site-bg auth-page-pattern text-foreground">
      <FxAmbientBackdrop />
      <div className="relative z-[1] flex flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
            <BrandLogo size="md" />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              AI Agent Workflow Builder
            </span>
          </Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-10">
          <FxPageEnter className="mx-auto w-full max-w-[440px] text-center">
            <div className="fx-glass rounded-[1.75rem] p-8 md:p-10">
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
                <Workflow className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-1 mb-8 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to build and run your workflows."
                  : "Sign up, then ask an org owner to add you as a member."}
              </p>

              {error && (
                <p className="mb-6 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mb-6 rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm text-primary">
                  {notice}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className={cn(inputClass, "pr-10")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base font-medium">
                  {busy
                    ? mode === "signin"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "signin"
                      ? "Sign in"
                      : "Sign up"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError(null);
                    setNotice(null);
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          </FxPageEnter>
        </div>

        <footer className="shrink-0 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AI Agent Workflow Builder.
        </footer>
      </div>
    </div>
  );
}
