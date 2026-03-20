import { TimeseriesResponse, MetricsResponse, QueryParams } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function buildParams(params: QueryParams): URLSearchParams {
  return new URLSearchParams({
    start_time: params.startTime,
    end_time:   params.endTime,
    horizon:    String(params.horizon),
  });
}

export async function fetchTimeseries(
  params: QueryParams
): Promise<TimeseriesResponse> {
  const url = `${BASE_URL}/timeseries?${buildParams(params)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `API error ${res.status}`);
  }
  return res.json();
}

export async function fetchMetrics(
  params: QueryParams
): Promise<MetricsResponse> {
  const url = `${BASE_URL}/metrics?${buildParams(params)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `API error ${res.status}`);
  }
  return res.json();
}