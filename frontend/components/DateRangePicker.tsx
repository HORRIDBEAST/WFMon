"use client";

interface Props {
  startTime: string;
  endTime: string;
  onChange: (start: string, end: string) => void;
}

export function DateRangePicker({ startTime, endTime, onChange }: Props) {
  function pad2(n: number): string {
    return String(n).padStart(2, "0");
  }

  function toInputValue(iso: string) {
    // datetime-local input expects local-like format without timezone.
    // We display UTC fields explicitly to prevent local timezone drift.
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";

    const yyyy = d.getUTCFullYear();
    const mm = pad2(d.getUTCMonth() + 1);
    const dd = pad2(d.getUTCDate());
    const hh = pad2(d.getUTCHours());
    const mi = pad2(d.getUTCMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function toUtcIso(value: string): string | null {
    // Expected from datetime-local: YYYY-MM-DDTHH:mm
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return null;
    }
    return `${value}:00Z`;
  }

  function handleStart(e: React.ChangeEvent<HTMLInputElement>) {
    const nextStart = toUtcIso(e.target.value);
    if (!nextStart) return;
    onChange(nextStart, endTime);
  }

  function handleEnd(e: React.ChangeEvent<HTMLInputElement>) {
    const nextEnd = toUtcIso(e.target.value);
    if (!nextEnd) return;
    onChange(startTime, nextEnd);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Start time
        </label>
        <input
          type="datetime-local"
          value={toInputValue(startTime)}
          onChange={handleStart}
          step={1800}
          className="rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 px-3 py-2 text-sm
                     text-gray-900 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          End time
        </label>
        <input
          type="datetime-local"
          value={toInputValue(endTime)}
          onChange={handleEnd}
          step={1800}
          className="rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 px-3 py-2 text-sm
                     text-gray-900 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}