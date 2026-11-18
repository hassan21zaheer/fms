import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { changePassword } from '../services/dataService';

const inputClass =
  'w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useApp();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (next.length < 8) {
      setError('The new password needs at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('Choose a password different from the current one.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      showToast('Password changed. Your other devices were signed out.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Change my password</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="font-bold text-slate-700 dark:text-zinc-300">Current password</label>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="font-bold text-slate-700 dark:text-zinc-300">New password (min 8 characters)</label>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="font-bold text-slate-700 dark:text-zinc-300">Repeat new password</label>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>

        <button type="button" onClick={() => setShow((value) => !value)} className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{show ? 'Hide passwords' : 'Show passwords'}</span>
        </button>

        {error && <p className="font-semibold text-rose-500">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-full font-semibold text-slate-500">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
            {busy ? 'Saving...' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}
