export type UserRole = "employee" | "manager" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  erp_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_remember_me: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_in: number;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}
