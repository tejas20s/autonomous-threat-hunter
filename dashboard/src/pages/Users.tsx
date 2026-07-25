import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, Building2, Search, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';

interface UserListItem {
  user_id: string;
  department: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.getUsers(),
      api.getDepartments(),
    ]).then(([u, d]) => {
      setUsers(u);
      setDepartments(d);
      // Fetch alert counts per user
      Promise.all(
        u.map((user) =>
          api
            .getAlerts({ user_id: user.user_id, limit: 1 })
            .then(() => api.getAlerts({ user_id: user.user_id, limit: 1000 }))
            .then((alerts) => ({ [user.user_id]: alerts.length }))
            .catch(() => ({ [user.user_id]: 0 }))
        )
      ).then((counts) => {
        setAlertCounts(Object.assign({}, ...counts));
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter((u) => {
    if (search && !u.user_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (departmentFilter && u.department !== departmentFilter) return false;
    return true;
  });

  // Group by department
  const grouped = filteredUsers.reduce<Record<string, UserListItem[]>>((acc, u) => {
    if (!acc[u.department]) acc[u.department] = [];
    acc[u.department].push(u);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <UsersIcon size={20} className="animate-spin mr-2" />
        Loading users...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold page-header">Users</h2>
          <p className="text-sm page-subtitle mt-1">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} monitored
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="input-field w-auto text-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Department groups */}
      {Object.entries(grouped).length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
          <UsersIcon size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No users found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dept, deptUsers]) => (
            <div key={dept}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-300">{dept}</h3>
                <span className="text-xs text-slate-500">({deptUsers.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {deptUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => navigate(`/users/${user.user_id}`)}
                    className="card-hover p-4 text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-900/40 text-indigo-300 text-sm font-bold">
                          {user.user_id.replace('user', '')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                            {user.user_id}
                          </p>
                          <p className="text-xs text-slate-500">{user.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {alertCounts[user.user_id] > 0 && (
                          <span className="flex items-center gap-1 text-xs text-orange-400">
                            <AlertTriangle size={12} />
                            {alertCounts[user.user_id]}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
