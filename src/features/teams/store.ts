import { create } from "zustand";
import { Team, TeamMember } from "@/types";
import { invoke } from "@tauri-apps/api/core";

interface TeamsState {
  teams: Team[];
  members: Record<number, TeamMember[]>;
  managedTeams: Team[];
  isLoading: boolean;
  error: string | null;
  fetchTeams: () => Promise<void>;
  createTeam: (name: string, description: string | null, createdBy: number) => Promise<Team>;
  updateTeam: (id: number, name: string, description: string | null) => Promise<void>;
  deleteTeam: (id: number) => Promise<void>;
  fetchMembers: (teamId: number) => Promise<void>;
  addMember: (teamId: number, userId: number, isManager: boolean) => Promise<void>;
  removeMember: (teamId: number, userId: number) => Promise<void>;
  setManager: (teamId: number, userId: number, isManager: boolean) => Promise<void>;
  fetchManagedTeams: (userId: number) => Promise<void>;
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [],
  members: {},
  managedTeams: [],
  isLoading: false,
  error: null,

  fetchTeams: async () => {
    set({ isLoading: true, error: null });
    try {
      const teams = await invoke<Team[]>("get_teams");
      set({ teams, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || "Failed to fetch teams", isLoading: false });
    }
  },

  createTeam: async (name, description, createdBy) => {
    const team = await invoke<Team>("create_team", { name, description, createdBy });
    set((state) => ({ teams: [...state.teams, team] }));
    return team;
  },

  updateTeam: async (id, name, description) => {
    const team = await invoke<Team>("update_team", { id, name, description });
    set((state) => ({
      teams: state.teams.map((t) => (t.id === id ? team : t)),
    }));
  },

  deleteTeam: async (id) => {
    await invoke("delete_team", { id });
    set((state) => {
      const { [id]: _, ...rest } = state.members;
      return { teams: state.teams.filter((t) => t.id !== id), members: rest };
    });
  },

  fetchMembers: async (teamId) => {
    const members = await invoke<TeamMember[]>("get_team_members", { teamId });
    set((state) => ({ members: { ...state.members, [teamId]: members } }));
  },

  addMember: async (teamId, userId, isManager) => {
    await invoke("add_team_member", { teamId, userId, isManager });
    await get().fetchMembers(teamId);
  },

  removeMember: async (teamId, userId) => {
    await invoke("remove_team_member", { teamId, userId });
    await get().fetchMembers(teamId);
  },

  setManager: async (teamId, userId, isManager) => {
    await invoke("set_team_manager", { teamId, userId, isManager });
    await get().fetchMembers(teamId);
  },

  fetchManagedTeams: async (userId) => {
    try {
      const teams = await invoke<Team[]>("get_managed_teams", { userId });
      set({ managedTeams: teams });
    } catch {
      set({ managedTeams: [] });
    }
  },
}));
