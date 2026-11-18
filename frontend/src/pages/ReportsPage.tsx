import { useState, useEffect } from 'react';
import {
  Download,
  Calendar,
  Filter,
  TrendingUp,
  AlertTriangle,
  QrCode,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { api, download } from '../api/client';
import { ScoreBadge } from '../components/ScoreBadge';

const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
];

export function ReportsPage() {
  const { locations, selectedBranch, showToast, activeOrganizationId } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'branches' | 'locations' | 'cases'>('overview');
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<any>({ categories: [], questions: [] });
  const [branchRows, setBranchRows] = useState<any[]>([]);
  const [locationRows, setLocationRows] = useState<any[]>([]);
  const [casesSummary, setCasesSummary] = useState<any>(null);

  const rangeQuery = () => {
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    return {
      from: iso(new Date(Date.now() - (days - 1) * 86400000)),
      to: iso(new Date()),
      ...(selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };
  };

  useEffect(() => {
    let cancelled = false;
    const query = rangeQuery();
    Promise.all([
      api('/reports/overview', { query }),
      api('/reports/categories', { query }),
      api('/reports/branches', { query }),
      api('/reports/locations', { query }),
      api('/reports/cases', { query }),
    ])
      .then(([overviewRes, categoriesRes, branchesRes, locationsRes, casesRes]) => {
        if (cancelled) return;
        setOverview(overviewRes);
        setCategoryData(categoriesRes);
        setBranchRows(branchesRes.branches || []);
        setLocationRows(locationsRes.locations || []);
        setCasesSummary(casesRes);
      })
      .catch(() => {
        if (!cancelled) showToast('Could not load the reports. Please try again.', 'error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, selectedBranch, activeOrganizationId]);

  const trendData = (overview?.trend || [])
    .filter((point: any) => point.average_score !== null)
    .map((point: any) => ({
      date: new Date(`${point.day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: point.average_score,
      count: point.responses,
    }));
  const scoreChange: number | null = overview?.kpis?.average_score?.change_percent ?? null;

  const categoryBarData = (categoryData.categories || []).map((row: any) => ({
    category: row.category,
    score: row.average_score,
  }));

  const worstQuestions: Array<{ question: string; category: string; score: number; answers: number }> = (
    categoryData.questions || []
  )
    .slice(0, 8)
    .map((row: any) => ({
    question: row.question,
    category: row.category,
    score: row.average_score,
    answers: row.answers,
  }));

  const topLocations = locationRows.slice(0, 12).map((row: any) => ({
    key: String(row.id),
    name: row.name,
    branch: row.branch_name,
    responses: row.responses,
    average: row.average_score,
    scans: locations.find((item) => item.id === String(row.id))?.qrScansCount ?? 0,
  }));

  const exportReport = async (format: 'csv' | 'pdf') => {
    try {
      await download(`/reports/export.${format}`, `report.${format}`, rangeQuery());
      showToast(`Report exported as ${format.toUpperCase()}`, 'success');
    } catch {
      showToast('Export failed. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Reports & Analytics
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Deep dive into customer satisfaction, QR engagement, and resolution velocity.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#15151A] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 cursor-pointer focus:outline-hidden shadow-xs"
          >
            {PERIODS.map((period) => (
              <option key={period.days} value={period.days}>
                {period.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void exportReport('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#15151A] text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void exportReport('pdf')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-sm transition-transform active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-[#15151A] border border-slate-200 dark:border-white/10 w-fit overflow-x-auto max-w-full">
        {(['overview', 'categories', 'branches', 'locations', 'cases'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-white dark:bg-white/15 text-indigo-500 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content depending on active tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Trend Chart Card */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Average Overall Score Trend
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  Daily satisfaction metrics for the selected period
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scoreChange !== null && (
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      scoreChange >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
                    }`}
                  >
                    {scoreChange >= 0 ? '+' : ''}
                    {scoreChange}% vs previous period
                  </span>
                )}
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333340" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#71717A" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl border border-white/10 shadow-xl">
                            <p className="font-bold">{payload[0].payload.date}</p>
                            <p className="text-indigo-400 font-mono mt-0.5">
                              Avg Score: {payload[0].value}/100
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {payload[0].payload.count} reviews recorded
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#4338F5"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#4338F5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Worst-performing questions Table */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Friction Points & Underperforming Questions
            </h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              The lowest scoring questions in the selected period.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-body border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/10 text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-micro">
                    <th className="py-3 px-3">Question</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Avg Score</th>
                    <th className="py-3 px-3">Answers</th>
                    <th className="py-3 px-3 text-right">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {worstQuestions.map((q, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white max-w-sm">
                        {q.question}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-zinc-400 font-medium">
                        {q.category}
                      </td>
                      <td className="py-3 px-3">
                        <ScoreBadge score={q.score} size="sm" />
                      </td>
                      <td className="py-3 px-3 font-mono text-rose-500 font-bold">
                        {q.answers} answers
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            q.score < 50
                              ? 'text-rose-500 bg-rose-500/10'
                              : q.score < 70
                              ? 'text-amber-500 bg-amber-500/10'
                              : 'text-emerald-500 bg-emerald-500/10'
                          }`}
                        >
                          {q.score < 50 ? 'Action required' : q.score < 70 ? 'Watch' : 'Healthy'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Category Performance
            </h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Average score of every category in the selected period.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333340" opacity={0.3} />
                <XAxis dataKey="category" stroke="#71717A" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#71717A" fontSize={11} tickLine={false} />
                <Tooltip />
                <Bar dataKey="score" fill="#4338F5" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'locations' && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            QR Code Scan & Feedback Engagement by Location
          </h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            Identifies which table/room QR placements generate the highest customer response rates.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {topLocations.map((loc) => (
              <div
                key={loc.key}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{loc.name}</h4>
                  <p className="text-[11px] text-slate-400">{loc.branch}</p>
                  <p className="text-[11px] text-slate-400">
                    {loc.responses} responses{loc.average !== null ? ` · avg ${loc.average}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-indigo-500 font-mono">{loc.scans}</div>
                  <div className="text-[10px] text-slate-400 font-medium">scans</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'branches' && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Branch Comparison Summary
          </h3>
          <div className="space-y-4 pt-2">
            {branchRows.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{b.name}</h4>
                  <p className="text-xs text-slate-400">{b.city}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <span className="text-xs text-slate-400">Responses:</span>
                    <p className="font-bold font-mono text-slate-900 dark:text-white">{b.responses}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-slate-400">Flagged:</span>
                    <p className="font-bold font-mono text-slate-900 dark:text-white">{b.flagged}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-slate-400">Open cases:</span>
                    <p className="font-bold font-mono text-slate-900 dark:text-white">{b.open_cases}</p>
                  </div>
                  {b.average_score !== null && <ScoreBadge score={b.average_score} showBand={true} size="md" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'cases' && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Case Resolution Time & Service Recovery
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
              <span className="text-xs text-indigo-400 font-semibold">Average Resolution Time</span>
              <p className="text-3xl font-black text-indigo-500 mt-1 font-mono">
                {casesSummary?.avg_resolution_hours != null ? `${casesSummary.avg_resolution_hours} hrs` : '—'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-xs text-emerald-400 font-semibold">Resolution Rate</span>
              <p className="text-3xl font-black text-emerald-500 mt-1 font-mono">
                {casesSummary?.resolution_rate_percent != null ? `${casesSummary.resolution_rate_percent}%` : '—'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="text-xs text-amber-400 font-semibold">Awaiting Follow-up</span>
              <p className="text-3xl font-black text-amber-500 mt-1 font-mono">{casesSummary?.unresolved_now ?? 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
