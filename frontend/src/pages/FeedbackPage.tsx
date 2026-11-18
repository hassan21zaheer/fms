import { useEffect, useState } from 'react';
import {
  Search,
  Download,
  ArrowUpDown,
  Plus,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SummaryCard } from '../components/SummaryCard';
import { ScoreBadge } from '../components/ScoreBadge';
import { StatusPill, StatusValue } from '../components/StatusPill';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue, usePagedList } from '../hooks/usePagedList';
import {
  countFeedback,
  exportFeedback,
  fetchFeedbackPage,
  onDataChange,
  updateFeedbackStatus,
} from '../services/dataService';

export function FeedbackPage() {
  const {
    selectedBranch,
    setSelectedFeedbackId,
    openPublicForm,
    showToast,
    branches,
    scoringConfig,
    can,
    searchQuery,
    setSearchQuery,
  } = useApp();

  const branchName = (id: string) => branches.find((item) => item.id === id)?.name ?? '';
  const bands = scoringConfig.bands;

  const search = searchQuery;
  const setSearch = setSearchQuery;
  const [selectedScoreBand, setSelectedScoreBand] = useState<string | null>(null);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'score_high' | 'score_low'>('newest');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const pageSize = 12;

  /** The score range of each band, so the database can do the filtering and counting. */
  const bandRange = (band: string | null): { scoreMin?: number; scoreBelow?: number } => {
    if (band === 'excellent') return { scoreMin: bands.excellent.min };
    if (band === 'good') return { scoreMin: bands.good.min, scoreBelow: bands.excellent.min };
    if (band === 'needs_attention') return { scoreMin: bands.needs_attention.min, scoreBelow: bands.good.min };
    if (band === 'critical') return { scoreBelow: bands.needs_attention.min };
    return {};
  };

  const debouncedSearch = useDebouncedValue(search);

  const {
    items: pageItems,
    total,
    page: currentPage,
    setPage: setCurrentPage,
    lastPage: totalPages,
    loading,
  } = usePagedList(
    (page) =>
      fetchFeedbackPage({
        page,
        perPage: pageSize,
        branch: selectedBranch,
        flaggedOnly: filterFlaggedOnly,
        search: debouncedSearch,
        sort: sortBy,
        ...bandRange(selectedScoreBand),
      }),
    [selectedBranch, filterFlaggedOnly, selectedScoreBand, debouncedSearch, sortBy],
    { kinds: ['feedback', 'cases'] },
  );

  // The four summary cards count the whole branch in the database, whatever page is showing.
  const [summaryCounts, setSummaryCounts] = useState({ exc: 0, gd: 0, na: 0, crit: 0 });
  useEffect(() => {
    let cancelled = false;
    const loadCounts = () =>
      Promise.all(
        ['excellent', 'good', 'needs_attention', 'critical'].map((band) =>
          countFeedback({ branch: selectedBranch, ...bandRange(band) }),
        ),
      )
        .then(([exc, gd, na, crit]) => !cancelled && setSummaryCounts({ exc, gd, na, crit }))
        .catch(() => undefined);

    void loadCounts();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadCounts();
    }, 30000);
    const stopListening = onDataChange((kind) => {
      if (kind === 'feedback' || kind === 'scoring') void loadCounts();
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, bands.excellent.min, bands.good.min, bands.needs_attention.min]);

  const handleSelectAll = () => {
    if (selectedRows.size === pageItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pageItems.map((p) => p.id)));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  const handleStatusChange = async (id: string, newStatus: StatusValue) => {
    try {
      await updateFeedbackStatus(id, newStatus);
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      await exportFeedback(format, selectedBranch);
      showToast(`Exported the feedback table as ${format.toUpperCase()}`, 'success');
    } catch {
      showToast('Export failed. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Feedback Records
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Real-time multi-branch customer sentiment and inspection logs.
          </p>
        </div>
      </div>

      {/* ================= 4 COLORED SUMMARY CARDS (MATCHING REFERENCE!) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Excellent */}
        <SummaryCard
          label={bands.excellent.label}
          count={summaryCounts.exc}
          caption={`Score ${bands.excellent.min}-${bands.excellent.max}`}
          badgeBg="bg-[#3B82F6]/20"
          badgeText="text-[#3B82F6] dark:text-blue-300"
          active={selectedScoreBand === 'excellent'}
          onClick={() =>
            setSelectedScoreBand(selectedScoreBand === 'excellent' ? null : 'excellent')
          }
        />

        {/* Card 2: Good */}
        <SummaryCard
          label={bands.good.label}
          count={summaryCounts.gd}
          caption={`Score ${bands.good.min}-${bands.good.max}`}
          badgeBg="bg-[#F97316]/20"
          badgeText="text-[#F97316] dark:text-orange-300"
          active={selectedScoreBand === 'good'}
          onClick={() => setSelectedScoreBand(selectedScoreBand === 'good' ? null : 'good')}
        />

        {/* Card 3: Needs Attention */}
        <SummaryCard
          label={bands.needs_attention.label}
          count={summaryCounts.na}
          caption={`Score ${bands.needs_attention.min}-${bands.needs_attention.max}`}
          badgeBg="bg-[#EAB308]/20"
          badgeText="text-[#CA8A04] dark:text-yellow-300"
          active={selectedScoreBand === 'needs_attention'}
          onClick={() =>
            setSelectedScoreBand(
              selectedScoreBand === 'needs_attention' ? null : 'needs_attention'
            )
          }
        />

        {/* Card 4: Critical */}
        <SummaryCard
          label={bands.critical.label}
          count={summaryCounts.crit}
          caption={`Score ${bands.critical.min}-${bands.critical.max}`}
          badgeBg="bg-[#EF4444]/20"
          badgeText="text-[#DC2626] dark:text-red-300"
          active={selectedScoreBand === 'critical'}
          onClick={() =>
            setSelectedScoreBand(selectedScoreBand === 'critical' ? null : 'critical')
          }
        />
      </div>

      {/* ================= CONTROLS ROW: SEARCH, COUNT, EXPORT, SORT, ADD ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Records count */}
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search feedback..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full text-xs bg-white dark:bg-[#15151A] text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">
            {total} feedback records
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['csv', 'pdf'] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => void handleExport(format)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#15151A] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {format.toUpperCase()}</span>
            </button>
          ))}

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#15151A] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer focus:outline-hidden shadow-xs"
            >
              <option value="newest">Sort: default</option>
              <option value="score_high">Sort: highest score</option>
              <option value="score_low">Sort: lowest score</option>
            </select>
          </div>

          {/* Add Feedback button (opens customer QR form preview) */}
          {can('manage locations') && (
            <button
              type="button"
              onClick={() => openPublicForm()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-transform active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Test QR Feedback</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterFlaggedOnly(!filterFlaggedOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${
              filterFlaggedOnly
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-500 font-semibold'
                : 'bg-white dark:bg-[#15151A] border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Flagged only</span>
            {filterFlaggedOnly && <X className="w-3 h-3 ml-1" />}
          </button>

          {selectedScoreBand && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 font-semibold">
              <span>Band: {selectedScoreBand.replace('_', ' ')}</span>
              <button
                type="button"
                onClick={() => setSelectedScoreBand(null)}
                className="hover:opacity-75"
              >
                <X className="w-3 h-3 ml-0.5" />
              </button>
            </span>
          )}

          {(filterFlaggedOnly || selectedScoreBand || search) && (
            <button
              type="button"
              onClick={() => {
                setFilterFlaggedOnly(false);
                setSelectedScoreBand(null);
                setSearch('');
              }}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Pagination controls top */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 font-semibold">
          <span>
            {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= TABLE (MATCHING REFERENCE EXACTLY!) ================= */}
      <div className="rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-micro">
                <th className="py-4 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedRows.size > 0 && selectedRows.size === pageItems.length
                    }
                    onChange={handleSelectAll}
                    className="rounded-sm border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4">Feedback #</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Location</th>
                <th className="py-4 px-4">Score</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    {loading ? 'Loading feedback...' : 'No feedback records match your filters.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const isSelected = selectedRows.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedFeedbackId(item.id)}
                      className={`group hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectRow(item.id, e as any)}
                          className="rounded-sm border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Feedback Number */}
                      <td className="py-4 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{item.id}</span>
                          {item.flagged && (
                            <span
                              className="w-2 h-2 rounded-full bg-rose-500"
                              title={item.flagReasons.join(', ')}
                            />
                          )}
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="py-4 px-4 text-body">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.customerName}
                        </div>
                        <div className="text-body text-slate-400 dark:text-zinc-500 font-mono">
                          {item.customerPhone}
                        </div>
                      </td>

                      {/* Branch & Location */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200">
                          {item.locationName}
                        </div>
                        <div className="text-body text-slate-400 dark:text-zinc-500 capitalize">
                          {branchName(item.branchId)}
                        </div>
                      </td>

                      {/* Score Badge */}
                      <td className="py-4 px-4">
                        <ScoreBadge score={item.overallScore} showBand={true} size="sm" />
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-body text-slate-500 dark:text-zinc-400 tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      {/* Status Dropdown Pill */}
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <StatusPill
                          status={item.status}
                          disabled={!item.caseId}
                          onChange={(newSt) => handleStatusChange(item.id, newSt)}
                        />
                      </td>

                      {/* Row Menu */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedFeedbackId(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          title="View detail drawer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={currentPage}
        lastPage={totalPages}
        total={total}
        pageSize={pageSize}
        noun="feedback records"
        onChange={setCurrentPage}
      />
    </div>
  );
}
