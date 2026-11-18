import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  ArrowUpRight,
  Check,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { fetchFeedbackPage } from '../services/dataService';
import type { FeedbackRecord } from '../types';
import { StatCard } from '../components/StatCard';
import { ScoreBadge } from '../components/ScoreBadge';
import { WaveDecoration } from '../components/WaveDecoration';

const CATEGORY_COLORS = ['#F59E0B', '#3B82F6', '#EAB308', '#F43F5E', '#10B981', '#8B5CF6', '#14B8A6'];

interface Kpi {
  value: number | null;
  previous: number | null;
  change_percent: number | null;
}

interface Overview {
  kpis: {
    responses: Kpi;
    average_score: Kpi;
    flagged: Kpi & { rate_percent: number | null };
    response_rate_percent: number | null;
    previous_response_rate_percent: number | null;
  };
  trend: Array<{ day: string; responses: number }>;
}

interface BranchComparison {
  id: number;
  name: string;
  responses_count: number;
  average_score: number;
}

const PERIOD_DAYS = { month: 30, quarter: 90, year: 365 } as const;

function delta(kpi?: Kpi, higherIsBetter = true) {
  if (!kpi || kpi.change_percent === null || kpi.change_percent === undefined) return undefined;
  const up = kpi.change_percent >= 0;
  return {
    value: `${Math.abs(kpi.change_percent)}%`,
    isPositive: higherIsBetter ? up : !up,
  };
}

export function DashboardPage() {
  const {
    feedback,
    cases,
    locations,
    selectedBranch,
    setSelectedFeedbackId,
    setActivePage,
    user,
    branches,
    can,
    activeOrganizationId,
  } = useApp();

  const [timeframe, setTimeframe] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categoryRows, setCategoryRows] = useState<Array<{ category: string; average_score: number }>>([]);
  const [branchRows, setBranchRows] = useState<BranchComparison[]>([]);
  const [caseStats, setCaseStats] = useState<{ open: number; unassigned: number; waiting: number } | null>(null);
  const [latestFlagged, setLatestFlagged] = useState<FeedbackRecord[]>([]);

  const canSeeReports = can('view reports');

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      const to = new Date();
      const from = new Date(Date.now() - ((timeframe === 'custom' ? 30 : PERIOD_DAYS[timeframe]) - 1) * 86400000);
      const iso = (date: Date) => date.toISOString().slice(0, 10);
      const query = {
        from: timeframe === 'custom' && customRange ? customRange.from : iso(from),
        to: timeframe === 'custom' && customRange ? customRange.to : iso(to),
        ...(selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
      };

      if (canSeeReports) {
        api('/reports/overview', { query })
          .then((res) => !cancelled && setOverview(res))
          .catch(() => !cancelled && setOverview(null));
        api('/reports/categories', { query })
          .then((res) => !cancelled && setCategoryRows(res.categories || []))
          .catch(() => !cancelled && setCategoryRows([]));
      }

      api('/dashboard', { query: selectedBranch !== 'all' ? { branch_id: selectedBranch } : {} })
        .then((res) => {
          if (cancelled) return;
          setBranchRows(res.branch_comparison || []);
          const stats = res.stats || {};
          setCaseStats({
            open: Number(stats.open_cases ?? 0),
            unassigned: Number(stats.unassigned_cases ?? 0),
            waiting: Number(stats.waiting_customers ?? 0),
          });
        })
        .catch(() => !cancelled && setBranchRows([]));

      fetchFeedbackPage({ page: 1, perPage: 5, flaggedOnly: true, branch: selectedBranch })
        .then((res) => !cancelled && setLatestFlagged(res.items))
        .catch(() => !cancelled && setLatestFlagged([]));
    };

    load();
    // The totals, chart and branch comparison stay current without anyone reloading the page.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [timeframe, customRange, selectedBranch, canSeeReports, activeOrganizationId]);

  const filteredFeedback = feedback;
  const filteredCases = cases;

  const totalResponses = overview?.kpis.responses.value ?? filteredFeedback.length;
  const overallScoreAvg =
    overview?.kpis.average_score.value != null
      ? String(overview.kpis.average_score.value)
      : (filteredFeedback.reduce((acc, f) => acc + f.overallScore, 0) / (filteredFeedback.length || 1)).toFixed(0);
  const flaggedCount = overview?.kpis.flagged.value ?? filteredFeedback.filter((f) => f.flagged).length;
  const openCasesCount = caseStats?.open ?? filteredCases.filter((c) => c.status !== 'resolved').length;
  const unassignedCasesCount =
    caseStats?.unassigned ?? filteredCases.filter((c) => c.status !== 'resolved' && !c.assigneeId).length;
  const waitingCustomersCount =
    caseStats?.waiting ??
    new Set(
      filteredCases
        .filter((c) => c.status !== 'resolved')
        .map((c) => c.customerPhone || c.customerEmail || c.customerName),
    ).size;

  const responseRate = overview?.kpis.response_rate_percent ?? null;
  const previousRate = overview?.kpis.previous_response_rate_percent ?? null;
  const rateDelta =
    responseRate !== null && previousRate !== null
      ? { value: `${Math.abs(Math.round((responseRate - previousRate) * 10) / 10)} pts`, isPositive: responseRate >= previousRate }
      : undefined;

  const barChartData = (overview?.trend || []).map((point) => ({
    name: new Date(`${point.day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    responses: point.responses,
  }));

  const donutData = categoryRows.map((row, index) => ({
    name: row.category,
    value: row.average_score,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));

  const branchScores = branchRows.map((b) => ({
    id: String(b.id),
    name: b.name,
    avgScore: Math.round(b.average_score),
    total: b.responses_count,
  }));

  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const periodLabel =
    timeframe === 'month' ? 'this month' : timeframe === 'quarter' ? 'this quarter' : timeframe === 'year' ? 'this year' : 'in the chosen dates';
  const comparedLabel =
    timeframe === 'month'
      ? 'This month vs last'
      : timeframe === 'quarter'
      ? 'This quarter vs last'
      : timeframe === 'year'
      ? 'This year vs last'
      : 'Chosen dates vs the period before';

  const applyCustomRange = () => {
    if (!draftFrom || !draftTo) return;
    const [from, to] = draftFrom <= draftTo ? [draftFrom, draftTo] : [draftTo, draftFrom];
    setCustomRange({ from, to });
    setTimeframe('custom');
    setPickerOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header: Greeting & Timeframe selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Hello, {firstName}! <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            This is what's happening across your{' '}
            {selectedBranch === 'all'
              ? `${branches.length || 'your'} ${branches.length === 1 ? 'branch' : 'branches'}`
              : `${branches.find((item) => item.id === selectedBranch)?.name ?? 'selected'} branch`}{' '}
            {periodLabel}.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Timeframe segmented control */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xs">
            {(
              [
                { id: 'month', label: 'Month' },
                { id: 'quarter', label: 'Quarter' },
                { id: 'year', label: 'Year' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTimeframe(option.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  timeframe === option.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Calendar icon button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-xs transition-colors ${
                timeframe === 'custom'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-[#15151A] border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Pick date range"
            >
              <Calendar className="w-4 h-4" />
            </button>
            {pickerOpen && (
              <div className="absolute right-0 mt-2 w-64 p-4 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xl z-40 space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">From</label>
                  <input
                    type="date"
                    value={draftFrom}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">To</label>
                  <input
                    type="date"
                    value={draftTo}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={!draftFrom || !draftTo}
                  onClick={applyCustomRange}
                  className="w-full py-2 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-40"
                >
                  Apply dates
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= ROW 1: 2x2 KPI CARDS (LEFT) & RESPONSES BAR CHART (RIGHT) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 2x2 KPI Grid */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Highlighted Card 1: Overall Score */}
          <StatCard
            title="Overall score"
            value={overallScoreAvg}
            subValue="/ 100"
            delta={delta(overview?.kpis.average_score)}
            caption={comparedLabel}
            isHighlighted={true}
            onClickArrow={() => setActivePage('reports')}
          />

          {/* Card 2: Total responses */}
          <StatCard
            title="Total responses"
            value={totalResponses.toLocaleString()}
            delta={delta(overview?.kpis.responses)}
            caption={comparedLabel}
            onClickArrow={() => setActivePage('feedback')}
          />

          {/* Card 3: Flagged feedback */}
          <StatCard
            title="Flagged feedback"
            value={flaggedCount}
            delta={delta(overview?.kpis.flagged, false)}
            caption={comparedLabel}
            onClickArrow={() => setActivePage('feedback')}
          />

          {/* Card 4: Response rate */}
          <StatCard
            title="Response rate"
            value={responseRate === null ? '—' : Math.round(responseRate) + '%'}
            delta={rateDelta}
            caption="Responses vs QR scans"
            onClickArrow={() => setActivePage('reports')}
          />
        </div>

        {/* Right: Large Responses Bar Chart Card */}
        <div className="lg:col-span-6 flex flex-col justify-between p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Responses</h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">{comparedLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('reports')}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {/* Recharts Bar Chart */}
          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  stroke="#71717A"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#71717A"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-xl shadow-lg border border-white/10">
                          <span className="font-semibold">{payload[0].value} responses</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="responses"
                  fill="#4338F5"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ================= ROW 2: CONNECTED CARDS & DONUT CHART ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Two Connected Cards with arrow button between them */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
          {/* Card A: Open Cases */}
          <div
            onClick={() => setActivePage('cases')}
            className="group relative flex flex-col justify-between p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all overflow-hidden"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>

            <div className="mt-8">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {openCasesCount}
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-zinc-300">
                  cases
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                {unassignedCasesCount} cases are awaiting assignment.
              </p>
            </div>
          </div>

          {/* Floating Circle Arrow in-between the two cards (matching reference!) */}
          <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-[#202028] border border-slate-200 dark:border-white/15 shadow-md flex items-center justify-center text-slate-700 dark:text-zinc-200">
              <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>

          {/* Card B: Waiting Customers with wave decoration */}
          <div
            onClick={() => setActivePage('customers')}
            className="group relative flex flex-col justify-between p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all overflow-hidden"
          >
            {/* Background wave line-art */}
            <WaveDecoration className="absolute -bottom-6 -right-12 w-52 h-32 text-indigo-500/20" />

            <div className="relative z-10 w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white">
              <User className="w-4 h-4 stroke-[2]" />
            </div>

            <div className="relative z-10 mt-8">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {waitingCustomersCount}
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-zinc-300">
                  customers
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                {waitingCustomersCount} customers waiting for response.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Donut Chart "Score by Category" */}
        <div className="lg:col-span-5 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Score by Category
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">{comparedLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('reports')}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Donut Chart */}
            <div className="sm:col-span-6 h-44 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {overallScoreAvg}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
                  Avg
                </span>
              </div>
            </div>

            {/* Legend list matching reference colored dots */}
            <div className="sm:col-span-6 flex flex-col gap-2.5 text-xs">
              {donutData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-700 dark:text-zinc-300 truncate font-medium">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= ROW 3: BRANCH COMPARISON & LATEST FLAGGED FEEDBACK ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Branch Comparison Card */}
        <div className="lg:col-span-5 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Branch Comparison
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">Benchmark performance</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('branches')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {branchScores.map((b) => (
              <div key={b.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">{b.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {b.total} reviews
                    </span>
                    <ScoreBadge score={b.avgScore} size="sm" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-indigo-500"
                    style={{ width: `${b.avgScore}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Flagged Feedback List */}
        <div className="lg:col-span-7 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Latest Flagged Feedback
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Action items requiring immediate management review
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('feedback')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              All feedback <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {latestFlagged.map((f) => (
              <div
                key={f.id}
                onClick={() => setSelectedFeedbackId(f.id)}
                className="group flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <ScoreBadge score={f.overallScore} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {f.customerName}
                      </span>
                      <span className="text-body text-slate-400 dark:text-zinc-500">
                        · {f.locationName}
                      </span>
                    </div>
                    <p className="text-body text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      {f.comment || f.flagReasons[0] || 'Feedback flagged below threshold'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-xs font-semibold text-indigo-500 group-hover:translate-x-0.5 transition-transform">
                    View
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
