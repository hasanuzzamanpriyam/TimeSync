import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamsStore } from "@/features/teams/store";
import { useAuthStore } from "@/features/auth/store";
import { getDatabase } from "@/lib/db";
import { Plus, Pencil, Trash2, UserPlus, Users, Shield, ShieldOff } from "lucide-react";

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export function TeamManagement() {
  const { teams, members, isLoading, fetchTeams, createTeam, updateTeam, deleteTeam, fetchMembers, addMember, removeMember, setManager } = useTeamsStore();
  const user = useAuthStore((s) => s.user);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (memberOpen && selectedTeam) {
      fetchMembers(selectedTeam);
    }
  }, [memberOpen, selectedTeam, fetchMembers]);

  useEffect(() => {
    const load = async () => {
      const db = await getDatabase();
      const rows = await db.select<UserRow[]>("SELECT id, username, full_name, role FROM users WHERE is_active = 1 ORDER BY full_name");
      setAllUsers(rows);
    };
    load();
  }, []);

  const handleCreate = async () => {
    if (!user) return;
    await createTeam(name, description || null, user.id);
    setName("");
    setDescription("");
    setCreateOpen(false);
  };

  const handleEdit = async () => {
    if (!selectedTeam) return;
    await updateTeam(selectedTeam, name, description || null);
    setEditOpen(false);
  };

  const openEdit = (team: { id: number; name: string; description?: string | null }) => {
    setSelectedTeam(team.id);
    setName(team.name);
    setDescription(team.description || "");
    setEditOpen(true);
  };

  const openMembers = (team: { id: number; name: string }) => {
    setSelectedTeam(team.id);
    setName(team.name);
    setMemberOpen(true);
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !selectedUserId) return;
    await addMember(selectedTeam, parseInt(selectedUserId), false);
    setSelectedUserId("");
    setAddMemberOpen(false);
  };

  const selectedTeamName = teams.find((t) => t.id === selectedTeam)?.name || "";

  const teamMembers = selectedTeam ? (members[selectedTeam] || []) : [];
  const memberUserIds = teamMembers.map((m) => m.user_id);
  const availableUsers = allUsers.filter((u) => !memberUserIds.includes(u.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Teams</h2>
        <Button onClick={() => { setName(""); setDescription(""); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Team
        </Button>
      </div>

      {teams.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No teams yet.</p>
      )}

      {teams.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell className="text-muted-foreground">{team.description || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openMembers(team)}>
                      <Users className="mr-1 h-4 w-4" /> Members
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(team)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete this team?")) await deleteTeam(team.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Members: {selectedTeamName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Button size="sm" onClick={() => setAddMemberOpen(true)} disabled={availableUsers.length === 0}>
              <UserPlus className="mr-2 h-4 w-4" /> Add Member
            </Button>

            {teamMembers.length === 0 && (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}

            {teamMembers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((m) => {
                    const u = allUsers.find((u) => u.id === m.user_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>{u?.full_name || `User #${m.user_id}`}</TableCell>
                        <TableCell>
                          {m.is_manager ? <Badge variant="default">Manager</Badge> : <Badge variant="secondary">Member</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setManager(selectedTeam!, m.user_id, !m.is_manager)} title={m.is_manager ? "Remove manager" : "Make manager"}>
                              {m.is_manager ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeMember(selectedTeam!, m.user_id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {addMemberOpen && (
              <div className="flex items-end gap-2 border-t pt-4">
                <div className="flex-1 space-y-1">
                  <Label>Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.full_name} ({u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddMember} disabled={!selectedUserId}>Add</Button>
                <Button variant="ghost" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
