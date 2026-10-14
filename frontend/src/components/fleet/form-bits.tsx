"use client";

import { cloneElement, useId, type ReactElement } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-9 w-full rounded-md border border-input bg-fill/50 px-3 text-sm outline-none [&>option]:bg-card disabled:opacity-60";
export const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-fill/50 px-3 py-2 text-sm outline-none";

type ControlProps = { id?: string; "aria-describedby"?: string };

/** Etiqueta + control + ayuda opcional, con el nombre accesible ya conectado. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactElement<ControlProps>;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": hint ? `${id}-hint` : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive")}>
      {message}
    </p>
  );
}
