import React, { useEffect, useState } from 'react';
import { useAuthStore, useUserManagementStore } from '../store';
import { Users, Shield, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';

const ROLE_BADGES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  teacher: 'bg-blue-100 text-blue-700 border-blue-200',
  accountant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const { users, roles, fetchUsers, fetchRoles, updateRole, deleteUser } = useUserManagementStore();
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRole(userId, newRole);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
      setConfirmDelete(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-school-primary/20 border-t-school-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500 text-white rounded-xl flex items-center justify-center">
          <Users size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl text-school-primary">User Management</h2>
          <p className="text-xs text-school-muted">{users.length} registered accounts</p>
        </div>
      </div>

      {/* Role Legend */}
      <div className="bg-white rounded-2xl border border-school-border p-4">
        <h3 className="text-xs font-bold uppercase text-school-muted mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-purple-700">Admin</span>
            <p className="text-school-muted">Full access. Manages users & roles.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-blue-700">Teacher</span>
            <p className="text-school-muted">Students, results, classes. Read-only on finance.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-emerald-700">Accountant</span>
            <p className="text-school-muted">Finance & transactions. Read-only on students.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-gray-600">Viewer</span>
            <p className="text-school-muted">Read-only on all modules.</p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-school-border">
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-school-muted">User</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-school-muted">Role</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-school-muted">Verified</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-school-muted">Joined</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-school-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-school-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-school-primary text-sm">
                            {u.name}
                            {isSelf && <span className="text-[10px] text-school-muted ml-1">(you)</span>}
                          </div>
                          <div className="text-[11px] text-school-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${ROLE_BADGES[u.role] || ROLE_BADGES.viewer}`}>
                          {roles.find((r) => r.value === u.role)?.label || u.role}
                        </span>
                      ) : (
                        <div className="relative">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className={`appearance-none w-full bg-white border rounded-lg px-3 py-1.5 pr-8 text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-school-accent focus:border-transparent outline-none ${ROLE_BADGES[u.role] || ROLE_BADGES.viewer}`}
                          >
                            {roles.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.emailVerified ? (
                        <span className="text-green-600 text-xs font-semibold">Verified</span>
                      ) : (
                        <span className="text-amber-600 text-xs font-semibold">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-school-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSelf ? (
                        <span className="text-[10px] text-school-muted">—</span>
                      ) : confirmDelete === u.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[10px] text-rose-600 flex items-center gap-1">
                            <AlertTriangle size={12} /> Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-lg transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[10px] font-bold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
