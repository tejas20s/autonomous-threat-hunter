import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  Briefcase,
  BarChart3,
  FolderOpen,
  Settings,
  HeartPulse,
  BellRing,
  LogOut,
  User,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin', 'Analyst', 'Viewer'] },
  { to: '/alerts', icon: Bell, label: 'Alerts', roles: ['Admin', 'Analyst', 'Viewer'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['Admin', 'Analyst', 'Viewer'] },
  { to: '/cases', icon: FolderOpen, label: 'Cases', roles: ['Admin', 'Analyst'] },
  { to: '/simulator', icon: Crosshair, label: 'Attack Sim', roles: ['Admin', 'Analyst'] },
  { to: '/departments', icon: Building2, label: 'Departments', roles: ['Admin', 'Analyst', 'Viewer'] },
  { to: '/executive', icon: Briefcase, label: 'Executive', roles: ['Admin', 'Analyst', 'Viewer'] },
  { to: '/performance', icon: BarChart3, label: 'Performance', roles: ['Admin', 'Analyst', 'Viewer'] },
];

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Admin', roles: ['Admin'] },
  { to: '/notifications', icon: BellRing, label: 'Notifications', roles: ['Admin'] },
  { to: '/health', icon: HeartPulse, label: 'System Health', roles: ['Admin', 'Analyst', 'Viewer'] },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getSummary().then((s) => {
      setCriticalCount(s.severity_counts?.Critical || 0);
    }).catch(() => {});
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allNavItems = [...navItems, ...(isAdmin ? adminItems : adminItems.filter(i => i.to !== '/admin'))];

  const findPageLabel = () => {
    for (const item of allNavItems) {
      if (item.to === '/') {
        if (location.pathname === '/') return item.label;
      } else if (location.pathname.startsWith(item.to)) {
        return item.label;
      }
    }
    return 'Overview';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <ShieldAlert size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">ThreatWatch</h1>
              <p className="text-[10px] text-slate-500 tracking-wider uppercase">SOC Platform</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-5 px-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Main Menu</p>
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
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-700/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                <span>{item.label}</span>
                {item.to === '/alerts' && criticalCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white shadow-sm">
                    {criticalCount}
                  </span>
                )}
              </NavLink>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Administration</p>
              </div>
              {adminItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-700/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <item.icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>

        {/* System status badge */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/40 border border-slate-700/50 p-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <div className="text-[11px]">
              <p className="text-green-400 font-medium">System Online</p>
              <p className="text-slate-500">Detection Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between px-4 lg:px-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="hidden sm:inline">SOC</span>
              <ChevronRight size={12} className="hidden sm:inline" />
              <span className="text-slate-200 font-medium">{findPageLabel()}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-900/30 border border-green-800/30 px-2.5 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all border border-transparent hover:border-slate-700/50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white">
                  {user?.full_name?.charAt(0) || user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {user?.full_name || user?.username}
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl backdrop-blur-xl py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-800/80">
                    <p className="text-sm font-medium text-white">{user?.full_name || user?.username}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        user?.role === 'Admin' ? 'bg-indigo-900/60 text-indigo-300' :
                        user?.role === 'Analyst' ? 'bg-blue-900/60 text-blue-300' :
                        'bg-slate-800/60 text-slate-400'
                      }`}>
                        {user?.role}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/admin'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                  >
                    <Settings size={15} />
                    Settings
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
