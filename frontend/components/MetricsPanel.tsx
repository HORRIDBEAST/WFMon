"use client";

import { MetricsResponse } from "@/lib/types";

interface Props {
  metrics: MetricsResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${color}`}>{value}</span>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  );
}

export function MetricsPanel({ metrics, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-gray-100 dark:bg-gray-700"
          />
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-sm text-red-500 px-1">
        Could not load error metrics.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat
        label="MAE"
        value={(metrics.mae / 1000).toFixed(2)}
        unit="GW"
        color="text-blue-600 dark:text-blue-400"
      />
      <Stat
        label="RMSE"
        value={(metrics.rmse / 1000).toFixed(2)}
        unit="GW"
        color="text-purple-600 dark:text-purple-400"
      />
      <Stat
        label="P99 error"
        value={(metrics.p99 / 1000).toFixed(2)}
        unit="GW"
        color="text-amber-600 dark:text-amber-400"
      />
      <Stat
        label="Points"
        value={metrics.n.toLocaleString()}
        unit="samples"
        color="text-gray-700 dark:text-gray-300"
      />
    </div>
  );
}