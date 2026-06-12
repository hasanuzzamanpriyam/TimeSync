import { EmployeeReportRow } from "@/features/reports/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EmployeeReportProps {
  rows: EmployeeReportRow[];
  isLoading: boolean;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

export function EmployeeReport({ rows, isLoading }: EmployeeReportProps) {
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (rows.length === 0) return <p className="text-muted-foreground">No data for selected period.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.user_name}</TableCell>
            <TableCell>{r.task_title}</TableCell>
            <TableCell>{formatHours(r.total_seconds)}</TableCell>
            <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
