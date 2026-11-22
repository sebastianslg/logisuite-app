"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/** Las filas largas no precargan tantas fichas como enlaces al entrar en el viewport. */
export function EnlaceIntencion({ href, onFocus, onPointerEnter, ...props }: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const router = useRouter();
  return <Link {...props} href={href} prefetch={false}
    onFocus={e => { onFocus?.(e); if (e.currentTarget.matches(":focus-visible")) router.prefetch(href); }}
    onPointerEnter={e => {
      onPointerEnter?.(e);
      if (e.pointerType === "mouse" && matchMedia("(hover: hover) and (pointer: fine)").matches) router.prefetch(href);
    }} />;
}
