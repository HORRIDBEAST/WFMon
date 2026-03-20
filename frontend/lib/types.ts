export interface TimeseriesResponse {
  timestamps: string[];
  actual: (number | null)[];
  forecast: (number | null)[];
}

export interface MetricsResponse {
  mae: number;
  rmse: number;
  p99: number;
  n: number;
}

export interface QueryParams {
  startTime: string;   // ISO-8601
  endTime: string;
  horizon: number;     // hours
}