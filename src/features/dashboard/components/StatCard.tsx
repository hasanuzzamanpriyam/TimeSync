import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function StatCard({ title, value, icon, isLoading, error, className }: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        {isLoading ? (
          <div className="mt-2 h-8 w-24 bg-muted animate-pulse rounded" />
        ) : error ? (
          <p className="mt-2 text-sm text-destructive">Error loading</p>
        ) : (
          <p className="mt-2 text-3xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
