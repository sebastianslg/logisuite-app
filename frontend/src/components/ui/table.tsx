import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    // overflow-clip: no crea un contenedor de desplazamiento, así un encabezado `sticky` se fija a la página
    <div data-slot="table-container" className="relative w-full overflow-clip">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border transition-colors duration-200 ease-apple hover:bg-[color-mix(in_srgb,var(--card)_96%,var(--foreground))] data-[state=selected]:bg-primary/[0.05] data-[state=selected]:shadow-[inset_2px_0_0_var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-2.5 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5 min-[1600px]:px-3 min-[1600px]:first:pl-5 min-[1600px]:last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-2.5 py-3.5 align-middle whitespace-nowrap first:pl-5 last:pr-5 min-[1600px]:px-3 min-[1600px]:first:pl-5 min-[1600px]:last:pr-5", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
