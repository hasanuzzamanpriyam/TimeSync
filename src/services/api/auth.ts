import api from "@/lib/api";
import { AuthResponse, User } from "@/types";

export const authApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/login", {
      username,
      password,
    });
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Silently fail — we clear local state regardless
    }
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  register: async (
    username: string,
    email: string,
    password: string,
    fullName: string,
  ): Promise<void> => {
    await api.post("/auth/register", {
      username,
      email,
      password,
      full_name: fullName,
    });
  },
};
