"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { OrgProvider } from "@/lib/org";
import { TopNav } from "@/components/TopNav";
import { nhost } from "@/lib/nhost";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="container">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <OrgProvider>
      <TopNav onSignOut={() => nhost.auth.signOut()} />
      <div className="container">{children}</div>
    </OrgProvider>
  );
}
