import api from "@/lib/api";
import { TimeEntry } from "@/types";

export const timeEntryApi = {
  async pushTimeEntry(entry: Partial<TimeEntry>): Promise<TimeEntry> {
    const response = await api.post<TimeEntry>("/time-entries", entry);
    return response.data;
  },

  async updateTimeEntry(id: number, data: Partial<TimeEntry>): Promise<TimeEntry> {
    const response = await api.put<TimeEntry>(`/time-entries/${id}`, data);
    return response.data;
  },
};
