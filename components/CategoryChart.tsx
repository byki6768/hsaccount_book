"use client";

import { CategoryStat } from "@/lib/categories";

type CategoryChartProps = {
  title: string;
  stats: CategoryStat[];
  accentClassName?: string;
};

const COLORS = [
  "#059669",
  "#0d9488",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#65a30d",
  "#4b5563",
];

export function CategoryChart({
  title,
  stats,
  accentClassName = "bg-emerald-500",
}: CategoryChartProps) {
  const total = stats.reduce((sum, item) => sum + item.amount, 0);
  const max = Math.max(...stats.map((item) => item.amount), 1);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">
          합계{" "}
          <span className="font-semibold text-emerald-700">
            {total.toLocaleString("ko-KR")}원
          </span>
        </p>
      </div>

      {stats.length === 0 || total === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          아직 분류된 데이터가 없습니다. AI 분류 후 여기에 그래프가 표시됩니다.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
            {stats
              .filter((item) => item.amount > 0)
              .map((item, index) => (
                <div
                  key={`${item.categoryId ?? "none"}-${item.name}`}
                  title={`${item.name}: ${item.amount.toLocaleString("ko-KR")}원`}
                  className="h-full"
                  style={{
                    width: `${(item.amount / total) * 100}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              ))}
          </div>

          <ul className="space-y-3">
            {stats.map((item, index) => {
              const ratio = total > 0 ? (item.amount / total) * 100 : 0;
              return (
                <li key={`${item.categoryId ?? "none"}-${item.name}`}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate font-medium text-slate-700">{item.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{item.count}건</span>
                    </div>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      {item.amount.toLocaleString("ko-KR")}원 ({ratio.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${accentClassName}`}
                      style={{
                        width: `${(item.amount / max) * 100}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
