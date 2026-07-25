import { Search, Filter, X } from 'lucide-react';

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  severity?: string;
  onSeverityChange?: (v: string) => void;
  department?: string;
  onDepartmentChange?: (v: string) => void;
  departments?: string[];
  minScore?: number;
  onMinScoreChange?: (v: number) => void;
  showFilters?: boolean;
}

export default function FilterBar({
  search,
  onSearchChange,
  severity,
  onSeverityChange,
  department,
  onDepartmentChange,
  departments = [],
  minScore,
  onMinScoreChange,
  showFilters = true,
}: FilterBarProps) {
  const hasFilters = severity || department || (minScore && minScore > 0);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by user ID or department..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field pl-10"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-slate-500" />
          
          {onSeverityChange && (
            <select
              value={severity || ''}
              onChange={(e) => onSeverityChange(e.target.value)}
              className="input-field w-auto text-sm"
            >
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          )}

          {onDepartmentChange && (
            <select
              value={department || ''}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="input-field w-auto text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {onMinScoreChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Min score:</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore || 0}
                onChange={(e) => onMinScoreChange(Number(e.target.value))}
                className="input-field w-20 text-sm"
              />
            </div>
          )}

          {hasFilters && (
            <button
              onClick={() => {
                onSeverityChange?.('');
                onDepartmentChange?.('');
                onMinScoreChange?.(0);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
