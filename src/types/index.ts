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

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type TimeEntryType = "work" | "break";
export type TimerStatus = "running" | "paused" | "stopped";

export interface Project {
  id: number;
  name: string;
  description?: string;
  erp_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  project_id?: number;
  assigned_to?: number;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_minutes?: number;
  erp_id?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  type: TimeEntryType;
  started_at: string;
  paused_at?: string;
  resumed_at?: string;
  stopped_at?: string;
  total_seconds: number;
  is_running: boolean;
  erp_synced: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: number;
  keyboard_count: number;
  mouse_count: number;
  idle_seconds: number;
  recorded_at: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  is_manager: boolean;
  created_at: string;
}
