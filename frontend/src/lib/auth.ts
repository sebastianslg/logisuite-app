"use client";

import { useSyncExternalStore } from "react";
import { api } from "./client";

export type UserRole = "admin" | "operador" | "lector";

export interface Company {
  company_id: number;
  name: string;
  nit: string | null;
  active: number;
  created_at: string;
}

export interface AuthUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  role_label: string;
  role_description: string;
  company_id: number | null;
  company: Company | null;
  /** Si la cuenta tiene contraseña (las que entran solo con código al correo no la tienen). */
  has_password?: boolean;
}

export interface RequestOtpResponse {
  ok: boolean;
  message: string;
  expires_in_minutes: number;
  dev_code?: string;
}

export interface VerifyOtpResponse {
  token: string;
  expires_at: string;
  user: AuthUser;
}

const TOKEN_KEY = "westvane.session_token";
const AUTH_EVENT = "westvane:auth";
/** Cookie con el mismo token: la lee el proxy de Next para dejar pasar a la app (las páginas piden sesión). */
export const SESSION_COOKIE = "westvane_session";
const SESSION_DAYS = 30;

function writeSessionCookie(token: string | null) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = token
    ? `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; SameSite=Lax${secure}`
    : `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function hasSessionCookie(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

let currentUser: AuthUser | null = null;
const userListeners = new Set<() => void>();

function notifyUserListeners() {
  userListeners.forEach((l) => l());
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* almacenamiento no disponible */
  }
  writeSessionCookie(token);
  if (!token) {
    currentUser = null;
    notifyUserListeners();
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function subscribeAuth(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_EVENT, callback);
  };
}

export function useAuthToken(): string | null {
  return useSyncExternalStore(
    subscribeAuth,
    () => getAuthToken(),
    () => null,
  );
}

function subscribeUser(callback: () => void) {
  userListeners.add(callback);
  return () => {
    userListeners.delete(callback);
  };
}

let inflightFetch: Promise<void> | null = null;

export async function refreshUser(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) {
    currentUser = null;
    notifyUserListeners();
    return null;
  }
  if (inflightFetch) {
    await inflightFetch;
    return currentUser;
  }

  inflightFetch = api<AuthUser>("/api/auth/me")
    .then((data) => {
      currentUser = data;
      const opName = data.full_name || data.username;
      if (opName && typeof window !== "undefined") {
        try {
          localStorage.setItem("westvane.operator", opName);
          window.dispatchEvent(new Event("westvane:pref"));
        } catch {
          /* ignore */
        }
      }
      notifyUserListeners();
    })
    .catch(() => {
      currentUser = null;
      setAuthToken(null);
      notifyUserListeners();
    })
    .finally(() => {
      inflightFetch = null;
    });

  await inflightFetch;
  return currentUser;
}

if (typeof window !== "undefined") {
  // Sesiones abiertas antes de que la app pidiera ingresar: el token estaba solo en el navegador; se copia a la cookie
  const saved = getAuthToken();
  if (saved && !hasSessionCookie()) writeSessionCookie(saved);
  if (getAuthToken() && !currentUser) {
    void refreshUser();
  }
  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY) {
      void refreshUser();
    }
  });
}

export function useAuth() {
  const token = useAuthToken();
  const user = useSyncExternalStore(
    subscribeUser,
    () => currentUser,
    () => null,
  );

  const requestOtp = async (email: string) => {
    return api<RequestOtpResponse>("/api/auth/otp/request", {
      method: "POST",
      body: { email },
    });
  };

  const verifyOtp = async (email: string, code: string) => {
    const res = await api<VerifyOtpResponse>("/api/auth/otp/verify", {
      method: "POST",
      body: { email, code },
    });
    return openSession(res);
  };

  /** Usuario o correo + contraseña (cuentas a las que se les puso contraseña desde el servidor). */
  const loginPassword = async (identifier: string, password: string) => {
    const res = await api<VerifyOtpResponse>("/api/auth/password", {
      method: "POST",
      body: { identifier, password },
    });
    return openSession(res);
  };

  const openSession = (res: VerifyOtpResponse) => {
    currentUser = res.user;
    notifyUserListeners();
    setAuthToken(res.token);
    const opName = res.user.full_name || res.user.username;
    if (opName && typeof window !== "undefined") {
      try {
        localStorage.setItem("westvane.operator", opName);
        window.dispatchEvent(new Event("westvane:pref"));
      } catch {
        /* ignore */
      }
    }
    return res;
  };

  const logout = async () => {
    try {
      await api<void>("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    } finally {
      currentUser = null;
      notifyUserListeners();
      setAuthToken(null);
      // El borrador del envío nuevo puede traer datos del cliente: no le sobrevive al cierre de sesión
      try { window.localStorage.removeItem("westvane.borrador-envio"); } catch { /* sin permiso */ }
      // Sin sesión la app no se puede usar: vuelve a la pantalla de ingreso con una carga completa (borra lo que la app
      // tenía en memoria y el proxy ya no ve la cookie)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/ingresar");
    }
  };

  return {
    token,
    user,
    requestOtp,
    verifyOtp,
    loginPassword,
    logout,
    refreshUser,
  };
}
