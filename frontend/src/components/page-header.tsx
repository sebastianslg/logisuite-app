import { Reveal } from "@/components/reveal";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Reveal>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] md:text-[2.5rem]">{title}</h1>
          {description && (
            <p className="mt-3 line-clamp-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground md:line-clamp-none">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
    </Reveal>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-3xl ${className}`} aria-hidden />;
}
