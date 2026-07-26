import { useState, useEffect } from 'react';
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
  Shield,
  Sun,
  Moon,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    api.getSummary().then((s) => {
      setCriticalCount(s.severity_counts?.Critical || 0);
    }).catch(() => {});
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
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 backdrop-blur-xl transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <ShieldAlert size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>ThreatWatch</h1>
              <p className="text-[10px] tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>SOC Platform</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-5 px-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Main Menu</p>
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                  isActive
                    ? 'shadow-sm'
                    : 'border-transparent'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
                  color: isActive ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                  borderColor: isActive ? 'var(--nav-active-border)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--nav-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <item.icon size={18} style={{ color: isActive ? '#818cf8' : 'var(--text-muted)' }} />
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
                <p className="px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Administration</p>
              </div>
              {adminItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                      isActive
                        ? 'shadow-sm'
                        : 'border-transparent'
                    }`}
                    style={{
                      backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
                      color: isActive ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                      borderColor: isActive ? 'var(--nav-active-border)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'var(--nav-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <item.icon size={18} style={{ color: isActive ? '#818cf8' : 'var(--text-muted)' }} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>

        {/* User actions in sidebar */}
        <div className="absolute bottom-0 left-0 right-0" style={{ borderTop: '1px solid var(--sidebar-border)', backgroundColor: 'var(--sidebar-bg)' }}>
          {/* User info */}
          <div className="px-4 pt-3 pb-1.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate text-slate-200">{user?.full_name || user?.username}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Sidebar action buttons */}
          <div className="px-3 pb-2 space-y-0.5">
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <Settings size={14} className="text-slate-500" />
              Settings
            </button>
            <button
              onClick={() => setShowChangePwd(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={14} className="text-red-500/60" />
              Sign Out
            </button>
          </div>

          {/* System status */}
          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[10px] text-green-400 font-medium">System Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between px-4 lg:px-6 backdrop-blur-md"
          style={{
            backgroundColor: 'var(--topbar-bg)',
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="hidden sm:inline">SOC</span>
              <ChevronRight size={12} className="hidden sm:inline" />
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{findPageLabel()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="theme-toggle"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="live-indicator">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>

            {/* User avatar - simple, no dropdown */}
            <div className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ color: 'var(--text-primary)' }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white shadow-sm">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:inline text-sm max-w-[120px] truncate">
                {user?.full_name || user?.username}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!currentPwd || !newPwd) {
      setError('Please fill in all fields');
      return;
    }
    if (newPwd.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(currentPwd, newPwd);
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to change password');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white">
            {success ? 'Password Changed' : 'Change Password'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle size={40} className="text-green-400" />
              <p className="text-green-300 font-medium">Your password has been updated successfully!</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Current Password *</label>
                <input
                  type="password"
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password *</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Repeat new password"
                  className="input-field w-full"
                />
              </div>
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</div>
              )}
            </>
          )}
        </div>
        {!success && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm">
              {submitting ? (
                <span className="flex items-center gap-2"><Activity size={14} className="animate-spin" /> Updating...</span>
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
