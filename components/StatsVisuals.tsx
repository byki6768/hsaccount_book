"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryStat } from "@/lib/categories";

const COLORS = [
  "#059669",
  "#0ea5e9",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#2563eb",
  "#64748b",
];

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function StatsTable({
  title,
  stats,
}: {
  title: string;
  stats: CategoryStat[];
}) {
  const total = stats.reduce((sum, item) => sum + item.amount, 0);
  const rows = stats.filter((item) => item.amount > 0 || item.count > 0);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500">
          합계 <span className="font-semibold text-emerald-700">{formatWon(total)}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
          표시할 통계가 없습니다
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="py-2 pr-2 font-medium">항목</th>
                <th className="py-2 pr-2 font-medium">건수</th>
                <th className="py-2 pr-2 font-medium">금액</th>
                <th className="py-2 font-medium">비중</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const ratio = total > 0 ? (item.amount / total) * 100 : 0;
                return (
                  <tr
                    key={`${item.categoryId ?? "none"}-${item.name}`}
                    className="border-b border-slate-50 text-slate-700"
                  >
                    <td className="py-2.5 pr-2 font-medium">{item.name}</td>
                    <td className="py-2.5 pr-2 tabular-nums">{item.count}</td>
                    <td className="py-2.5 pr-2 tabular-nums">{formatWon(item.amount)}</td>
                    <td className="py-2.5 tabular-nums">{ratio.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function StatsBarChart({
  title,
  stats,
  color = "#059669",
}: {
  title: string;
  stats: CategoryStat[];
  color?: string;
}) {
  const data = stats
    .filter((item) => item.amount > 0)
    .map((item) => ({
      name: item.name.length > 6 ? `${item.name.slice(0, 6)}…` : item.name,
      fullName: item.name,
      amount: item.amount,
    }));

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-800">{title}</h3>
      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
          막대그래프로 표시할 데이터가 없습니다
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                width={48}
                tickFormatter={(v) =>
                  v >= 10000 ? `${Math.round(v / 10000)}만` : String(v)
                }
              />
              <Tooltip
                formatter={(value) => formatWon(Number(value ?? 0))}
                labelFormatter={(_, payload) =>
                  String(payload?.[0]?.payload?.fullName ?? "")
                }
              />
              <Bar dataKey="amount" fill={color} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function StatsLineChart({
  title,
  points,
  color = "#0ea5e9",
}: {
  title: string;
  points: Array<{ date: string; amount: number }>;
  color?: string;
}) {
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-800">{title}</h3>
      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
          선그래프로 표시할 데이터가 없습니다
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickFormatter={(v) => String(v).slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                width={48}
                tickFormatter={(v) =>
                  v >= 10000 ? `${Math.round(v / 10000)}만` : String(v)
                }
              />
              <Tooltip formatter={(value) => formatWon(Number(value ?? 0))} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: color }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function SummaryCards({
  incomeTotal,
  expenseTotal,
}: {
  incomeTotal: number;
  expenseTotal: number;
}) {
  const balance = incomeTotal - expenseTotal;
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "수입", value: incomeTotal, className: "text-sky-700" },
        { label: "지출", value: expenseTotal, className: "text-emerald-700" },
        {
          label: "잔액",
          value: balance,
          className: balance >= 0 ? "text-slate-800" : "text-rose-600",
        },
      ].map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-slate-200/80 bg-white p-3 text-center shadow-sm"
        >
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${card.className}`}>
            {formatWon(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export { COLORS };
