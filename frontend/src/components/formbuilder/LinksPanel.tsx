import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { emitChange } from '../../services/dataService';
import { FormLinks, connectLocation, fetchFormLinks, setFormActive } from '../../services/configService';

export function LinksPanel() {
  const { formConfig, locations, branches, showToast, can } = useApp();

  const [info, setInfo] = useState<FormLinks>({ links: [], active: false, organizationWide: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchFormLinks()
      .then(setInfo)
      .catch(() => undefined);
  }, []);

  useEffect(load, [load, formConfig.formId]);

  const formId = formConfig.formId;
  const branchName = (id: string) => branches.find((branch) => branch.id === id)?.name ?? '';

  const toggleActive = async () => {
    setBusy(true);
    try {
      await setFormActive(!info.active);
      setInfo((prev) => ({ ...prev, active: !prev.active }));
      showToast(!info.active ? 'Form is live for guests' : 'Form is switched off for guests', 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not change the form status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleLocation = async (locationId: string, connected: boolean) => {
    setBusy(true);
    try {
      await connectLocation(locationId, connected ? null : formId ?? null);
      emitChange('locations');
      load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not change the connection', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied', 'success');
    } catch {
      showToast('Could not copy. Select the link and copy it by hand.', 'warning');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Form status</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {info.active ? 'Guests can open and submit this form.' : 'This form is switched off, so guests cannot open it.'}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleActive()}
          className={`px-4 py-2 rounded-full text-xs font-bold disabled:opacity-50 ${
            info.active ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-zinc-300'
          }`}
        >
          {info.active ? 'Live' : 'Switched off'}
        </button>
      </div>

      {can('manage locations') && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Connected locations</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Tick the places whose QR code should open this form. A location uses one form at a time.
            </p>
          </div>
          {locations.length === 0 && <p className="text-xs text-slate-400">No locations yet. Add them on the Branches page.</p>}
          {locations.map((location) => {
            const connected = location.formId === formId;
            return (
              <label
                key={location.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={connected}
                  disabled={busy}
                  onChange={() => void toggleLocation(location.id, connected)}
                  className="rounded-sm border-slate-300 text-indigo-600"
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 dark:text-white">{location.name}</span>
                  <span className="text-slate-400"> · {branchName(location.branchId)}</span>
                </div>
                {!connected && location.formName && <span className="text-[10px] text-slate-400">uses {location.formName}</span>}
              </label>
            );
          })}
        </div>
      )}

      <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Guest form links</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">The address each connected location opens.</p>
        </div>
        {info.links.length === 0 && <p className="text-xs text-slate-400">No locations are connected to this form yet.</p>}
        {info.links.map((link) => (
          <div
            key={link.locationId}
            className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 dark:text-white">{link.label}</p>
              <p className="font-mono text-[11px] text-indigo-500 truncate">{link.url}</p>
            </div>
            <button
              type="button"
              onClick={() => void copy(link.url)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              title="Copy link"
            >
              <Copy className="w-4 h-4" />
            </button>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" title="Open form">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
