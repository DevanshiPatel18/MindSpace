"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isLocked = path === "/unlock";

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-neutral-900 tracking-tight">
            Mindspace
          </Link>
          {!isLocked && (
            <div className="flex items-center gap-3 text-sm">
              <Link href="/archive" className="text-neutral-700 hover:text-neutral-900">
                Archive
              </Link>
              <Link href="/insights" className="text-neutral-700 hover:text-neutral-900">
                Insights
              </Link>
              <Link href="/memory" className="text-neutral-700 hover:text-neutral-900">
                Memory
              </Link>
              <Link href="/backup" className="text-neutral-700 hover:text-neutral-900">
                Backup
              </Link>

              <Link href="/import" className="text-neutral-700 hover:text-neutral-900">
                Import
              </Link>
              <Link className="text-neutral-700 hover:text-neutral-900" href="/settings">
                Settings
              </Link>
            </div>
          )}
        </div>
        {children}
        <div className="mt-10 text-xs text-neutral-400">
          Trust-first MVP • No accounts • Optional AI • Your words stay yours
        </div>
      </div>
    </div>
  )
}