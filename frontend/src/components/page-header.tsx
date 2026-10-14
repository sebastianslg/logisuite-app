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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold md:text-[2.125rem] md:leading-tight">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
    </Reveal>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-fill ${className}`} aria-hidden />;
}
