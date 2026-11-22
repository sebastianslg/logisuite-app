import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/client";

const MIN = 10;

/**
 * Cambiar la propia contraseña. Solo aparece si la cuenta tiene contraseña (las que entran con código al correo no la
 * tienen). Exige la actual y, al guardar, el servidor cierra las demás sesiones de la cuenta.
 */
export function MyPassword() {
  const { user } = useAuth();
  // La sesión puede vivir solo en la cookie (sin token en el navegador): se pregunta aquí, sin tocar el estado global del dock
  const [cuenta, setCuenta] = useState<{ username: string; has_password?: boolean } | null>(user);
  useEffect(() => {
    if (user) return;
    api<{ username: string; has_password?: boolean }>("/api/auth/me").then(setCuenta).catch(() => setCuenta(null));
  }, [user]);
  const quien = user ?? cuenta;
  const [current, setCurrent] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = !!quien?.has_password;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < MIN) return setError(`La contraseña nueva debe tener al menos ${MIN} caracteres.`);
    if (nueva !== repetir) return setError("Las dos veces que escribiste la contraseña nueva no coinciden.");
    if (nueva === current) return setError("La contraseña nueva debe ser distinta de la actual.");
    setBusy(true);
    try {
      await api("/api/auth/password/change", {
        method: "POST",
        body: { current, new: nueva },
      });
      setCurrent("");
      setNueva("");
      setRepetir("");
      toast({ title: "Contraseña cambiada", description: "Las demás sesiones de tu cuenta se cerraron." });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    // Siempre en el árbol (oculto si no aplica): montarlo tarde cambiaría los ids de hidratación del resto del panel
    <div hidden={!visible}>
    <CollapsiblePanel title="Mi contraseña">
      <p className="text-xs text-muted-foreground">
        Cambia la contraseña de <strong className="font-medium text-foreground">{quien?.username}</strong>. Al guardar se cierran
        las demás sesiones de tu cuenta; esta sigue abierta.
      </p>
      <form onSubmit={guardar} className="mt-4 grid gap-3 sm:grid-cols-3" noValidate>
        <label className="block text-xs text-muted-foreground">
          Contraseña actual
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)}
            className="field mt-1 h-10 w-full px-3 text-sm text-foreground outline-none" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Nueva (mínimo {MIN})
          <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)}
            className="field mt-1 h-10 w-full px-3 text-sm text-foreground outline-none" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Repetir la nueva
          <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)}
            className="field mt-1 h-10 w-full px-3 text-sm text-foreground outline-none" />
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive sm:col-span-3">
            {error}
          </p>
        )}
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy || !current || !nueva || !repetir}>
            <KeyRound /> {busy ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        ¿Olvidaste la actual? Un administrador puede restablecerla desde la consola del servidor
        (<span className="font-mono">python -m app.crear_acceso</span>).
      </p>
    </CollapsiblePanel>
    </div>
  );
}
