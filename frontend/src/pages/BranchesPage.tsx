import { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  QrCode,
  Download,
  Plus,
  ExternalLink,
  Lock,
  Sparkles,
  BedDouble,
  UtensilsCrossed,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BranchId, LocationItem, LocationType } from '../types';
import {
  addLocation,
  createBranch,
  deleteBranch,
  deleteLocation,
  updateBranch,
  updateLocation,
  downloadAllQr,
  downloadLocationQr,
  generateLocationQr,
  onDataChange,
} from '../services/dataService';
import { FormSummary, fetchForms } from '../services/configService';
import { toBackendLocationType } from '../api/mappers';
import { api } from '../api/client';

const qrSrc = (url: string | null) => {
  if (!url) return '';
  const index = url.indexOf('/storage/');
  return index >= 0 ? url.slice(index) : url;
};

export function BranchesPage() {
  const {
    branches,
    locations,
    openPublicForm,
    showToast,
    can,
    user,
    activeOrganizationId,
    branchLocked,
  } = useApp();

  const [activeBranchId, setActiveBranchId] = useState<BranchId>('');
  const [selectedQRLocation, setSelectedQRLocation] = useState<LocationItem | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [usage, setUsage] = useState<{ branches: { used: number; limit: number }; locations: { used: number; limit: number | null } } | null>(null);
  const [forms, setForms] = useState<FormSummary[]>([]);

  // New location modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<LocationType>('room');
  const [newLocFormId, setNewLocFormId] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit branch / edit location
  const [branchEditor, setBranchEditor] = useState<{ name: string; city: string; address: string; active: boolean } | null>(null);
  const [locationEditor, setLocationEditor] = useState<{ id: string; name: string; type: LocationType; formId: string; active: boolean } | null>(null);

  // New branch modal state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  useEffect(() => {
    if (!activeBranchId && branches[0]) setActiveBranchId(branches[0].id);
    if (activeBranchId && !branches.some((item) => item.id === activeBranchId) && branches[0]) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId]);

  const organizationId = user?.organization?.id ?? activeOrganizationId;

  const loadUsage = () => {
    if (!organizationId || !can('manage branches')) return;
    api(`/organizations/${organizationId}`, { global: true })
      .then((res) => setUsage(res.usage))
      .catch(() => setUsage(null));
  };

  useEffect(loadUsage, [organizationId, branches.length, locations.length]);

  useEffect(() => {
    if (!can('manage forms')) return undefined;
    const loadForms = () =>
      fetchForms()
        .then(setForms)
        .catch(() => setForms([]));
    void loadForms();
    return onDataChange((kind) => {
      if (kind === 'form') void loadForms();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];
  const branchLocations = locations.filter((l) => l.branchId === activeBranchId);

  const branchLimit = usage?.branches.limit ?? 0;
  const currentBranchesCount = usage?.branches.used ?? branches.length;
  const isAtLimit = branchLimit > 0 && currentBranchesCount >= branchLimit;
  const canAddBranch = can('manage branches') && !branchLocked;

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setSaving(true);
    try {
      const created = await createBranch({
        name: newBranchName.trim(),
        city: newBranchCity.trim() || undefined,
        address: newBranchAddress.trim() || undefined,
      });
      showToast(`Branch ${created.name} added`, 'success');
      setActiveBranchId(created.id);
      setShowBranchModal(false);
      setNewBranchName('');
      setNewBranchCity('');
      setNewBranchAddress('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add branch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !activeBranch) return;

    setSaving(true);
    try {
      await addLocation({
        branchId: activeBranch.id,
        name: newLocName.trim(),
        type: toBackendLocationType(newLocType),
        formId: newLocFormId || undefined,
      });
      showToast(`Added ${newLocName} to ${activeBranch.name}`, 'success');
      setShowAddModal(false);
      setNewLocName('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openBranchEditor = () => {
    if (!activeBranch) return;
    setBranchEditor({ name: activeBranch.name, city: activeBranch.city, address: activeBranch.address, active: activeBranch.active });
  };

  const handleBranchSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchEditor || !activeBranch || !branchEditor.name.trim()) return;
    setSaving(true);
    try {
      await updateBranch(activeBranch.id, {
        name: branchEditor.name.trim(),
        city: branchEditor.city.trim() || null,
        address: branchEditor.address.trim() || null,
        is_active: branchEditor.active,
      });
      showToast('Branch updated', 'success');
      setBranchEditor(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update the branch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBranchDelete = async () => {
    if (!activeBranch) return;
    const typed = window.prompt(
      `Deleting ${activeBranch.name} also removes its locations and QR codes, and cannot be undone.\n\nType the branch name to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim() !== activeBranch.name) {
      showToast('The name did not match, so nothing was deleted.', 'warning');
      return;
    }
    try {
      await deleteBranch(activeBranch.id);
      showToast(`${activeBranch.name} deleted`, 'info');
      setActiveBranchId('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete the branch', 'error');
    }
  };

  const handleLocationSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationEditor || !locationEditor.name.trim()) return;
    setSaving(true);
    try {
      await updateLocation(locationEditor.id, {
        name: locationEditor.name.trim(),
        type: toBackendLocationType(locationEditor.type),
        form_id: locationEditor.formId ? Number(locationEditor.formId) : null,
        is_active: locationEditor.active,
      });
      showToast('Location updated', 'success');
      setLocationEditor(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update the location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationDelete = async (loc: LocationItem) => {
    if (!window.confirm(`Delete ${loc.name}? Its printed QR code will stop working.`)) return;
    try {
      await deleteLocation(loc.id);
      showToast(`${loc.name} deleted`, 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete the location', 'error');
    }
  };

  const handleViewQR = async (loc: LocationItem) => {
    setSelectedQRLocation(loc);
    setQrImage(null);
    setQrLoading(true);
    try {
      const result = await generateLocationQr(loc.id);
      setQrImage(qrSrc(result.qrUrl));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not generate the QR code', 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const handleDownloadSingleQR = async (loc: LocationItem) => {
    try {
      await downloadLocationQr(loc.id, loc.slug || loc.name);
      showToast(`Downloaded QR code for ${loc.name}`, 'success');
    } catch {
      showToast('Download failed. Please try again.', 'error');
    }
  };

  const handleDownloadAllPDF = async () => {
    try {
      await downloadAllQr(activeBranch ? activeBranch.id : 'all');
      showToast('Printable QR sheet downloaded', 'success');
    } catch {
      showToast('Could not build the QR sheet. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Branches & Location QR Codes
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Generate and manage location-specific QR touchpoints for hotel rooms, tables, and counters.
          </p>
        </div>

        {canAddBranch && (
          <div className="relative group">
            <button
              type="button"
              disabled={isAtLimit}
              onClick={() => setShowBranchModal(true)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
                isAtLimit
                  ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-[#15151A] dark:bg-white text-white dark:text-zinc-950'
              }`}
            >
              {isAtLimit ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Branch</span>
              {branchLimit > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-300 dark:bg-white/20 text-slate-700 dark:text-zinc-300">
                  {currentBranchesCount}/{branchLimit}
                </span>
              )}
            </button>
            {isAtLimit && (
              <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-50 w-64 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] shadow-xl border border-white/10">
                <strong>Branch limit reached ({currentBranchesCount}/{branchLimit}):</strong> ask the platform owner to
                raise your plan to add more branches.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Branch Cards Switcher */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {branches.length === 0 && (
          <p className="text-xs text-slate-400 col-span-full">No branches yet. Add your first branch to start placing QR codes.</p>
        )}
        {branches.map((b) => {
          const isActive = b.id === activeBranchId;
          const locCount = locations.filter((l) => l.branchId === b.id).length;

          return (
            <div
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className={`p-5 rounded-[24px] border transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#15151A] border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : 'bg-white dark:bg-[#15151A] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                    {b.shortCode} Branch
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {b.name}
                    {!b.active && <span className="ml-2 text-[10px] font-bold text-slate-400">(inactive)</span>}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{b.city}</span>
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>{locations.filter((l) => l.branchId === b.id && l.type === 'room').length} Rooms</span>
                <span>{locations.filter((l) => l.branchId === b.id && l.type === 'table').length} Tables</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {locCount} QR Active
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Branch Locations Table & QR Generator */}
      {activeBranch && (
      <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {activeBranch.name} Locations & QR Placement
            </h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Each QR opens the live guest form for that location.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canAddBranch && (
              <>
                <button
                  type="button"
                  onClick={openBranchEditor}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit branch</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleBranchDelete()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void handleDownloadAllPDF()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download All QR (PDF)</span>
            </button>

            {can('manage locations') && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Location</span>
            </button>
            )}
          </div>
        </div>

        {/* Locations List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-micro">
                <th className="py-3 px-3">Location Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">QR Target URL</th>
                <th className="py-3 px-3 text-center">Scans</th>
                <th className="py-3 px-3">Last Scan</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {branchLocations.map((loc) => {
                const targetUrl = loc.publicUrl || '';
                return (
                  <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{loc.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {loc.slug}
                        {loc.formName ? ` · ${loc.formName}` : ' · no form connected'}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-3">
                      <span className="capitalize font-semibold text-slate-700 dark:text-zinc-300">
                        {loc.type}
                      </span>
                      {!loc.active && <span className="ml-2 text-[10px] font-bold text-slate-400">(inactive)</span>}
                    </td>

                    {/* Target URL */}
                    <td className="py-3.5 px-3 max-w-xs font-mono text-[11px] text-indigo-500 truncate">
                      {targetUrl}
                    </td>

                    {/* Scans */}
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {loc.qrScansCount}
                    </td>

                    {/* Last Scan */}
                    <td className="py-3.5 px-3 text-slate-400 tabular-nums">
                      {loc.lastScan}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleViewQR(loc)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 font-semibold text-[11px]"
                        >
                          View QR
                        </button>
                        {can('manage locations') && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setLocationEditor({ id: loc.id, name: loc.name, type: loc.type, formId: loc.formId || '', active: loc.active })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                              title="Edit location"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleLocationDelete(loc)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                              title="Delete location"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openPublicForm(loc.branchSlug, loc.slug)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] hover:bg-indigo-100 dark:hover:bg-indigo-950/50"
                          title="Test form directly"
                        >
                          Open Form
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Single QR Preview Modal */}
      {selectedQRLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {selectedQRLocation.name}
            </h3>
            <p className="text-xs text-slate-400">
              Scan with phone camera to open live guest feedback
            </p>

            <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto w-52 h-52 shadow-sm">
              {qrLoading && <span className="text-xs text-slate-400">Generating...</span>}
              {!qrLoading && qrImage && <img src={qrImage} alt={`QR code for ${selectedQRLocation.name}`} className="w-full h-full object-contain" />}
              {!qrLoading && !qrImage && <span className="text-xs text-slate-400">QR code unavailable</span>}
            </div>

            <p className="font-mono text-[11px] text-slate-500 break-all">
              {selectedQRLocation.publicUrl}
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleDownloadSingleQR(selectedQRLocation)}
                className="flex-1 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 transition-colors"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => setSelectedQRLocation(null)}
                className="py-2.5 px-4 rounded-full text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add New Location to {activeBranch.name}
            </h3>

            <form onSubmit={handleAddLocationSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">
                  Location Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 205 (Executive Balcony)"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">Type</label>
                  <select
                    value={newLocType}
                    onChange={(e) => setNewLocType(e.target.value as LocationType)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value="room">Room / Suite</option>
                    <option value="table">Dining Table</option>
                    <option value="counter">Front Desk / Counter</option>
                    <option value="facility">Other / Facility</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">Feedback form</label>
                  <select
                    value={newLocFormId}
                    onChange={(e) => setNewLocFormId(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value="">Connect later</option>
                    {forms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {form.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="disabled:opacity-60 px-5 py-2 rounded-full font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Add Location & QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add a branch</h3>
            <form onSubmit={handleAddBranchSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Branch name</label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">City</label>
                  <input
                    type="text"
                    value={newBranchCity}
                    onChange={(e) => setNewBranchCity(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">Address</label>
                  <input
                    type="text"
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="disabled:opacity-60 px-5 py-2 rounded-full font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Add branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {branchEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleBranchSave}
            className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit branch</h3>
            {(
              [
                ['name', 'Branch name'],
                ['city', 'City'],
                ['address', 'Address'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="font-bold text-slate-700 dark:text-zinc-300">{label}</label>
                <input
                  value={branchEditor[key]}
                  onChange={(e) => setBranchEditor({ ...branchEditor, [key]: e.target.value })}
                  required={key === 'name'}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>
            ))}
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={branchEditor.active}
                onChange={(e) => setBranchEditor({ ...branchEditor, active: e.target.checked })}
                className="rounded-sm border-slate-300 text-indigo-600"
              />
              <span>Branch is active (inactive branches stop taking guest feedback)</span>
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBranchEditor(null)}
                className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
                Save branch
              </button>
            </div>
          </form>
        </div>
      )}

      {locationEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleLocationSave}
            className="w-full max-w-md rounded-[28px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-3 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit location</h3>
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Name</label>
              <input
                value={locationEditor.name}
                onChange={(e) => setLocationEditor({ ...locationEditor, name: e.target.value })}
                required
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Type</label>
                <select
                  value={locationEditor.type}
                  onChange={(e) => setLocationEditor({ ...locationEditor, type: e.target.value as LocationType })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                >
                  <option value="room">Room / Suite</option>
                  <option value="table">Dining Table</option>
                  <option value="counter">Front Desk / Counter</option>
                  <option value="facility">Other / Facility</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Feedback form</label>
                <select
                  value={locationEditor.formId}
                  onChange={(e) => setLocationEditor({ ...locationEditor, formId: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                >
                  <option value="">None</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={locationEditor.active}
                onChange={(e) => setLocationEditor({ ...locationEditor, active: e.target.checked })}
                className="rounded-sm border-slate-300 text-indigo-600"
              />
              <span>Location is active (inactive QR codes show no form)</span>
            </label>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLocationEditor(null)}
                className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-60">
                Save location
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
