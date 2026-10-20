import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Edit,
  Save,
  X,
  Lock,
} from 'lucide-react';
import { listAllUsers, updateUserRoleAndModules } from '../../services/userService';
import { useAuth } from '../auth/AuthContext';
import { UserProfile, UserRole, ModuleKey, AccountStatus } from '../../types/user';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('USER');
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<AccountStatus>('PENDING');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { currentUser } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const allUsers = await listAllUsers(100);
      setUsers(allUsers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartEdit = (user: UserProfile) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedModules(user.allowedModules || []);
    setSelectedStatus(user.accountStatus || 'PENDING');
    setMessage(null);
  };

  const handleToggleModule = (mod: ModuleKey) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    setMessage(null);

    try {
      await updateUserRoleAndModules({
        targetUid: editingUser.uid,
        role: selectedRole,
        allowedModules: selectedModules,
        accountStatus: selectedStatus,
        adminUid: currentUser?.uid || 'ADMIN',
      });

      setMessage(`Updated permissions for ${editingUser.displayName || editingUser.email}.`);
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setMessage(`Failed to update user: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
            RBAC Access Controls
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            User & Role Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review accounts, approve or keep pending, and grant access to one or more workspaces.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Administrators are listed from the persisted user records, never hardcoded emails. */}
      <section className="rounded-[24px] border border-white bg-white/80 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Shield className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Authorized administrators</h2>
            <p className="text-xs text-slate-500">Loaded from the current user records</p>
          </div>
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{users.filter((u) => u.role === 'ADMIN').length}</span>
        </div>
        {users.filter((u) => u.role === 'ADMIN').length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {users.filter((u) => u.role === 'ADMIN').map((adminUser) => (
              <div key={adminUser.uid} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{(adminUser.displayName || adminUser.email || 'A').slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{adminUser.displayName || 'Administrator'}</p><p className="truncate text-xs text-slate-500">{adminUser.email}</p></div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Admin</span>
              </div>
            ))}
          </div>
        ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No administrator profiles are available yet. Bootstrap the first administrator using SUPABASE_ADMIN_BOOTSTRAP.md.</p>}
      </section>

      {/* Edit User Modal / Box */}
      {editingUser && (
        <div className="bg-white p-6 rounded-xl border-2 border-blue-500/40 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-950 uppercase tracking-wider">
                Editing Permissions for: {editingUser.displayName || editingUser.email}
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">UID: {editingUser.uid}</span>
            </div>
            <button
              onClick={() => setEditingUser(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Pledge review</h4>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${editingUser.pledgeAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {editingUser.pledgeAccepted ? 'Submitted' : 'Not submitted'}
              </span>
            </div>
            <p className="text-xs text-slate-600">Signature: <span className="font-semibold text-slate-900">{editingUser.pledgeSignature?.trim() || 'Not available'}</span></p>
            <p className="text-xs text-slate-600">Submitted at: <span className="font-medium text-slate-900">{editingUser.pledgeAcceptedAt ? new Date(editingUser.pledgeAcceptedAt).toLocaleString() : 'Not available'}</span></p>
            <p className="text-[11px] leading-5 text-slate-500">Use this information as a review aid. Approval status is controlled separately below; this panel does not change the submitted pledge.</p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assigned Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="USER">USER (Standard Member)</option>
                <option value="SEARCHER">SEARCHER (Searching Team)</option>
                <option value="CHECKER">CHECKER (Checking Team)</option>
                <option value="ADMIN">ADMIN (Full Administrative Control)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as AccountStatus)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="ACTIVE">ACTIVE (Approved)</option>
                <option value="DISABLED">DISABLED (Access Suspended)</option>
                <option value="PENDING">PENDING (Awaiting Approval)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Authorized Workspace Access
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(['searching', 'checking', 'reports', 'evidence', 'admin'] as ModuleKey[]).map((m) => (
                <label
                  key={m}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedModules.includes(m)
                      ? 'bg-blue-50 border-blue-300 text-blue-950 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(m)}
                    onChange={() => handleToggleModule(m)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="capitalize">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Permissions</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading user registry...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No registered users found in Supabase database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Gender Group</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Authorized Teams (all)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-950">
                      {u.displayName || 'User'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{u.email}</td>
                    <td className="py-3 px-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${u.genderGroup === 'female' || u.gender === 'female' ? 'bg-pink-50 text-pink-700' : u.genderGroup === 'male' || u.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{u.genderGroup || u.gender || 'Not set'}</span></td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          u.role === 'ADMIN'
                            ? 'bg-rose-50 text-rose-700' : u.role === 'TEAM_ADMIN'
                            ? 'bg-violet-50 text-violet-700'
                            : u.role === 'CHECKER'
                            ? 'bg-blue-50 text-blue-700'
                            : u.role === 'SEARCHER'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex min-w-[180px] flex-wrap gap-1">
                        {u.allowedModules?.filter(m => ['searching','checking','reports','evidence'].includes(m)).map((m) => (
                          <span
                            key={m}
                            className={`text-[10px] px-2 py-1 rounded-full font-semibold ${m === 'searching' ? 'bg-blue-50 text-blue-700' : m === 'checking' ? 'bg-violet-50 text-violet-700' : m === 'reports' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
                          >
                            {m}
                          </span>
                        ))}
                        {!(u.allowedModules ?? []).some(m => ['searching','checking','reports','evidence'].includes(m)) && <span className="text-[10px] text-amber-700">No team assigned</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold ${
                          u.accountStatus === 'ACTIVE'
                            ? 'text-blue-700'
                            : u.accountStatus === 'DISABLED'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {u.accountStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(u)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        title="Edit Role & Permissions"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
