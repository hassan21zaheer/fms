import { useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Search,
  MessageCircle,
  Mail,
  UserCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ScoreBadge } from '../components/ScoreBadge';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue, usePagedList } from '../hooks/usePagedList';
import {
  createCustomer,
  deleteCustomer,
  exportCustomers,
  fetchCustomerProfile,
  fetchCustomersPage,
  updateCustomer,
} from '../services/dataService';
import type { Customer } from '../types';

export function CustomersPage() {
  const { selectedBranch, setSelectedCustomerId, branches, can, showToast, currentRole, searchQuery, setSearchQuery } = useApp();

  const search = searchQuery;
  const setSearch = setSearchQuery;
  const pageSize = 15;
  const debouncedSearch = useDebouncedValue(search);
  const {
    items: filteredCustomers,
    total,
    page,
    setPage,
    lastPage,
    loading,
  } = usePagedList(
    (pageNumber) => fetchCustomersPage({ page: pageNumber, perPage: pageSize, branch: selectedBranch, search: debouncedSearch }),
    [selectedBranch, debouncedSearch],
    { kinds: ['customers', 'feedback'] },
  );
  const [editor, setEditor] = useState<{ id: string | null; name: string; phone: string; email: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = can('manage customers');
  const canDelete = currentRole === 'owner' || currentRole === 'superadmin';

  const openAdd = () => setEditor({ id: null, name: '', phone: '', email: '', notes: '' });

  const openEdit = async (customer: Customer) => {
    setEditor({ id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, notes: '' });
    try {
      const profile = await fetchCustomerProfile(customer.id);
      setEditor((prev) => (prev && prev.id === customer.id ? { ...prev, notes: profile.notes || '' } : prev));
    } catch {
      /* the notes box simply starts empty */
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    if (!editor.name.trim() && !editor.phone.trim() && !editor.email.trim()) {
      showToast('Enter a name, phone or email for the guest.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editor.name.trim() || undefined,
        phone: editor.phone.trim() || undefined,
        email: editor.email.trim() || undefined,
        notes: editor.notes.trim() || undefined,
      };
      if (editor.id) {
        await updateCustomer(editor.id, payload);
        showToast('Guest updated', 'success');
      } else {
        await createCustomer(payload);
        showToast('Guest added', 'success');
      }
      setEditor(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the guest', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!window.confirm(`Delete ${customer.name}? Their feedback stays, but is no longer linked to this guest.`)) return;
    try {
      await deleteCustomer(customer.id);
      showToast('Guest deleted', 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete the guest', 'error');
    }
  };

  const handleExport = async () => {
    try {
      await exportCustomers();
      showToast('Guest list exported', 'success');
    } catch {
      showToast('Export failed. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Guest Directory & Relationships
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Track guest satisfaction history, repeat visits, and direct contact channels.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search guest name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full text-xs bg-white dark:bg-[#15151A] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">{total} registered guests</span>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#15151A] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add guest</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-micro">
                <th className="py-4 px-5">Guest Name</th>
                <th className="py-4 px-4">Contact Info</th>
                <th className="py-4 px-4">Branch</th>
                <th className="py-4 px-4">Visits</th>
                <th className="py-4 px-4">Avg Score</th>
                <th className="py-4 px-4">Last Visit</th>
                <th className="py-4 px-4 text-right">Contact Guest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredCustomers.map((cust) => (
                <tr
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className="group hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  {/* Name with avatar */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 font-bold flex items-center justify-center shrink-0">
                        {cust.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{cust.name}</span>
                    </div>
                  </td>

{/* Phone & Email */}
                   <td className="py-4 px-4 text-body">
                     <div className="font-mono text-slate-800 dark:text-zinc-300 font-medium">
                       {cust.phone}
                     </div>
                     <div className="text-body text-slate-400 dark:text-zinc-500">{cust.email}</div>
                   </td>

                   {/* Branch */}
                   <td className="py-4 px-4 text-body font-semibold text-slate-700 dark:text-zinc-300 capitalize">
                     {branches.find((item) => item.id === cust.branchId)?.name ?? '—'}
                   </td>

                   {/* Feedback Count */}
                   <td className="py-4 px-4 text-body font-mono font-bold text-slate-900 dark:text-white">
                     {cust.feedbackCount}
                   </td>

                   {/* Avg Score */}
                   <td className="py-4 px-4 text-body">
                     <ScoreBadge score={cust.avgScore} size="sm" />
                   </td>

                   {/* Last visit */}
                   <td className="py-4 px-4 text-body text-slate-400 dark:text-zinc-500 tabular-nums">
                     {cust.lastVisit ? new Date(cust.lastVisit).toLocaleDateString() : '—'}
                   </td>

                  {/* Contact buttons */}
                  <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void openEdit(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                        title="Edit guest"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(cust)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                        title="Delete guest"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {can('contact customers') && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerId(cust.id)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerId(cust.id)}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    {loading ? 'Loading guests...' : 'No guests match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} lastPage={lastPage} total={total} pageSize={pageSize} noun="guests" onChange={setPage} />

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{editor.id ? 'Edit guest' : 'Add a guest'}</h3>
            {(
              [
                ['name', 'Full name', 'text'],
                ['phone', 'Phone', 'tel'],
                ['email', 'Email', 'email'],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key}>
                <label className="font-bold text-slate-700 dark:text-zinc-300">{label}</label>
                <input
                  type={type}
                  value={editor[key]}
                  onChange={(e) => setEditor({ ...editor, [key]: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>
            ))}
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Notes</label>
              <textarea
                rows={3}
                value={editor.notes}
                onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
                {saving ? 'Saving...' : 'Save guest'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
