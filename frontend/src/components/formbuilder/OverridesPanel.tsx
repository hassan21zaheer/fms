import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QuestionOverride, fetchOverrides, removeOverride, saveOverride } from '../../services/configService';

const fieldClass =
  'px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white';

type Row = QuestionOverride;

const blank = (questionId: string): Row => ({ questionId, hidden: false, text: null, required: null, weight: null });

export function OverridesPanel() {
  const { formConfig, branches, showToast, user } = useApp();

  const [branchId, setBranchId] = useState('');
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const options = branches.length > 0 ? branches : user?.branch ? [{ id: user.branch.id, name: user.branch.name }] : [];

  useEffect(() => {
    if (!branchId && options[0]) setBranchId(options[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  const load = useCallback(() => {
    if (!branchId) return;
    setError('');
    fetchOverrides(branchId)
      .then((list) => {
        setRows(Object.fromEntries(list.map((row) => [row.questionId, row])));
        setSaved(new Set(list.map((row) => row.questionId)));
      })
      .catch((err) => {
        setRows({});
        setSaved(new Set());
        setError(err instanceof Error ? err.message : 'Could not load the overrides.');
      });
  }, [branchId]);

  useEffect(load, [load, formConfig.formId]);

  const update = (questionId: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? blank(questionId)), ...patch } }));

  const save = async (questionId: string) => {
    setBusyId(questionId);
    try {
      await saveOverride(branchId, rows[questionId] ?? blank(questionId));
      setSaved((prev) => new Set(prev).add(questionId));
      showToast('Branch change saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the change', 'error');
    } finally {
      setBusyId('');
    }
  };

  const reset = async (questionId: string) => {
    setBusyId(questionId);
    try {
      await removeOverride(branchId, questionId);
      setRows((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      showToast('Back to the main form for this branch', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reset', 'error');
    } finally {
      setBusyId('');
    }
  };

  const questions = formConfig.questions.filter((question) => /^\d+$/.test(question.id));

  return (
    <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Branch overrides</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Change a question for one branch only: hide it, reword it, or change how important it is. Other branches keep the main form.
          </p>
        </div>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldClass}>
          {options.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs font-semibold text-amber-600">{error}</p>}
      {!error && questions.length === 0 && <p className="text-xs text-slate-400">Save some questions on the form first.</p>}

      <div className="space-y-3">
        {questions.map((question) => {
          const row = rows[question.id] ?? blank(question.id);
          const hasOverride = saved.has(question.id);
          return (
            <div
              key={question.id}
              className={`p-4 rounded-2xl border space-y-3 text-xs ${
                hasOverride ? 'border-indigo-500/50 bg-indigo-50/40 dark:bg-indigo-950/10' : 'border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-slate-900 dark:text-white">{question.text}</p>
                {hasOverride && <span className="text-[10px] font-bold text-indigo-500 shrink-0">Changed for this branch</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-zinc-400">Wording for this branch</label>
                  <input
                    value={row.text ?? ''}
                    onChange={(e) => update(question.id, { text: e.target.value || null })}
                    placeholder="Same as main form"
                    className={`${fieldClass} w-full mt-1`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-zinc-400">Required?</label>
                    <select
                      value={row.required === null ? 'inherit' : row.required ? 'yes' : 'no'}
                      onChange={(e) => update(question.id, { required: e.target.value === 'inherit' ? null : e.target.value === 'yes' })}
                      className={`${fieldClass} w-full mt-1`}
                    >
                      <option value="inherit">Same as main</option>
                      <option value="yes">Required</option>
                      <option value="no">Optional</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-zinc-400">Weight (1-5)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={row.weight ?? ''}
                      onChange={(e) => update(question.id, { weight: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder={String(question.weight)}
                      className={`${fieldClass} w-full mt-1`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={row.hidden}
                    onChange={(e) => update(question.id, { hidden: e.target.checked })}
                    className="rounded-sm border-slate-300 text-rose-500"
                  />
                  <span>Hide this question at this branch</span>
                </label>
                <div className="flex items-center gap-2">
                  {hasOverride && (
                    <button
                      type="button"
                      disabled={busyId === question.id}
                      onClick={() => void reset(question.id)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === question.id}
                    onClick={() => void save(question.id)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white disabled:opacity-50"
                  >
                    Save for branch
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
