import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) { 
    return (
        <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-neutral-900 tracking-tight">
            Mindspace
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/archive" className="text-neutral-700 hover:text-neutral-900">
              Archive
            </Link>
            <Link href="/insights" className="text-neutral-700 hover:text-neutral-900">
              Insights
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