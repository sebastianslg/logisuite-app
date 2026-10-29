"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";

const W = 600;
const H = 180;
const INK = "#1d1d1f";

/**
 * Firma manuscrita con el dedo, el lápiz o el mouse. El lienzo es «papel»: blanco con tinta oscura en los dos temas,
 * para que la firma se vea igual en la pantalla y en la remesa impresa. Entrega un PNG pequeño (data URL) al soltar.
 * No anima nada: solo dibuja mientras hay un trazo en curso.
 */
export function SignaturePad({ onChange, label = "Firma de quien recibe" }: { onChange: (png: string | null) => void; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const ctx = () => canvas.current?.getContext("2d") ?? null;

  function paper() {
    const c = ctx();
    if (!c) return;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, W, H);
    c.strokeStyle = INK;
    c.fillStyle = INK;
    c.lineWidth = 2.6;
    c.lineCap = "round";
    c.lineJoin = "round";
  }

  useEffect(paper, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    last.current = p;
    const c = ctx();
    c?.beginPath();
    c?.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    c?.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const c = ctx();
    if (!c) return;
    const p = point(e);
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
  }

  function up() {
    if (!last.current) return;
    last.current = null;
    setEmpty(false);
    onChange(canvas.current?.toDataURL("image/png") ?? null);
  }

  function clear() {
    paper();
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={empty}>
          <Eraser /> Borrar
        </Button>
      </div>
      <div className="relative">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          role="img"
          aria-label={empty ? `${label}: vacía. Dibuja la firma con el dedo, el lápiz o el mouse.` : `${label}: firmada`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="block aspect-[10/3] w-full cursor-crosshair touch-none rounded-xl border border-border-strong"
          style={{ backgroundColor: "#ffffff" }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-[#6e6e73]" aria-hidden>
            Firme aquí
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-[#c7c7cc]" aria-hidden />
      </div>
    </div>
  );
}
