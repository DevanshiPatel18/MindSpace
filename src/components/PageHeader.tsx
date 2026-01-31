import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-neutral-600 max-w-xl">{subtitle}</p> : null}
        <div className="mt-3 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Saved on this device • Encrypted at rest
          </span>
          <span className="ml-2">
            <Link href="/settings" className="underline underline-offset-4 hover:text-neutral-800">
              Settings
            </Link>
          </span>
        </div>
      </div>
      {right}
    </div>
  );
}