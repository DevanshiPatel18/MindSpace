"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const linkClass = (href: string) =>
    `text-sm ${path === href ? "text-neutral-900 font-semibold" : "text-neutral-600 hover:text-neutral-900"}`;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-neutral-900 tracking-tight">
            Mindspace
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/archive" className={linkClass("/archive")}>
              Archive
            </Link>
            <Link href="/insights" className={linkClass("/insights")}>
              Insights
            </Link>
            <Link href="/settings" className={linkClass("/settings")}>
              Settings
            </Link>
          </div>
        </div>
        {children}
        <div className="mt-10 text-xs text-neutral-400">
          Trust-first MVP • No accounts • Optional AI • Your words stay yours
        </div>
      </div>
    </div>
  )
}