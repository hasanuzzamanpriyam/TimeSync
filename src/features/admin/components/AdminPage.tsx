import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErpSettings } from "@/features/admin/components/ErpSettings";
import { UserManagement } from "@/features/admin/components/UserManagement";
import { TeamManagement } from "@/features/admin/components/TeamManagement";

export function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Settings</h1>
      <Tabs defaultValue="erp">
        <TabsList>
          <TabsTrigger value="erp">ERP Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>
        <TabsContent value="erp" className="mt-4">
          <ErpSettings />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UserManagement />
        </TabsContent>
        <TabsContent value="teams" className="mt-4">
          <TeamManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
