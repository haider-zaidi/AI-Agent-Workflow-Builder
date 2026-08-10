import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

export const metadata = {
  title: "AI Agent Workflow Builder",
  description: "A small, secure, multi-tenant workflow builder with AI/HTTP steps, approval gates and real-time updates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
