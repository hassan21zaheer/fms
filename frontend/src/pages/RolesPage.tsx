import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Lock, Save, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

interface RoleInfo {
  name: string;
  label: string;
  locked: boolean;
  permissions: string[];
  defaults: string[];
  required: string[];
  assignable: string[];
  member_count: number;
}

interface CatalogItem {
  key: string;
  group: string;
  label: string;
  description: string;
}

const ROLE_BLURBS: Record<string, string> = {
  owner: 'Runs the platform: organizations, plans and what each role may do.',
  superadmin: 'The top account of an organization: its branches, team and settings.',
  admin: 'A branch admin: runs one branch, its forms, team and cases.',
  staff: 'Staff and managers: read feedback, work cases and contact guests.',
};

export function RolesPage() {
  const { showToast } = useApp();

  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [activeRole, setActiveRole] = useState('admin');
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const apply = (res: any) => {
    const loaded: RoleInfo[] = res.roles || [];
    setRoles(loaded);
    setCatalog(res.catalog || []);
    setCanEdit(Boolean(res.can_edit));
    setDraft(Object.fromEntries(loaded.map((role) => [role.name, [...role.permissions]])));
  };

  useEffect(() => {
    api('/team/roles')
      .then(apply)
      .catch(() => showToast('Could not load roles.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const role = roles.find((item) => item.name === activeRole) ?? roles[0];
  const selected = role ? draft[role.name] || [] : [];

  const groups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    catalog.forEach((item) => {
      map.set(item.group, [...(map.get(item.group) || []), item]);
    });
    return [...map.entries()];
  }, [catalog]);

  const changed = role ? JSON.stringify([...selected].sort()) !== JSON.stringify([...role.permissions].sort()) : false;

  const toggle = (key: string) => {
    if (!role || !canEdit || role.locked) return;
    if (role.required.includes(key) || !role.assignable.includes(key)) return;
    setDraft((prev) => {
      const current = prev[role.name] || [];
      return {
        ...prev,
        [role.name]: current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
      };
    });
  };

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const res = await api(`/team/roles/${role.name}/permissions`, {
        method: 'PUT',
        global: true,
        body: { permissions: selected },
      });
      apply(res);
      showToast(`${role.label} permissions saved`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const res = await api(`/team/roles/${role.name}/reset`, { method: 'POST', global: true });
      apply(res);
      showToast(`${role.label} is back to its default permissions`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not reset permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Roles & Access Permissions
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            {canEdit
              ? 'Choose what each role is allowed to do across every organization.'
              : 'What each role is allowed to do. Only the platform owner can change these.'}
          </p>
        </div>

        {canEdit && role && !role.locked && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to defaults</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !changed}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-md transition-transform active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Permissions'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {roles.map((item) => {
          const isSelected = role?.name === item.name;
          return (
            <div
              key={item.name}
              onClick={() => setActiveRole(item.name)}
              className={`p-5 rounded-[24px] border transition-all cursor-pointer bg-white dark:bg-[#15151A] ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                  {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
                </span>
                {item.locked ? <Lock className="w-4 h-4 text-slate-400" /> : <ShieldCheck className="w-4 h-4 text-indigo-500" />}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{item.label}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ROLE_BLURBS[item.name]}</p>
            </div>
          );
        })}
      </div>

      {role && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-5">
          <div className="pb-3 border-b border-slate-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Permissions for {role.label}</h3>
            <p className="text-xs text-slate-400">
              {role.locked
                ? 'The owner always has every permission.'
                : 'Permissions marked "always on" are needed to sign in and work, so they cannot be removed.'}
            </p>
          </div>

          {groups.map(([group, items]) => (
            <div key={group} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{group}</h4>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const checked = selected.includes(item.key);
                  const required = role.required.includes(item.key);
                  const unavailable = !role.assignable.includes(item.key);
                  const disabled = !canEdit || role.locked || required || unavailable;
                  return (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 ${
                        disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(item.key)}
                        className="mt-0.5 rounded-sm border-slate-300 text-indigo-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                          <span>{item.label}</span>
                          {required && !role.locked && (
                            <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                              always on
                            </span>
                          )}
                          {unavailable && (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/60 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                              not available to this role
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{item.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
