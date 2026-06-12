

interface UseAttendanceStatusResult {
  status: "checked_in" | "checked_out" | "on_break" | "unavailable";
  note: string;
  isLoading: boolean;
  error: string | null;
}

export function useAttendanceStatus(): UseAttendanceStatusResult {
  return {
    status: "unavailable",
    note: "Attendance module not yet available",
    isLoading: false,
    error: null,
  };
}
