import { create } from "zustand";
import { User } from "@/types";
import { authApi } from "@/services/api/auth";
import { secureStorage } from "@/services/storage/secure";
import { initDatabase } from "@/lib/db";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username, password, _rememberMe = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(username, password);
      const db = await initDatabase();

      await secureStorage.setTokens(
        response.access_token,
        response.refresh_token,
      );

      await db.execute(
        `INSERT OR REPLACE INTO users (id, username, email, role, full_name, avatar_url, is_active, erp_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))`,
        [
          response.user.id,
          response.user.username,
          response.user.email,
          response.user.role,
          response.user.full_name,
          response.user.avatar_url ?? null,
          response.user.is_active ? 1 : 0,
          response.user.erp_id ?? null,
        ],
      );

      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || "Login failed",
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await secureStorage.clearTokens();
      await authApi.logout();
    } finally {
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  refreshToken: async () => {
    try {
      const currentRefreshToken = await secureStorage.getRefreshToken();
      if (!currentRefreshToken) throw new Error("No refresh token");

      const response = await authApi.refresh(currentRefreshToken);
      await secureStorage.setTokens(
        response.access_token,
        response.refresh_token,
      );
    } catch {
      await get().logout();
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      const db = await initDatabase();
      const result = await db.select<Record<string, any>[]>(
        "SELECT u.* FROM users u INNER JOIN sessions s ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1",
      );

      if (result.length > 0) {
        const row = result[0];
        set({
          user: {
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role,
            full_name: row.full_name,
            avatar_url: row.avatar_url ?? undefined,
            is_active: row.is_active === 1,
            erp_id: row.erp_id ?? undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, isAuthenticated: false, user: null });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearError: () => set({ error: null }),
}));
