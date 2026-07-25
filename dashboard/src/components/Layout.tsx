import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  Bell,
  Users,
  Building2,
  Crosshair,
  Menu,
  X,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { api } from '../api/client';
import SeverityBadge from './SeverityBadge';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/simulator', icon: Crosshair, label: 'Attack Sim' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/departments', icon: Building2, label: 'Departments' },
  { to: '/executive', icon: ShieldAlert, label: 'Executive' },
  { to: '/performance', icon: Activity, label: 'Performance' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    api.getSummary().then((s) => {
      setCriticalCount(s.severity_counts?.Critical || 0);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900/95 border-r border-slate-800 backdrop-blur-xl transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">ThreatWatch</h1>
              <p className="text-[10px] text-slate-500">SOC Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-700/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.to === '/alerts' && criticalCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {criticalCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-3">
            <Activity size={16} className="text-green-400" />
            <div className="text-xs">
              <p className="text-green-400 font-medium">System Online</p>
              <p className="text-slate-500">Detection Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between px-4 lg:px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>SOC</span>
              <ChevronRight size={12} />
              <span className="text-slate-200 font-medium">
                {navItems.find((n) =>
                  n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)
                )?.label || 'Overview'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
