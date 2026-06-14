import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppUsageReportRow } from "@/features/reports/hooks/useAppUsageReport";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface AppUsageReportProps {
  rows: AppUsageReportRow[];
  isLoading: boolean;
}

export function AppUsageReport({ rows, isLoading }: AppUsageReportProps) {
  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Loading...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No app usage data found for this period.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Application</TableHead>
            <TableHead>Window Title</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.user_name}</TableCell>
              <TableCell>{row.app_name}</TableCell>
              <TableCell className="max-w-xs truncate">{row.window_title ?? "—"}</TableCell>
              <TableCell className="text-right font-mono">{formatDuration(row.total_seconds)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
