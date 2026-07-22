import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Analytics } from '../../types/dashboard';

const COLORS = ['#65d9a5', '#eab308', '#f97316', '#f43f5e'];
const tooltipStyle = {
  background: '#111714',
  border: '1px solid #243029',
  borderRadius: 12,
  fontSize: 12,
};

export function RiskTrendChart({ data }: { data: Analytics['riskTrend'] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#b8f34a" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#b8f34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#29342e" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" stroke="#b8f34a" strokeWidth={2} fill="url(#riskGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ConfidenceChart({ data }: { data: Analytics['confidenceTrend'] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#29342e" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="value" stroke="#65d9a5" fill="#65d9a522" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({ data }: { data: Analytics['reviewVolume'] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#29342e" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill="#b8f34a" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DistributionChart({ data }: { data: Analytics['riskDistribution'] }) {
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_150px]">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4}>
            {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-3">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-stone-500">
              <span className="size-2 rounded-full" style={{ background: COLORS[index] }} />
              {entry.name}
            </span>
            <span className="font-mono">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
