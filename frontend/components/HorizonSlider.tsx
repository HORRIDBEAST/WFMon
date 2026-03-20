"use client";

interface Props {
  value: number;
  onChange: (hours: number) => void;
}

export function HorizonSlider({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 min-w-[180px]">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Forecast horizon:{" "}
        <span className="text-gray-900 dark:text-gray-100 font-semibold">
          {value}h
        </span>
      </label>
      <input
        type="range"
        min={0}
        max={48}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full accent-blue-500 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>0h</span>
        <span>48h</span>
      </div>
    </div>
  );
}