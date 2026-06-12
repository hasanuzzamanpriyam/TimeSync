import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface ReportExportProps {
  onPrint: () => void;
  onCsv: () => void;
}

export function ReportExport({ onPrint, onCsv }: ReportExportProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onPrint}>
        <Printer className="mr-1 h-4 w-4" /> Print PDF
      </Button>
      <Button variant="outline" size="sm" onClick={onCsv}>
        <Download className="mr-1 h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}
