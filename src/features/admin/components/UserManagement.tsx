import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getDatabase } from "@/lib/db";
import { Plus, Pen, Trash2 } from "lucide-react";

interface LocalUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export function UserManagement() {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<LocalUser | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");

  const fetchUsers = async () => {
    const db = await getDatabase();
    const rows = await db.select<Record<string, any>[]>(
      "SELECT id, username, email, role, is_active FROM users ORDER BY id",
    );
    setUsers(rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      role: r.role,
      is_active: r.is_active,
    })));
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("employee");
    setShowForm(true);
  };

  const openEdit = (u: LocalUser) => {
    setEditUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setPassword("");
    setRole(u.role);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = await getDatabase();
    if (editUser) {
      if (password) {
        await db.execute(
          "UPDATE users SET username = $1, email = $2, role = $3, password_hash = $4 WHERE id = $5",
          [username, email, role, password, editUser.id],
        );
      } else {
        await db.execute(
          "UPDATE users SET username = $1, email = $2, role = $3 WHERE id = $4",
          [username, email, role, editUser.id],
        );
      }
    } else {
      await db.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        [username, email, password, role],
      );
    }
    setShowForm(false);
    fetchUsers();
  };

  const handleDelete = async (id: number) => {
    const db = await getDatabase();
    await db.execute("UPDATE users SET is_active = 0 WHERE id = $1", [id]);
    fetchUsers();
  };

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    employee: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Users</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add User</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleColors[u.role]}>{u.role}</Badge>
                </TableCell>
                <TableCell>{u.is_active ? "Active" : "Inactive"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                      <Pen className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uname">Username</Label>
              <Input id="uname" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uemail">Email</Label>
              <Input id="uemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upass">{editUser ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input id="upass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required={!editUser} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">{editUser ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
