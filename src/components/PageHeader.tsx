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
      </div>
      {right}
    </div>
  );
}
