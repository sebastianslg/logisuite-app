"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, LockKeyhole, UserPlus } from "lucide-react";

import { openAuthModal } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { useAuth, type UserRole } from "@/lib/auth";
import { api } from "@/lib/client";
import { inputClass } from "@/components/fleet/form-bits";

interface AdminUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  active: number;
  created_at: string;
  company_id: number | null;
  company_name: string | null;
}
interface AdminCompany {
  company_id: number;
  name: string;
  nit: string | null;
  active: number;
}

const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: "admin", label: "Administrador", hint: "Administra usuarios y empresas" },
  { value: "operador", label: "Operador", hint: "Crea y edita envíos" },
  { value: "lector", label: "Lector", hint: "Solo consulta" },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label])) as Record<UserRole, string>;

/**
 * Administración de usuarios y empresas. Solo para quien inició sesión como administrador: el servidor lo exige
 * (401 sin sesión, 403 con otro rol); esta pantalla solo lo explica. Hoy el rol se muestra pero aún no limita
 * acciones en el resto de la app.
 */
export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([
        api<{ items: AdminUser[] }>("/api/admin/users"),
        api<{ items: AdminCompany[] }>("/api/companies"),
      ]);
      setUsers(u.items);
      setCompanies(c.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al tener sesión de administrador
      void load();
    }
  }, [isAdmin, load]);

  if (!user) {
    return (
      <div className="glass rounded-3xl">
        <EmptyState
          title="Inicia sesión para administrar"
          description="Esta sección es solo para administradores. Entra con el código que llega a tu correo."
          action={{ label: "Ingresar con código al correo", onClick: openAuthModal }}
        />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="glass rounded-3xl">
        <EmptyState
          title="Solo para administradores"
          description={`Tu rol es ${ROLE_LABEL[user.role]}. Pídele a un administrador que cambie tu rol si lo necesitas.`}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="glass overflow-hidden rounded-3xl" aria-labelledby="usuarios-t">
        <h2 id="usuarios-t" className="px-5 pt-5 pb-3 text-sm font-semibold">
          Usuarios {users && <span className="tabular font-normal text-muted-foreground">· {users.length}</span>}
        </h2>
        {error && <p role="alert" className="px-5 pb-3 text-sm text-destructive">{error}</p>}
        <ul className="rule-list border-t border-border">
          {(users ?? []).map((u) => (
            <UserRow key={u.user_id} u={u} me={u.user_id === user.user_id} onChanged={load} />
          ))}
        </ul>
        {users && users.length === 0 && <p className="px-5 pb-5 text-sm text-muted-foreground">Aún no hay usuarios.</p>}
      </section>

      <div className="flex flex-col gap-6">
        <NewUser companies={companies} onCreated={load} />
        <Companies companies={companies} onCreated={load} />
      </div>
    </div>
  );
}

function UserRow({ u, me, onChanged }: { u: AdminUser; me: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setRole(role: UserRole) {
    if (role === u.role) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${u.user_id}/role`, { method: "PUT", body: { role } });
      toast({ title: "Rol actualizado", description: `${u.full_name}: ${ROLE_LABEL[role]}` });
      onChanged();
    } catch (e) {
      toast({ title: "No se pudo cambiar el rol", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{u.full_name}</span>
          {me && <Badge tone="accent">Tú</Badge>}
          {!u.active && <Badge tone="neutral">Inactivo</Badge>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {u.email ?? "sin correo: no puede ingresar"}
          {u.company_name ? ` · ${u.company_name}` : ""}
        </span>
      </span>
      <select
        aria-label={`Rol de ${u.full_name}`}
        value={u.role}
        disabled={busy}
        onChange={(e) => void setRole(e.target.value as UserRole)}
        className="field h-9 w-40 px-3 text-sm outline-none disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </li>
  );
}

function NewUser({ companies, onCreated }: { companies: AdminCompany[]; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("operador");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: { email: email.trim(), full_name: name.trim(), role, company_id: companyId ? Number(companyId) : null },
      });
      toast({ title: "Usuario creado", description: `${name.trim()} ya puede ingresar con el código que le llegue a ${email.trim()}.` });
      setEmail("");
      setName("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass flex flex-col gap-3 rounded-3xl p-5" noValidate>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4 text-muted-foreground" aria-hidden /> Nuevo usuario
      </h2>
      <label className="block text-xs text-muted-foreground">
        Nombre completo
        <input className={`${inputClass} mt-1 text-foreground`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>
      <label className="block text-xs text-muted-foreground">
        Correo
        <input type="email" className={`${inputClass} mt-1 text-foreground`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Rol
        <select className={`${inputClass} mt-1 text-foreground`} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label} · {r.hint}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        Empresa
        <select className={`${inputClass} mt-1 text-foreground`} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Sin empresa</option>
          {companies.map((c) => (
            <option key={c.company_id} value={c.company_id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !email.trim() || !name.trim()}>
        {busy ? "Creando…" : "Crear usuario"}
      </Button>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        No hay contraseñas: la persona ingresa con un código que le llega al correo.
      </p>
    </form>
  );
}

function Companies({ companies, onCreated }: { companies: AdminCompany[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [nit, setNit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/companies", { method: "POST", body: { name: name.trim(), nit: nit.trim() || null } });
      toast({ title: "Empresa creada" });
      setName("");
      setNit("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-5" aria-labelledby="empresas-t">
      <h2 id="empresas-t" className="flex items-center gap-2 text-sm font-semibold">
        <Building2 className="size-4 text-muted-foreground" aria-hidden /> Empresas
      </h2>
      <ul className="rule-list -mx-5 border-y border-border text-sm">
        {companies.map((c) => (
          <li key={c.company_id} className="px-5 py-2.5">
            <span className="font-medium">{c.name}</span>
            <span className="block text-xs text-muted-foreground">{c.nit ? `NIT ${c.nit}` : "Sin NIT"}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <input aria-label="Nombre de la empresa" placeholder="Nombre de la empresa" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <input aria-label="NIT (opcional)" placeholder="NIT (opcional)" className={inputClass} value={nit} onChange={(e) => setNit(e.target.value)} maxLength={20} />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="secondary" disabled={busy || !name.trim()}>
          Agregar empresa
        </Button>
      </form>
    </section>
  );
}
