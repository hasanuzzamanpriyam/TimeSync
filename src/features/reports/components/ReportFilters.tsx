import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportFiltersProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
}

export function ReportFilters({ startDate, endDate, onStartDateChange, onEndDateChange }: ReportFiltersProps) {
  return (
    <div className="flex items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="start">Start Date</Label>
        <Input id="start" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="end">End Date</Label>
        <Input id="end" type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
      </div>
    </div>
  );
}
