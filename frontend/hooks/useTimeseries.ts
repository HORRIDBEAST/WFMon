import useSWR from "swr";
import { fetchTimeseries } from "@/lib/api";
import { QueryParams, TimeseriesResponse } from "@/lib/types";

export function useTimeseries(params: QueryParams | null) {
  const key = params
    ? ["timeseries", params.startTime, params.endTime, params.horizon]
    : null;

  const { data, error, isLoading } = useSWR<TimeseriesResponse>(
    key,
    () => fetchTimeseries(params!),
    {
      revalidateOnFocus: false,
      dedupingInterval:  30_000,
    }
  );

  return { data, error, isLoading };
}