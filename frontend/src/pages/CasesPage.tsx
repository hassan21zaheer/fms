import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  User,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue, usePagedList } from '../hooks/usePagedList';
import { fetchCasesPage } from '../services/dataService';
import { CaseStatus } from '../types';

export function CasesPage() {
  const { selectedBranch, setSelectedCaseId, searchQuery, setSearchQuery } = useApp();

  const [activeTab, setActiveTab] = useState<CaseStatus>('open');
  const search = searchQuery;
  const setSearch = setSearchQuery;
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const pageSize = 15;
  const debouncedSearch = useDebouncedValue(search);

  const {
    items: filteredCases,
    total,
    counts: statusCounts,
    page,
    setPage,
    lastPage,
    loading,
  } = usePagedList(
    (pageNumber) =>
      fetchCasesPage({
        page: pageNumber,
        perPage: pageSize,
        branch: selectedBranch,
        status: activeTab,
        priority: priorityFilter,
        search: debouncedSearch,
      }),
    [selectedBranch, activeTab, priorityFilter, debouncedSearch],
    { kinds: ['cases', 'feedback'] },
  );

  // The tab numbers are counted by the database for the whole branch.
  const counts = {
    open: statusCounts?.open ?? 0,
    in_progress: statusCounts?.in_progress ?? 0,
    resolved: statusCounts?.resolved ?? 0,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Escalated Cases
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Auto-flagged feedback issues and priority guest friction tickets.
          </p>
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-[#15151A] border border-slate-200 dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('open')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'open'
              ? 'bg-white dark:bg-white/15 text-rose-500 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Open ({counts.open})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'in_progress'
              ? 'bg-white dark:bg-white/15 text-blue-500 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>In Progress ({counts.in_progress})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resolved')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'resolved'
              ? 'bg-white dark:bg-white/15 text-emerald-500 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Resolved ({counts.resolved})</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search cases, rooms, guests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full text-xs bg-white dark:bg-[#15151A] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold">Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#15151A] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/10 shadow-xs cursor-pointer focus:outline-hidden"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
      </div>

      {/* Cases List / Table */}
      <div className="rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-micro">
                <th className="py-4 px-5">Case #</th>
                <th className="py-4 px-4">Guest & Concern</th>
                <th className="py-4 px-4">Location</th>
                <th className="py-4 px-4">Priority</th>
                <th className="py-4 px-4">Score</th>
                <th className="py-4 px-4">Assignee</th>
                <th className="py-4 px-4">Created</th>
                <th className="py-4 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    {loading ? 'Loading cases...' : `No ${activeTab.replace('_', ' ')} cases match your current filters.`}
                  </td>
                </tr>
              ) : (
                filteredCases.map((item) => {
                  const priorityClass =
                    item.priority === 'urgent'
                      ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                      : item.priority === 'high'
                      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                      : 'bg-blue-500/15 text-blue-500 border-blue-500/30';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedCaseId(item.id)}
                      className="group hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      {/* Case ID */}
                      <td className="py-4 px-5 font-mono font-bold text-slate-900 dark:text-white">
                        {item.id}
                      </td>

                      {/* Title & Customer */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                          {item.customerName} · {item.customerPhone}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                        {item.locationName}
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${priorityClass}`}
                        >
                          {item.priority}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-4 px-4 text-body font-mono font-bold text-rose-500">
                        {item.score}/100
                      </td>

                      {/* Assignee */}
                      <td className="py-4 px-4 text-body">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.assigneeAvatar}
                            alt={item.assigneeName}
                            className="w-6 h-6 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-medium text-slate-700 dark:text-zinc-300">
                            {item.assigneeName}
                          </span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-4 px-4 text-body text-slate-400 dark:text-zinc-500 tabular-nums">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right text-body">
                        <button
                          type="button"
                          onClick={() => setSelectedCaseId(item.id)}
                          className="text-xs font-semibold text-indigo-500 group-hover:translate-x-0.5 transition-transform"
                        >
                          Manage
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

      <Pagination page={page} lastPage={lastPage} total={total} pageSize={pageSize} noun="cases" onChange={setPage} />
    </div>
  );
}
