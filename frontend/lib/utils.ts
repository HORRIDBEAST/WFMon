import { format, parseISO, subDays } from "date-fns";

export function toISOLocal(date: Date): string {
  return date.toISOString();
}

export function defaultStartTime(): string {
  return subDays(new Date(), 1).toISOString();
}

export function defaultEndTime(): string {
  return new Date().toISOString();
}

export function formatTimestamp(iso: string): string {
  return format(parseISO(iso), "dd/MM HH:mm");
}

export function formatMW(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}