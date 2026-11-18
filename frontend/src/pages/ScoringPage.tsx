import { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Save,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emitChange } from '../services/dataService';
import { ScorePreview, previewScore, saveScoringConfig } from '../services/configService';
import { ScoreBadge } from '../components/ScoreBadge';

export function ScoringPage() {
  const { scoringConfig, formConfig, showToast } = useApp();

  const [threshold, setThreshold] = useState(scoringConfig.flagThreshold);
  const [rules, setRules] = useState({ ...scoringConfig.rules });
  const [bands, setBands] = useState({ ...scoringConfig.bands });
  const [categories, setCategories] = useState([...formConfig.categories]);

  // The simulator sends sample answers to the server, which scores them with the saved rules.
  const [samples, setSamples] = useState<Record<string, number>>({});
  const [testCriticalFriction, setTestCriticalFriction] = useState(false);
  const [preview, setPreview] = useState<ScorePreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThreshold(scoringConfig.flagThreshold);
    setRules({ ...scoringConfig.rules });
    setBands({ ...scoringConfig.bands });
  }, [scoringConfig]);

  useEffect(() => {
    setCategories(formConfig.categories.map((category) => ({ ...category })));
  }, [formConfig]);

  useEffect(() => {
    if (formConfig.categories.length === 0) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      const targets: Record<string, number> = {};
      formConfig.categories.forEach((category) => {
        targets[category.id] = samples[category.id] ?? 75;
      });
      previewScore(targets, testCriticalFriction)
        .then((result) => {
          setPreview(result);
          setPreviewError('');
        })
        .catch(() => setPreviewError('The simulator could not reach the server.'));
    }, 350);
    return () => clearTimeout(timer);
  }, [samples, testCriticalFriction, formConfig, scoringConfig]);

  const simulatedScore = preview?.overall_score ?? 0;
  const simulatedFlagReasons = preview?.flag_reasons ?? [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScoringConfig(
        {
          ...scoringConfig,
          bands,
          flagThreshold: threshold,
          rules,
        },
        categories,
      );
      emitChange('scoring', 'form');
      showToast('Scoring rules and category weights saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save scoring configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Scoring Engine & Auto-Flag Rules
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Define guest sentiment thresholds, category weights, and automatic case escalation.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="disabled:opacity-60 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-md transition-transform active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Scoring Rules'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Bands, Thresholds, Rules, Category Weights */}
        <div className="lg:col-span-7 space-y-6">
          {/* Flag Threshold Slider */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Automatic Flag Threshold
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Feedback scoring below this threshold is immediately tagged and escalated as a Case.
                </p>
              </div>
              <span className="text-2xl font-black text-rose-500 tabular-nums">
                {threshold} / 100
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={30}
                max={85}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>30 (Strict)</span>
                <span>Default: 60</span>
                <span>85 (Sensitive)</span>
              </div>
            </div>
          </div>

          {/* Auto-flag Rules */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Automated Escalation Triggers
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.autoFlagOverallBelowThreshold}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, autoFlagOverallBelowThreshold: e.target.checked }))
                  }
                  className="mt-0.5 rounded-sm border-slate-300 text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Auto-flag when overall score is below threshold ({threshold})
                  </span>
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5">
                    Creates an open Case ticket assigned to branch duty manager.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.autoFlagCriticalQuestionBad}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, autoFlagCriticalQuestionBad: e.target.checked }))
                  }
                  className="mt-0.5 rounded-sm border-slate-300 text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Auto-flag any bad answer on Critical Questions
                  </span>
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5">
                    Triggers immediate alert if hygiene or amenity malfunctions are reported.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.autoFlagCategoryBelowScore}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, autoFlagCategoryBelowScore: e.target.checked }))
                  }
                  className="mt-0.5 rounded-sm border-slate-300 text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Auto-flag if single category falls below {rules.categoryThresholdScore}
                  </span>
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5">
                    Flags isolated department failures even if overall stay was decent.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Category Weights Editor */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Category Weights in Overall Score
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Total weight should sum to 100%. Currently:{' '}
                  <span className={totalWeight === 100 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                    {totalWeight}%
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {categories.map((cat, i) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-bold text-slate-900 dark:text-white">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={cat.weight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCategories((prev) => prev.map((item, index) => (index === i ? { ...item, weight: val } : item)));
                      }}
                      className="w-16 px-2.5 py-1 text-center rounded-lg bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 font-mono font-bold"
                    />
                    <span className="text-slate-400 font-semibold">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Simulator */}
        <div className="lg:col-span-5 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-5 sticky top-24">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Scoring Simulator
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Scored by the server
            </span>
          </div>

          {/* Computed Score Hero Banner */}
          <div
            className={`p-5 rounded-2xl border text-center transition-all ${
              simulatedFlagReasons.length > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            }`}
          >
            <div className="text-4xl font-extrabold tracking-tight tabular-nums">
              {simulatedScore}
              <span className="text-base font-normal opacity-70"> / 100</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <ScoreBadge score={simulatedScore} showBand={true} size="md" />
            </div>

            {simulatedFlagReasons.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-rose-500/20 text-xs text-rose-500 font-semibold text-left">
                <div className="flex items-center gap-1 mb-1 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Escalation Rule Triggered!</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                  {simulatedFlagReasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Standard healthy response. No case ticket required.
              </p>
            )}
          </div>

          {/* Interactive Sliders: one per category of the form */}
          <div className="space-y-4 text-xs">
            {formConfig.categories.map((category) => (
              <div key={category.id}>
                <div className="flex justify-between font-bold mb-1">
                  <span>{category.name}:</span>
                  <span className="font-mono">{samples[category.id] ?? 75}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={samples[category.id] ?? 75}
                  onChange={(e) => setSamples((prev) => ({ ...prev, [category.id]: parseInt(e.target.value) }))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            ))}

            <label className="flex items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={testCriticalFriction}
                onChange={(e) => setTestCriticalFriction(e.target.checked)}
                className="rounded-sm border-slate-300 text-rose-500"
              />
              <span className="font-bold text-rose-500">Simulate a failed critical question</span>
            </label>
            <p className="text-[11px] text-slate-400">
              The simulator uses the saved rules and the saved form. Press Save to apply your changes first.
            </p>
            {previewError && <p className="text-[11px] text-rose-500">{previewError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
