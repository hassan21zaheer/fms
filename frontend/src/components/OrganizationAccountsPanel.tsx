import { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Pencil, Wand2, X } from 'lucide-react';
import { api } from '../api/client';
import { mapUser } from '../api/mappers';
import { useApp } from '../context/AppContext';
import type { UserItem } from '../types';

interface Props {
  organization: { id: number; name: string };
  onClose: () => void;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join('');
}

const inputClass =
  'w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs';

type Mode = { kind: 'reset'; user: UserItem } | { kind: 'edit'; user: UserItem } | null;

export function OrganizationAccountsPanel({ organization, onClose }: Props) {
  const { showToast } = useApp();

  const [accounts, setAccounts] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);

  // Reset password
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState<{ name: string; password: string } | null>(null);

  // Edit account
  const [edit, setEdit] = useState({ name: '', email: '', phone: '' });

  const load = useCallback(async () => {
    try {
      const res = await api('/users', { global: true, query: { organization_id: organization.id } });
      const people = (res.data || []).map(mapUser) as UserItem[];
      setAccounts(people.filter((person) => person.role === 'superadmin' || person.role === 'branch_admin'));
    } catch {
      showToast('Could not load the accounts.', 'error');
    } finally {
      setLoading(false);
    }
  }, [organization.id, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReset = (user: UserItem) => {
    setMode({ kind: 'reset', user });
    setPassword('');
    setShowPassword(false);
    setDone(null);
  };

  const openEdit = (user: UserItem) => {
    setMode({ kind: 'edit', user });
    setEdit({ name: user.name, email: user.email, phone: user.phone || '' });
    setDone(null);
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode?.kind !== 'reset') return;
    if (password.length < 8) {
      showToast('The password needs at least 8 characters.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await api(`/users/${mode.user.id}/password`, { method: 'POST', global: true, body: { password } });
      setDone({ name: mode.user.name, password });
      setMode(null);
      setPassword('');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not reset the password', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode?.kind !== 'edit') return;
    setBusy(true);
    try {
      await api(`/users/${mode.user.id}`, {
        method: 'PATCH',
        global: true,
        body: { name: edit.name.trim(), email: edit.email.trim(), phone: edit.phone.trim() || null },
      });
      showToast('Account updated', 'success');
      setMode(null);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update the account', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user: UserItem) => {
    const next = !user.active;
    const question = next
      ? `Reactivate ${user.name}? They will be able to sign in again.`
      : `Deactivate ${user.name}? They will be signed out and cannot sign in until you reactivate them.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', global: true, body: { is_active: next } });
      showToast(next ? 'Account reactivated' : 'Account deactivated', 'info');
      setMode(null);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not change the account status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const signOutEverywhere = async (user: UserItem) => {
    setBusy(true);
    try {
      await api(`/users/${user.id}/sessions/revoke`, { method: 'POST', global: true });
      showToast(`${user.name} was signed out of every device`, 'success');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not sign them out', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied', 'success');
    } catch {
      showToast('Could not copy. Select it and copy by hand.', 'warning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Accounts of {organization.name}</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Superadmin and branch admin accounts. Reset a password or edit an account here.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
            <p className="font-bold text-emerald-600 dark:text-emerald-400">Password changed for {done.name}</p>
            <p className="text-slate-600 dark:text-zinc-300">
              They were signed out everywhere. Share the new password with them yourself; nothing was emailed, and it will not be shown again once you close this notice.
            </p>
            <div className="flex items-center gap-2">
              <code className="px-3 py-1.5 rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 font-mono text-sm">{done.password}</code>
              <button
                type="button"
                onClick={() => void copy(done.password)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold border border-slate-200 dark:border-white/10"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button type="button" onClick={() => setDone(null)} className="px-3 py-1.5 rounded-full font-semibold text-slate-500">
                Done
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-xs text-slate-400">Loading accounts...</p>}
        {!loading && accounts.length === 0 && <p className="text-xs text-slate-400">This organization has no superadmin or branch admin accounts.</p>}

        <div className="overflow-x-auto">
          {accounts.length > 0 && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 font-bold uppercase tracking-wider text-micro">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Last sign-in</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{account.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{account.email}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700 dark:text-zinc-300">
                      {account.role === 'superadmin' ? 'Superadmin' : 'Branch Admin'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{account.branchName || 'All branches'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          account.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                        }`}
                      >
                        {account.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{account.lastActive}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openReset(account)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]"
                        >
                          <KeyRound className="w-3 h-3" /> Reset password
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(account)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                          title="Edit account"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {mode?.kind === 'reset' && (
          <form onSubmit={handleReset} className="p-4 rounded-2xl border border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-950/10 space-y-3 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">New password for {mode.user.name}</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={`${inputClass} !mt-0 pr-10 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPassword(generatePassword());
                  setShowPassword(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300"
              >
                <Wand2 className="w-3.5 h-3.5" /> Generate
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Saving signs this person out of every device so the old password stops working at once.</p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setMode(null)} className="px-4 py-2 rounded-full font-semibold text-slate-500">
                Cancel
              </button>
              <button type="submit" disabled={busy || password.length < 8} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-50">
                Save new password
              </button>
            </div>
          </form>
        )}

        {mode?.kind === 'edit' && (
          <form onSubmit={handleEdit} className="p-4 rounded-2xl border border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-950/10 space-y-3 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">Edit {mode.user.name}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Full name</label>
                <input className={inputClass} required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Email</label>
                <input type="email" className={inputClass} required value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Phone</label>
                <input className={inputClass} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleActive(mode.user)}
                  className={`px-3.5 py-1.5 rounded-full font-semibold ${mode.user.active ? 'text-rose-500 hover:bg-rose-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'}`}
                >
                  {mode.user.active ? 'Deactivate account' : 'Reactivate account'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void signOutEverywhere(mode.user)}
                  className="px-3.5 py-1.5 rounded-full font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Sign out of all devices
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMode(null)} className="px-4 py-2 rounded-full font-semibold text-slate-500">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-50">
                  Save account
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
