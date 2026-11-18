import { useEffect, useState } from 'react';
import {
  UserPlus,
  Shield,
  Building,
  Mail,
  CheckCircle2,
  XCircle,
  Edit2,
  MoreHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserItem, UserRole } from '../types';
import {
  TeamOptions,
  createUser,
  fetchTeamOptions,
  resetUserPassword,
  revokeUserSessions,
  updateUser,
} from '../services/dataService';
import { mapRole } from '../api/mappers';

export function UsersPage() {
  const { users, showToast, currentRole, organizationName } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [options, setOptions] = useState<TeamOptions>({ branches: [], roles: [], branchLocked: false });
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    fetchTeamOptions()
      .then(setOptions)
      .catch(() => undefined);
  }, [users.length]);

  const roleNeedsBranch = role === 'branch_admin' || role === 'staff';
  const defaultBranch = options.branches[0] ? String(options.branches[0].id) : '';

  const handleOpenAdd = () => {
    setEditingUserId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    const firstRole = options.roles.find((item) => item.value === 'staff') ?? options.roles[0];
    setRole(firstRole ? mapRole(firstRole.value) : 'staff');
    setBranchId(defaultBranch);
    setShowModal(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '');
    setPassword('');
    setRole(user.role);
    setBranchId(user.branchId || defaultBranch);
    setShowModal(true);
  };

  const handleToggleStatus = async (user: UserItem) => {
    try {
      await updateUser(user.id, { active: !user.active });
      showToast(`User ${user.name} is now ${!user.active ? 'active' : 'suspended'}`, 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update user status', 'error');
    }
  };

  const handleSignOutEverywhere = async () => {
    if (!editingUserId) return;
    try {
      await revokeUserSessions(editingUserId);
      showToast('Signed this person out of every device', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not sign them out', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    if (roleNeedsBranch && !branchId) {
      showToast('Choose a branch for this role first.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (editingUserId) {
        await updateUser(editingUserId, {
          name,
          email,
          phone,
          role,
          branchId: roleNeedsBranch ? branchId : null,
        });
        if (password.trim()) {
          await resetUserPassword(editingUserId, password.trim());
        }
        showToast('User profile updated', 'success');
      } else {
        if (password.trim().length < 8) {
          showToast('Give the new member a password of at least 8 characters.', 'warning');
          setSaving(false);
          return;
        }
        await createUser({
          name,
          email,
          phone,
          password: password.trim(),
          role,
          branchId: roleNeedsBranch ? branchId : undefined,
        });
        showToast(`Added ${name} to ${organizationName || 'the team'}`, 'success');
      }
      setShowModal(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save user', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            User Accounts & Team Access
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Add staff members, branch admins and organization superadmins, and control who can sign in.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-sm transition-transform active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-micro">
                <th className="py-4 px-5">Member</th>
                <th className="py-4 px-4">Role</th>
                <th className="py-4 px-4">Assigned Branch</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Last Active</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  {/* Name and avatar */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-9 h-9 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-500 uppercase tracking-wide">
                      <Shield className="w-3 h-3" />
                      <span>{u.role.replace('_', ' ')}</span>
                    </span>
                  </td>

                  {/* Branch */}
                  <td className="py-4 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                    {u.branchName || (u.role === 'owner' ? 'Platform' : 'All branches')}
                  </td>

                  {/* Status Toggle */}
                  <td className="py-4 px-4">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(u)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        u.active
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-zinc-400 border-transparent'
                      }`}
                    >
                      {u.active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Inactive
                        </>
                      )}
                    </button>
                  </td>

                  {/* Last active */}
                  <td className="py-4 px-4 text-slate-400 dark:text-zinc-500">
                    {u.lastActive}
                  </td>

                  {/* Edit action */}
                  <td className="py-4 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                      title="Edit member"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingUserId ? 'Edit User Profile' : 'Add Team Member'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Phone (optional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">
                  {editingUserId ? 'Reset password (leave empty to keep)' : 'Password (min 8 characters)'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">System Role</label>
                  <select
                    value={role === 'branch_admin' ? 'admin' : role}
                    onChange={(e) => setRole(mapRole(e.target.value))}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    {options.roles.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {roleNeedsBranch && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-zinc-300">
                      Assigned Branch
                    </label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      disabled={options.branchLocked}
                      className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    >
                      {options.branches.map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name}
                          {currentRole === 'owner' && b.organization_name ? ` (${b.organization_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {editingUserId && (
                <button
                  type="button"
                  onClick={() => void handleSignOutEverywhere()}
                  className="text-[11px] font-semibold text-rose-500 hover:underline"
                >
                  Sign this person out of all devices
                </button>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="disabled:opacity-60 px-5 py-2 rounded-full font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {saving ? 'Saving...' : editingUserId ? 'Save Profile' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
