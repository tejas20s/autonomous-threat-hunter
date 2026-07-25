import { LucideIcon } from 'lucide-react';

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'indigo',
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'indigo' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
  trend?: { value: number; positive: boolean };
}) {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-800/50 text-indigo-400',
    red: 'from-red-500/20 to-red-600/10 border-red-800/50 text-red-400',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-800/50 text-orange-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-800/50 text-yellow-400',
    green: 'from-green-500/20 to-green-600/10 border-green-800/50 text-green-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-800/50 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-800/50 text-purple-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${colorMap[color]}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className="rounded-lg bg-white/5 p-2.5 backdrop-blur-sm">
          <Icon size={24} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={trend.positive ? 'text-green-400' : 'text-red-400'}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-slate-500">vs last period</span>
        </div>
      )}
    </div>
  );
}
