import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types";
import { Play } from "lucide-react";

interface ActiveTaskCardProps {
  task: Task | null;
  isLoading?: boolean;
  error?: string | null;
}

export function ActiveTaskCard({ task, isLoading, error }: ActiveTaskCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">Active Task</p>
        {isLoading ? (
          <div className="mt-2 h-8 w-48 bg-muted animate-pulse rounded" />
        ) : error ? (
          <p className="mt-2 text-sm text-destructive">Error loading</p>
        ) : task ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              <p className="text-lg font-semibold truncate">{task.title}</p>
            </div>
            <Badge variant="outline" className="mt-1">{task.priority}</Badge>
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">No active task</p>
        )}
      </CardContent>
    </Card>
  );
}
