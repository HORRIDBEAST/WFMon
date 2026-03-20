"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { TimeseriesResponse, MetricsResponse } from "@/lib/types";
import { formatTimestamp, formatMW } from "@/lib/utils";

interface Props {
  data: TimeseriesResponse | undefined;
  metrics: MetricsResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
  showErrorOverlay: boolean;
}

interface ChartPoint {
  time: string;
  actual: number | null;
  forecast: number | null;
  error: number | null;
}

function buildChartData(data: TimeseriesResponse): ChartPoint[] {
  return data.timestamps.map((t, i) => {
    const actual   = data.actual[i]   ?? null;
    const forecast = data.forecast[i] ?? null;
    const error =
      actual !== null && forecast !== null
        ? Math.abs(actual - forecast)
        : null;
    return { time: formatTimestamp(t), actual, forecast, error };
  });
}

export function ForecastChart({
  data,
  metrics,
  isLoading,
  error,
  showErrorOverlay,
}: Props) {
  if (isLoading) {
    return (
      <div className="w-full h-80 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse flex items-center justify-center">
        <span className="text-sm text-gray-400">Loading chart…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-80 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-center">
        <span className="text-sm text-red-500">{error.message}</span>
      </div>
    );
  }

  if (!data || data.timestamps.length === 0) {
    return (
      <div className="w-full h-80 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <span className="text-sm text-gray-400">
          No data for the selected range and horizon.
        </span>
      </div>
    );
  }

  const chartData = buildChartData(data);
  const tickInterval = Math.floor(data.timestamps.length / 8);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={340}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            interval={tickInterval}
            tickLine={false}
            label={{
              value: "Target time (UTC)",
              position: "insideBottom",
              offset: -4,
              fontSize: 11,
              fill: "#9ca3af",
            }}
          />

          <YAxis
            tickFormatter={(v) => formatMW(v)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />

          <Tooltip
            formatter={(value, name) => {
              const numericValue =
                typeof value === "number" ? value : Number(value ?? 0);
              const metricName = String(name);
              return [
                `${Math.round(numericValue).toLocaleString()} MW`,
                metricName === "actual"
                  ? "Actual"
                  : metricName === "forecast"
                  ? "Forecast"
                  : "Error",
              ];
            }}
            labelStyle={{ fontWeight: 500 }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(val) =>
              val === "actual"
                ? "Actual generation"
                : val === "forecast"
                ? "Forecast generation"
                : "Absolute error"
            }
          />

          {/* Actual — blue */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />

          {/* Forecast — green */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />

          {/* Error overlay — optional */}
          {showErrorOverlay && (
            <Line
              type="monotone"
              dataKey="error"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              connectNulls={false}
              yAxisId={0}
            />
          )}

          {/* MAE reference line when overlay is active */}
          {showErrorOverlay && metrics && (
            <ReferenceLine
              y={metrics.mae}
              stroke="#f59e0b"
              strokeDasharray="8 4"
              label={{
                value: `MAE ${Math.round(metrics.mae)} MW`,
                fontSize: 10,
                fill: "#f59e0b",
                position: "insideTopRight",
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}