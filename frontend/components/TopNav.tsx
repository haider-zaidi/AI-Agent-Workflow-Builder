"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Gauge, Users, LogOut, Menu, X, ChevronDown } from "lucide-react";
import { useOrg } from "@/lib/org";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const ROLE_BADGE_CLASS: Record<string, string> = {
  owner: "border-primary/30 bg-primary/12 text-primary",
  editor: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  viewer: "border-white/15 bg-white/[0.06] text-slate-300",
};

function NavPillLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative z-10 rounded-full px-3.5 py-1.5 text-sm font-medium no-underline transition-colors duration-200",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {active && (
        <span
          className="absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-white/[0.1] to-white/[0.02] ring-1 ring-white/10"
          aria-hidden
        />
      )}
    </Link>
  );
}

function OrgSwitcher({
  orgs,
  currentOrgId,
  setCurrentOrgId,
  className,
}: {
  orgs: { id: string; name: string }[];
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={currentOrgId ?? ""}
        onChange={(e) => setCurrentOrgId(e.target.value)}
        className="h-9 w-full appearance-none rounded-xl border border-white/10 bg-black/20 py-1 pl-3 pr-8 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#12151c] text-foreground">
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function ProfileMenu({
  email,
  role,
  orgs,
  currentOrgId,
  setCurrentOrgId,
  onSignOut,
}: {
  email: string | null;
  role: string | null;
  orgs: { id: string; name: string }[];
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email ?? "?").charAt(0).toUpperCase();
  const currentOrgName = orgs.find((o) => o.id === currentOrgId)?.name;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-xs font-semibold text-white">
          {initial}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#12151c]/98 p-1 shadow-2xl backdrop-blur-xl"
            >
              <div className="border-b border-white/[0.07] px-3.5 py-3">
                <p className="truncate text-sm font-semibold text-foreground">{email}</p>
                {currentOrgName && <p className="mt-0.5 truncate text-xs text-muted-foreground">{currentOrgName}</p>}
              </div>

              <div className="p-2.5">
                {orgs.length > 0 && (
                  <div className="mb-2.5">
                    <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Organization
                    </p>
                    <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} setCurrentOrgId={setCurrentOrgId} />
                  </div>
                )}

                {role && (
                  <div className="mb-2.5 flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        ROLE_BADGE_CLASS[role]
                      )}
                    >
                      {role}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopNav({ onSignOut }: { onSignOut: () => void }) {
  const { orgs, currentOrgId, setCurrentOrgId, role, isLoading } = useOrg();
  const { email } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { name: "Workflows", href: "/workflows", icon: LayoutGrid },
    { name: "Usage", href: "/usage", icon: Gauge },
    ...(role === "owner" ? [{ name: "Members", href: "/members", icon: Users }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid h-16 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        <Link href="/workflows" className="flex shrink-0 items-center gap-2.5 no-underline">
          <BrandLogo size="sm" />
          <span className="hidden text-base font-semibold tracking-tight text-foreground sm:inline">
            Workflow Builder
          </span>
        </Link>

        <div className="hidden min-w-0 justify-self-center md:flex">
          <div className="flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-black/20 px-1 py-1 ring-1 ring-white/[0.04]">
            {links.map((link) => (
              <NavPillLink key={link.name} href={link.href} active={pathname?.startsWith(link.href) ?? false}>
                {link.name}
              </NavPillLink>
            ))}
          </div>
        </div>

        <div className="hidden justify-self-end md:block">
          {!isLoading && (
            <ProfileMenu
              email={email}
              role={role}
              orgs={orgs}
              currentOrgId={currentOrgId}
              setCurrentOrgId={setCurrentOrgId}
              onSignOut={onSignOut}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="col-start-3 inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-xl border border-white/12 bg-white/[0.06] text-foreground transition-all active:scale-95 md:hidden"
          aria-expanded={isOpen}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.07] bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-colors",
                      pathname?.startsWith(link.href)
                        ? "bg-white/[0.06] text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    {link.name}
                  </Link>
                );
              })}
              <div className="my-1 h-px bg-white/[0.06]" />
              {!isLoading && orgs.length > 0 && (
                <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} setCurrentOrgId={setCurrentOrgId} />
              )}
              <div className="flex items-center justify-between px-1 py-2">
                <span className="truncate text-xs text-muted-foreground">{email}</span>
                {role && (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                      ROLE_BADGE_CLASS[role]
                    )}
                  >
                    {role}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
