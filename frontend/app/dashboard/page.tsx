"use client";

import { useState, useCallback } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { HorizonSlider }   from "@/components/HorizonSlider";
import { ForecastChart }   from "@/components/ForecastChart";
import { MetricsPanel }    from "@/components/MetricsPanel";
import { useTimeseries }   from "@/hooks/useTimeseries";
import { useMetrics }      from "@/hooks/useMetrics";
import { defaultStartTime, defaultEndTime } from "@/lib/utils";
import { QueryParams } from "@/lib/types";

export default function DashboardPage() {
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime,   setEndTime]   = useState(defaultEndTime);
  const [horizon,   setHorizon]   = useState(4);
  const [showError, setShowError] = useState(false);
  // Committed params — only update when user explicitly queries
  const [params, setParams] = useState<QueryParams>({
    startTime: defaultStartTime(),
    endTime:   defaultEndTime(),
    horizon:   4,
  });

  const { data: tsData,  error: tsError,  isLoading: tsLoading  } = useTimeseries(params);
  const { data: metrics, error: metricsError, isLoading: metricsLoading } = useMetrics(params);

  const handleApply = useCallback(() => {
    setParams({ startTime, endTime, horizon });
  }, [startTime, endTime, horizon]);

  const handleDateChange = useCallback((start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Wind forecast monitor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            UK national wind power · actual vs forecast
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
            <DateRangePicker
              startTime={startTime}
              endTime={endTime}
              onChange={handleDateChange}
            />

            <HorizonSlider value={horizon} onChange={setHorizon} />

            <div className="flex items-center gap-3 lg:ml-auto">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showError}
                  onChange={(e) => setShowError(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                Error overlay
              </label>

              <button
                onClick={handleApply}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <MetricsPanel
          metrics={metrics}
          isLoading={metricsLoading}
          error={metricsError as Error | undefined}
        />

        {/* Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">
            {params.startTime.slice(0, 10)} - {params.endTime.slice(0, 10)} - {params.horizon}h horizon
          </p>
          <ForecastChart
            data={tsData}
            metrics={metrics}
            isLoading={tsLoading}
            error={tsError as Error | undefined}
            showErrorOverlay={showError}
          />
        </div>

      </div>
    </main>
  );
}