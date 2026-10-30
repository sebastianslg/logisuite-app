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
    }
  };

  return {
    token,
    user,
    requestOtp,
    verifyOtp,
    logout,
    refreshUser,
  };
}
