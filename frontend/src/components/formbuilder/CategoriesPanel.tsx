import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { emitChange } from '../../services/dataService';
import { createCategory, deleteCategory, updateCategory } from '../../services/configService';
import type { Category } from '../../types';

const COLORS = ['#4338F5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#14B8A6'];
const ICONS = ['Star', 'Bed', 'Sparkles', 'Utensils', 'Users', 'Wrench', 'Wifi', 'Car', 'Coffee', 'Heart'];

const fieldClass =
  'px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white';

interface Props {
  ensureSaved: () => Promise<void>;
}

export function CategoriesPanel({ ensureSaved }: Props) {
  const { formConfig, showToast } = useApp();

  const [edits, setEdits] = useState<Record<string, Category>>({});
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newIcon, setNewIcon] = useState(ICONS[0]);
  const [busy, setBusy] = useState(false);

  const current = (category: Category) => edits[category.id] ?? category;
  const isChanged = (category: Category) => {
    const edited = edits[category.id];
    return Boolean(edited) && (edited.name !== category.name || edited.color !== category.color || edited.icon !== category.icon);
  };

  const run = async (job: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await ensureSaved();
      await job();
      emitChange('form');
      showToast(success, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'That did not work. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    void run(async () => {
      await createCategory({ name: newName.trim(), color: newColor, icon: newIcon });
      setNewName('');
    }, 'Category added');
  };

  const handleSave = (category: Category) => {
    const edited = current(category);
    void run(async () => {
      await updateCategory(category.id, { name: edited.name.trim(), color: edited.color, icon: edited.icon });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[category.id];
        return next;
      });
    }, 'Category saved');
  };

  const handleDelete = (category: Category) => {
    const count = formConfig.questions.filter((question) => question.categoryId === category.id).length;
    const message =
      count > 0
        ? `Delete "${category.name}"? Its ${count} question${count === 1 ? '' : 's'} will stay on the form but lose their category.`
        : `Delete "${category.name}"?`;
    if (!window.confirm(message)) return;
    void run(() => deleteCategory(category.id), 'Category deleted');
  };

  return (
    <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Question Categories</h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Group questions into areas such as Room, Food or Staff. Their weights are set on the Scoring page.
        </p>
      </div>

      <div className="space-y-2">
        {formConfig.categories.length === 0 && <p className="text-xs text-slate-400">No categories yet. Add the first one below.</p>}
        {formConfig.categories.map((category) => {
          const edited = current(category);
          const count = formConfig.questions.filter((question) => question.categoryId === category.id).length;
          return (
            <div
              key={category.id}
              className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10"
            >
              <input
                type="color"
                value={edited.color}
                onChange={(e) => setEdits((prev) => ({ ...prev, [category.id]: { ...edited, color: e.target.value } }))}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                title="Category colour"
              />
              <input
                value={edited.name}
                onChange={(e) => setEdits((prev) => ({ ...prev, [category.id]: { ...edited, name: e.target.value } }))}
                className={`${fieldClass} flex-1 min-w-[140px] font-semibold`}
              />
              <select
                value={edited.icon}
                onChange={(e) => setEdits((prev) => ({ ...prev, [category.id]: { ...edited, icon: e.target.value } }))}
                className={fieldClass}
                title="Icon"
              >
                {[...new Set([edited.icon, ...ICONS])].map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400">
                {count} question{count === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                disabled={busy || !isChanged(category) || !edited.name.trim()}
                onClick={() => handleSave(category)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDelete(category)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-40"
                title="Delete category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-white/10 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300">Add a category</h4>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Room Comfort"
            className={`${fieldClass} flex-1 min-w-[160px]`}
          />
          <div className="flex items-center gap-1.5">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full ${newColor === color ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                style={{ backgroundColor: color }}
                aria-label={`Colour ${color}`}
              />
            ))}
          </div>
          <select value={newIcon} onChange={(e) => setNewIcon(e.target.value)} className={fieldClass}>
            {ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={handleAdd}
            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
