import { Shield, AlertTriangle, AlertCircle, Zap } from 'lucide-react';

const severityConfig = {
  Critical: { bg: 'bg-red-900/60 text-red-300 border-red-700/50', icon: Zap },
  High: { bg: 'bg-orange-900/60 text-orange-300 border-orange-700/50', icon: AlertCircle },
  Medium: { bg: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50', icon: AlertTriangle },
  Low: { bg: 'bg-green-900/60 text-green-300 border-green-700/50', icon: Shield },
};

export default function SeverityBadge({
  severity,
  size = 'sm',
}: {
  severity: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.Low;
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : size === 'md' ? 'text-sm px-3 py-1 gap-1.5' : 'text-base px-4 py-1.5 gap-2';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${config.bg} ${sizeClasses}`}
    >
      <Icon size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
      {severity}
    </span>
  );
}
