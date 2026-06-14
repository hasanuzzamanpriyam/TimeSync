import { useState, useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { useTeamsStore } from "@/features/teams/store";
import { useTaskStore } from "@/features/tasks/store";
import { getDatabase } from "@/lib/db";
import { TeamMember } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ListChecks, Users } from "lucide-react";

interface MemberWithUser {
  member: TeamMember;
  user: {
    id: number;
    username: string;
    full_name: string;
  };
}

export function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const { managedTeams, fetchManagedTeams } = useTeamsStore();
  const { tasks, fetchTasks, createTask } = useTaskStore();

  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [taskAssignee, setTaskAssignee] = useState("");

  useEffect(() => {
    if (user) {
      fetchManagedTeams(user.id);
    }
  }, [user, fetchManagedTeams]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!selectedTeamId) return;
    const load = async () => {
      const db = await getDatabase();
      const rows = await db.select<{ id: number; username: string; full_name: string }[]>(
        "SELECT u.id, u.username, u.full_name FROM team_members tm INNER JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ?1 ORDER BY u.full_name",
        [selectedTeamId],
      );
      const tm = (await useTeamsStore.getState().members)[selectedTeamId] || [];
      setMembers(
        tm.map((m) => ({
          member: m,
          user: rows.find((r) => r.id === m.user_id) || { id: m.user_id, username: "unknown", full_name: `User #${m.user_id}` },
        })),
      );
    };
    load();
  }, [selectedTeamId]);

  useEffect(() => {
    if (managedTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(managedTeams[0].id);
    }
  }, [managedTeams, selectedTeamId]);

  const selectedTeam = managedTeams.find((t) => t.id === selectedTeamId);
  const teamTaskIds = members.map((m) => m.user.id);
  const teamTasks = tasks.filter((t) => t.assigned_to && teamTaskIds.includes(t.assigned_to));

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !taskAssignee) return;
    await createTask({
      title: taskTitle,
      description: taskDesc || undefined,
      priority: taskPriority,
      status: "pending",
      assigned_to: parseInt(taskAssignee),
    });
    setTaskTitle("");
    setTaskDesc("");
    setTaskPriority("medium");
    setTaskAssignee("");
    setTaskOpen(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Teams</h1>
        {managedTeams.length > 1 && (
          <Select
            value={selectedTeamId?.toString() || ""}
            onValueChange={(v) => setSelectedTeamId(parseInt(v))}
          >
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Select team..." />
            </SelectTrigger>
            <SelectContent>
              {managedTeams.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {managedTeams.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You are not a manager of any team yet.
          </CardContent>
        </Card>
      )}

      {selectedTeam && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" /> {selectedTeam.name} — Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">No members in this team.</p>
              )}
              {members.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(({ member, user: u }) => (
                      <TableRow key={member.id}>
                        <TableCell>{u.full_name}</TableCell>
                        <TableCell>
                          {member.is_manager ? <Badge>Manager</Badge> : <Badge variant="secondary">Member</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> Team Tasks</span>
                <Button size="sm" onClick={() => setTaskOpen(true)}>
                  Assign Task
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamTasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No tasks assigned to this team.</p>
              )}
              {teamTasks.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamTasks.map((t) => {
                      const assigned = members.find((m) => m.user.id === t.assigned_to);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell>{assigned?.user.full_name || "-"}</TableCell>
                          <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                          <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea id="task-desc" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={taskPriority} onValueChange={(v: any) => setTaskPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map(({ member, user: u }) => (
                    <SelectItem key={member.id} value={u.id.toString()}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={!taskTitle.trim() || !taskAssignee}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
