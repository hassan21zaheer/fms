import { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Pause, Play, LogIn, Pencil, Trash2, Users } from 'lucide-react';
import { OrganizationAccountsPanel } from '../components/OrganizationAccountsPanel';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

interface PlanRow {
  id: number;
  name: string;
  description: string | null;
  price_monthly: string | number;
  branch_limit: number;
  location_limit: number | null;
  is_active: boolean;
  organizations_count?: number;
}

interface OrganizationRow {
  id: number;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  branch_limit: number;
  plan_id: number | null;
  plan_expires_at: string | null;
  plan?: { id: number; name: string } | null;
  branches_count: number;
  locations_count: number;
  users_count: number;
  plan_status?: { expired: boolean; days_left: number | null };
}

const inputClass =
  'w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs';

export function OrganizationsPage() {
  const { showToast, setActiveOrganization, setActivePage, reloadOrganizations, activeOrganizationId } = useApp();

  const [tab, setTab] = useState<'organizations' | 'plans'>('organizations');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(false);

  // Create organization
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    plan_id: '',
    superadmin_name: '',
    superadmin_email: '',
    superadmin_password: '',
  });

  const [accountsFor, setAccountsFor] = useState<OrganizationRow | null>(null);

  // Edit organization plan
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const [editForm, setEditForm] = useState({ plan_id: '', branch_limit: 1, plan_expires_at: '' });

  // Plan editor
  const [planForm, setPlanForm] = useState<{ id: number | null; name: string; description: string; price_monthly: string; branch_limit: string; location_limit: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [orgs, planList] = await Promise.all([
        api('/organizations', { global: true }),
        api('/plans', { global: true }),
      ]);
      setOrganizations(orgs.data || []);
      setPlans(planList.data || []);
    } catch {
      showToast('Could not load organizations.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const afterChange = async () => {
    await load();
    await reloadOrganizations();
  };

  const createOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/organizations', {
        method: 'POST',
        global: true,
        body: {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          plan_id: form.plan_id ? Number(form.plan_id) : undefined,
          superadmin_name: form.superadmin_name.trim(),
          superadmin_email: form.superadmin_email.trim(),
          superadmin_password: form.superadmin_password,
        },
      });
      showToast(`${form.name} created. Its superadmin can sign in now.`, 'success');
      setShowCreate(false);
      setForm({ name: '', slug: '', plan_id: '', superadmin_name: '', superadmin_email: '', superadmin_password: '' });
      await afterChange();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the organization', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (organization: OrganizationRow) => {
    setBusy(true);
    try {
      await api(`/organizations/${organization.id}/${organization.status === 'active' ? 'suspend' : 'activate'}`, {
        method: 'POST',
        global: true,
      });
      showToast(`${organization.name} is now ${organization.status === 'active' ? 'suspended' : 'active'}`, 'info');
      await afterChange();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not change the status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (organization: OrganizationRow) => {
    setEditing(organization);
    setEditForm({
      plan_id: organization.plan_id ? String(organization.plan_id) : '',
      branch_limit: organization.branch_limit,
      plan_expires_at: organization.plan_expires_at ? organization.plan_expires_at.slice(0, 10) : '',
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/organizations/${editing.id}`, {
        method: 'PATCH',
        global: true,
        body: {
          plan_id: editForm.plan_id ? Number(editForm.plan_id) : null,
          branch_limit: Number(editForm.branch_limit),
          plan_expires_at: editForm.plan_expires_at || null,
        },
      });
      showToast('Plan updated', 'success');
      setEditing(null);
      await afterChange();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update the plan', 'error');
    } finally {
      setBusy(false);
    }
  };

  const enterWorkspace = (organization: OrganizationRow) => {
    setActiveOrganization(organization.id);
    setActivePage('dashboard');
    showToast(`Now working inside ${organization.name}`, 'info');
  };

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!planForm) return;
    setBusy(true);
    try {
      const body = {
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        price_monthly: Number(planForm.price_monthly) || 0,
        branch_limit: Number(planForm.branch_limit) || 1,
        location_limit: planForm.location_limit ? Number(planForm.location_limit) : null,
      };
      if (planForm.id) {
        await api(`/plans/${planForm.id}`, { method: 'PATCH', global: true, body });
      } else {
        await api('/plans', { method: 'POST', global: true, body });
      }
      showToast('Plan saved', 'success');
      setPlanForm(null);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the plan', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deletePlan = async (plan: PlanRow) => {
    if (!window.confirm(`Delete the ${plan.name} plan? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/plans/${plan.id}`, { method: 'DELETE', global: true });
      showToast('Plan deleted', 'info');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete the plan', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Organizations & Plans
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Create the businesses that use the system, set their plan, and step into any workspace.
          </p>
        </div>

        {tab === 'organizations' ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New organization</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPlanForm({ id: null, name: '', description: '', price_monthly: '', branch_limit: '3', location_limit: '' })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New plan</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-[#15151A] border border-slate-200 dark:border-white/10 w-fit">
        {(['organizations', 'plans'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
              tab === item ? 'bg-white dark:bg-white/15 text-indigo-500 shadow-xs' : 'text-slate-600 dark:text-zinc-400'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'organizations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {organizations.length === 0 && <p className="text-xs text-slate-400">No organizations yet.</p>}
          {organizations.map((organization) => {
            const expired = organization.plan_status?.expired;
            const days = organization.plan_status?.days_left;
            return (
              <div
                key={organization.id}
                className={`p-5 rounded-[24px] bg-white dark:bg-[#15151A] border space-y-4 ${
                  activeOrganizationId === organization.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{organization.name}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">/f/{organization.slug}/…</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      organization.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                    }`}
                  >
                    {organization.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    { label: 'Plan', value: organization.plan?.name ?? 'None' },
                    { label: 'Branches', value: `${organization.branches_count}/${organization.branch_limit}` },
                    { label: 'Locations', value: organization.locations_count },
                    { label: 'People', value: organization.users_count },
                  ].map((cell) => (
                    <div key={cell.label} className="p-2 rounded-xl bg-slate-50 dark:bg-white/5">
                      <div className="font-bold text-slate-900 dark:text-white">{cell.value}</div>
                      <div className="text-[10px] text-slate-400">{cell.label}</div>
                    </div>
                  ))}
                </div>

                <p className={`text-[11px] font-semibold ${expired ? 'text-rose-500' : 'text-slate-400'}`}>
                  {expired
                    ? 'Plan expired: new branches, locations, forms and team members are blocked.'
                    : days !== null && days !== undefined
                    ? `Plan renews in ${days} day${days === 1 ? '' : 's'}`
                    : 'No expiry date set'}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => enterWorkspace(organization)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Open workspace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(organization)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Plan & limits</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountsFor(organization)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Accounts</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleStatus(organization)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    {organization.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{organization.status === 'active' ? 'Suspend' : 'Activate'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'plans' && (
        <div className="rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 font-bold uppercase tracking-wider text-micro">
                  <th className="py-4 px-5">Plan</th>
                  <th className="py-4 px-4">Price / month</th>
                  <th className="py-4 px-4">Branches</th>
                  <th className="py-4 px-4">Locations</th>
                  <th className="py-4 px-4">Organizations</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 dark:text-white">{plan.name}</div>
                      <div className="text-[11px] text-slate-400">{plan.description}</div>
                    </td>
                    <td className="py-4 px-4 font-mono">{Number(plan.price_monthly).toLocaleString()}</td>
                    <td className="py-4 px-4 font-mono">{plan.branch_limit}</td>
                    <td className="py-4 px-4 font-mono">{plan.location_limit ?? 'Unlimited'}</td>
                    <td className="py-4 px-4 font-mono">{plan.organizations_count ?? 0}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPlanForm({
                              id: plan.id,
                              name: plan.name,
                              description: plan.description || '',
                              price_monthly: String(plan.price_monthly),
                              branch_limit: String(plan.branch_limit),
                              location_limit: plan.location_limit ? String(plan.location_limit) : '',
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePlan(plan)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {accountsFor && <OrganizationAccountsPanel organization={accountsFor} onClose={() => setAccountsFor(null)} />}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={createOrganization}
            className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">New organization</h3>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Organization name</label>
              <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Link name (used in guest form links)</label>
              <input
                className={inputClass}
                placeholder="demo-hotel"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Plan</label>
              <select className={inputClass} value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
                <option value="">Starter (default)</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-3">
              <p className="font-bold text-slate-900 dark:text-white">Superadmin account for this organization</p>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Full name</label>
                <input
                  className={inputClass}
                  required
                  value={form.superadmin_name}
                  onChange={(e) => setForm({ ...form, superadmin_name: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  required
                  value={form.superadmin_email}
                  onChange={(e) => setForm({ ...form, superadmin_email: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Password (min 8 characters)</label>
                <input
                  type="password"
                  className={inputClass}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.superadmin_password}
                  onChange={(e) => setForm({ ...form, superadmin_password: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
                Create organization
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Plan & limits for {editing.name}</h3>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Plan</label>
              <select className={inputClass} value={editForm.plan_id} onChange={(e) => setEditForm({ ...editForm, plan_id: e.target.value })}>
                <option value="">No plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Branch limit</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={editForm.branch_limit}
                onChange={(e) => setEditForm({ ...editForm, branch_limit: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Plan expires on</label>
              <input
                type="date"
                className={inputClass}
                value={editForm.plan_expires_at}
                onChange={(e) => setEditForm({ ...editForm, plan_expires_at: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {planForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={savePlan}
            className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{planForm.id ? 'Edit plan' : 'New plan'}</h3>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Name</label>
              <input className={inputClass} required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Description</label>
              <input className={inputClass} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Price / month</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={planForm.price_monthly}
                  onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Branches</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={planForm.branch_limit}
                  onChange={(e) => setPlanForm({ ...planForm, branch_limit: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Locations</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  className={inputClass}
                  value={planForm.location_limit}
                  onChange={(e) => setPlanForm({ ...planForm, location_limit: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPlanForm(null)}
                className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
                Save plan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
