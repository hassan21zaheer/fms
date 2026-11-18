import { useEffect, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { emitChange } from '../../services/dataService';
import {
  LibraryItem,
  TemplateInfo,
  addLibraryQuestions,
  applyTemplate,
  fetchLibrary,
  fetchTemplates,
  setActiveFormId,
} from '../../services/configService';

interface Props {
  ensureSaved: () => Promise<void>;
  onStartedNewForm: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  star: 'Stars',
  emoji: 'Smiley',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  yes_no: 'Yes / No',
  nps: '0-10 scale',
  text: 'Comment',
};

export function LibraryPanel({ ensureSaved, onStartedNewForm }: Props) {
  const { formConfig, showToast, refresh } = useApp();

  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [connectAll, setConnectAll] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchLibrary()
      .then(setLibrary)
      .catch(() => setLibrary([]));
    fetchTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const existing = useMemo(() => new Set(formConfig.questions.map((question) => question.text.trim().toLowerCase())), [formConfig.questions]);
  const groups = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    library.forEach((item) => map.set(item.group, [...(map.get(item.group) || []), item]));
    return [...map.entries()];
  }, [library]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const addSelected = async () => {
    const items = library.filter((item) => selected.includes(item.id));
    if (items.length === 0) return;
    setBusy(true);
    try {
      await ensureSaved();
      const count = await addLibraryQuestions(items, formConfig.categories);
      setSelected([]);
      emitChange('form');
      showToast(`${count} question${count === 1 ? '' : 's'} added to the form`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add the questions', 'error');
    } finally {
      setBusy(false);
    }
  };

  const startTemplate = async (template: TemplateInfo) => {
    if (!window.confirm(`Create a new form from the "${template.name}" template? Your current form stays as it is.`)) return;
    setBusy(true);
    try {
      await ensureSaved();
      const id = await applyTemplate(template.key, connectAll);
      setActiveFormId(id);
      await refresh('form');
      emitChange('locations');
      onStartedNewForm();
      showToast(`New form created from ${template.name}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the form', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Start a new form from a template</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Creates a separate form with ready-made categories and questions.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((template) => (
            <div key={template.key} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{template.name}</span>
                <span className="text-[10px] text-slate-400">{template.question_count} questions</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">{template.categories.join(' · ')}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startTemplate(template)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white disabled:opacity-50"
              >
                Use this template
              </button>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={connectAll} onChange={(e) => setConnectAll(e.target.checked)} className="rounded-sm border-slate-300 text-indigo-600" />
          <span>Also connect every location to the new form</span>
        </label>
      </div>

      <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Question library</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Tick questions to add them to the form you are editing.</p>
          </div>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void addSelected()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add {selected.length || ''} selected</span>
          </button>
        </div>

        {groups.map(([group, items]) => (
          <div key={group} className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{group}</h4>
            {items.map((item) => {
              const added = existing.has(item.text.trim().toLowerCase());
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border text-xs ${
                    added
                      ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/10'
                      : 'cursor-pointer bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/10 hover:border-indigo-500/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={added}
                    checked={selected.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5 rounded-sm border-slate-300 text-indigo-600"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{item.text}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {TYPE_LABELS[item.type] || item.type}
                      {item.category ? ` · ${item.category}` : ''}
                      {item.is_critical ? ' · critical' : ''}
                    </p>
                  </div>
                  {added && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                      <Check className="w-3 h-3" /> Added
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <p className="text-xs text-slate-400">The library is empty.</p>}
      </div>
    </div>
  );
}
