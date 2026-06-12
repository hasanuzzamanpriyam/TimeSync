import api from "@/lib/api";
import { Task } from "@/types";

export const taskApi = {
  async fetchTasks(): Promise<Task[]> {
    const response = await api.get<Task[]>("/tasks");
    return response.data;
  },

  async pushTask(task: Partial<Task>): Promise<Task> {
    const response = await api.post<Task>("/tasks", task);
    return response.data;
  },

  async updateTask(id: number, data: Partial<Task>): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, data);
    return response.data;
  },

  async deleteTask(id: number): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },
};
