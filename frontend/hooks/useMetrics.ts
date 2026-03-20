import useSWR from "swr";
import { fetchMetrics } from "@/lib/api";
import { QueryParams, MetricsResponse } from "@/lib/types";

export function useMetrics(params: QueryParams | null) {
  const key = params
    ? ["metrics", params.startTime, params.endTime, params.horizon]
    : null;

  const { data, error, isLoading } = useSWR<MetricsResponse>(
    key,
    () => fetchMetrics(params!),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  return { data, error, isLoading };
}