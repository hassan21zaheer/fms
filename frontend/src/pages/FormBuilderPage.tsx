import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  Star,
  Smile,
  List,
  CheckSquare,
  ToggleLeft,
  Hash,
  Type,
  Smartphone,
  Save,
  Eye,
  Sliders,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emitChange } from '../services/dataService';
import {
  FormSummary,
  createForm,
  fetchForms,
  getActiveFormId,
  saveFormConfig,
  setActiveFormId,
} from '../services/configService';
import { Question, QuestionType, QuestionOption } from '../types';
import { CategoriesPanel } from '../components/formbuilder/CategoriesPanel';
import { LibraryPanel } from '../components/formbuilder/LibraryPanel';
import { LinksPanel } from '../components/formbuilder/LinksPanel';
import { OverridesPanel } from '../components/formbuilder/OverridesPanel';

export function FormBuilderPage() {
  const { formConfig, showToast, refresh, locations } = useApp();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [newFormName, setNewFormName] = useState('');
  const [creatingForm, setCreatingForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([...formConfig.questions]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    formConfig.questions[0]?.id || ''
  );
  const [welcomeTitle, setWelcomeTitle] = useState(formConfig.welcomeTitle);
  const [welcomeSubtitle, setWelcomeSubtitle] = useState(formConfig.welcomeSubtitle);
  const [thankYouTitle, setThankYouTitle] = useState(formConfig.thankYouTitle);
  const [thankYouSubtitle, setThankYouSubtitle] = useState(formConfig.thankYouSubtitle);
  const [customerFields, setCustomerFields] = useState({ ...formConfig.customerInfoFields });
  const [activeTab, setActiveTab] = useState<'questions' | 'categories' | 'library' | 'customer_fields' | 'branding' | 'links' | 'overrides'>('questions');

  useEffect(() => {
    setQuestions([...formConfig.questions]);
    setSelectedQuestionId(formConfig.questions[0]?.id || '');
    setWelcomeTitle(formConfig.welcomeTitle);
    setWelcomeSubtitle(formConfig.welcomeSubtitle);
    setThankYouTitle(formConfig.thankYouTitle);
    setThankYouSubtitle(formConfig.thankYouSubtitle);
    setCustomerFields({ ...formConfig.customerInfoFields });
  }, [formConfig]);

  useEffect(() => {
    fetchForms()
      .then(setForms)
      .catch(() => setForms([]));
  }, [formConfig, locations]);

  const handlePickForm = async (id: string) => {
    setActiveFormId(id);
    await refresh('form');
  };

  const handleCreateForm = async () => {
    const name = newFormName.trim();
    if (!name) return;
    setCreatingForm(true);
    try {
      const id = await createForm(name);
      setActiveFormId(id);
      setNewFormName('');
      await refresh('form');
      showToast(`Form "${name}" created`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the form', 'error');
    } finally {
      setCreatingForm(false);
    }
  };

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) || questions[0];

  const handleUpdateSelected = (updates: Partial<Question>) => {
    if (!selectedQuestion) return;
    setQuestions((prev) =>
      prev.map((q) => (q.id === selectedQuestion.id ? { ...q, ...updates } : q))
    );
  };

  const handleAddQuestion = () => {
    const newId = `q-${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      categoryId: formConfig.categories[0]?.id || '',
      text: 'New Question Title',
      type: 'star',
      required: true,
      critical: false,
      weight: 3,
      active: true,
    };
    setQuestions((prev) => [...prev, newQuestion]);
    setSelectedQuestionId(newId);
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) {
      showToast('At least one question is required', 'warning');
      return;
    }
    const remaining = questions.filter((q) => q.id !== id);
    setQuestions(remaining);
    setSelectedQuestionId(remaining[0]?.id || '');
  };

  const draft = {
    questions,
    welcomeTitle,
    welcomeSubtitle,
    thankYouTitle,
    thankYouSubtitle,
    customerInfoFields: customerFields,
  };

  const isDirty =
    JSON.stringify(questions) !== JSON.stringify(formConfig.questions) ||
    welcomeTitle !== formConfig.welcomeTitle ||
    welcomeSubtitle !== formConfig.welcomeSubtitle ||
    thankYouTitle !== formConfig.thankYouTitle ||
    thankYouSubtitle !== formConfig.thankYouSubtitle ||
    JSON.stringify(customerFields) !== JSON.stringify(formConfig.customerInfoFields);

  /** Panels that change the form save any pending edits first, so a refresh never throws them away. */
  const ensureSaved = async () => {
    if (isDirty) await saveFormConfig(formConfig, draft);
  };

  const moveQuestion = (id: string, direction: -1 | 1) => {
    setQuestions((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await saveFormConfig(formConfig, draft);
      emitChange('form');
      showToast('Form saved. Guests will see the new version.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save form structure', 'error');
    } finally {
      setSaving(false);
    }
  };

  const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; icon: any }> = {
    star: { label: 'Star Rating (1-5)', icon: Star },
    smiley: { label: 'Smiley Scale', icon: Smile },
    single: { label: 'Single Choice', icon: List },
    multiple: { label: 'Multiple Choice', icon: CheckSquare },
    yesno: { label: 'Yes / No', icon: ToggleLeft },
    scale10: { label: '0-10 NPS Scale', icon: Hash },
    text: { label: 'Free Text Comment', icon: Type },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Form Builder & Guest Experience
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Design dynamic survey questions, scoring weights, and customer entry fields.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="disabled:opacity-60 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-md transition-transform active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Form picker: the organization can have several forms */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Editing form</span>
          <select
            value={getActiveFormId() ?? ''}
            onChange={(e) => void handlePickForm(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer"
          >
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name} ({form.questionsCount} questions, {form.locationsCount} locations)
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newFormName}
            onChange={(e) => setNewFormName(e.target.value)}
            placeholder="New form name"
            className="px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <button
            type="button"
            onClick={() => void handleCreateForm()}
            disabled={creatingForm || !newFormName.trim()}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white disabled:opacity-50"
          >
            Add form
          </button>
        </div>
      </div>

      {/* Main Builder Grid: Left Editor & Right Live Phone Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Questions List & Editor */}
        <div className="xl:col-span-8 space-y-6">
          {/* Sub tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-[#15151A] border border-slate-200 dark:border-white/10 w-fit max-w-full overflow-x-auto">
            {(
              [
                ['questions', `Survey Questions (${questions.length})`],
                ['categories', `Categories (${formConfig.categories.length})`],
                ['library', 'Library & Templates'],
                ['customer_fields', 'Customer Info Fields'],
                ['branding', 'Welcome & Thank You'],
                ['links', 'Links & Locations'],
                ['overrides', 'Branch Overrides'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === id
                    ? 'bg-white dark:bg-white/15 text-indigo-500 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'categories' && <CategoriesPanel ensureSaved={ensureSaved} />}
          {activeTab === 'library' && <LibraryPanel ensureSaved={ensureSaved} onStartedNewForm={() => setActiveTab('questions')} />}
          {activeTab === 'links' && <LinksPanel />}
          {activeTab === 'overrides' && <OverridesPanel />}

          {activeTab === 'questions' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Question list (md: 5 cols) */}
              <div className="md:col-span-5 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Questions
                  </span>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {questions.map((q, idx) => {
                    const isSelected = q.id === selectedQuestionId;
                    const cat = formConfig.categories.find((c) => c.id === q.categoryId);
                    const TypeIcon = QUESTION_TYPE_LABELS[q.type]?.icon || Star;

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestionId(q.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-xs'
                            : 'bg-white dark:bg-[#15151A] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <GripVertical className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {idx + 1}. {q.text}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">
                              <span className="font-semibold text-indigo-500">{cat?.name}</span>
                              <span>·</span>
                              <span className="capitalize">{q.type}</span>
                              {q.critical && (
                                <span className="text-rose-500 font-bold">· Critical</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQuestion(q.id, -1);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === questions.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQuestion(q.id, 1);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <TypeIcon className="w-4 h-4 text-slate-400 ml-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Question Editor (md: 7 cols) */}
              {selectedQuestion && (
                <div className="md:col-span-7 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Edit Question
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(selectedQuestion.id)}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Question Text */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Question Label
                    </label>
                    <input
                      type="text"
                      value={selectedQuestion.text}
                      onChange={(e) => handleUpdateSelected({ text: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Category & Type in grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Category
                      </label>
                      <select
                        value={selectedQuestion.categoryId}
                        onChange={(e) => handleUpdateSelected({ categoryId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white cursor-pointer"
                      >
                        {formConfig.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.weight}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Input Type
                      </label>
                      <select
                        value={selectedQuestion.type}
                        onChange={(e) => {
                          const newType = e.target.value as QuestionType;
                          let opts = selectedQuestion.options;
                          if ((newType === 'single' || newType === 'multiple') && (!opts || opts.length === 0)) {
                            opts = [
                              { id: 'opt-1', label: 'Excellent', score: 100 },
                              { id: 'opt-2', label: 'Good', score: 75 },
                              { id: 'opt-3', label: 'Average', score: 50 },
                              { id: 'opt-4', label: 'Poor', score: 25 },
                              { id: 'opt-5', label: 'Bad', score: 0 },
                            ];
                          }
                          handleUpdateSelected({ type: newType, options: opts });
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white cursor-pointer"
                      >
                        {Object.entries(QUESTION_TYPE_LABELS).map(([val, item]) => (
                          <option key={val} value={val}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Options editor for choice types */}
                  {(selectedQuestion.type === 'single' || selectedQuestion.type === 'multiple') && selectedQuestion.options && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Options & Score Weights
                      </label>
                      <div className="space-y-1.5">
                        {selectedQuestion.options.map((opt, i) => (
                          <div key={opt.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const newOpts = [...(selectedQuestion.options || [])];
                                newOpts[i] = { ...newOpts[i], label: e.target.value };
                                handleUpdateSelected({ options: newOpts });
                              }}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">Score:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={opt.score}
                                onChange={(e) => {
                                  const newOpts = [...(selectedQuestion.options || [])];
                                  newOpts[i] = { ...newOpts[i], score: parseInt(e.target.value) || 0 };
                                  handleUpdateSelected({ options: newOpts });
                                }}
                                className="w-16 px-2 py-1.5 text-center rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSelected({
                                  options: (selectedQuestion.options || []).filter((_, index) => index !== i),
                                })
                              }
                              className="text-rose-500 hover:text-rose-600"
                              title="Remove option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSelected({
                            options: [
                              ...(selectedQuestion.options || []),
                              { id: `opt-${Date.now()}`, label: 'New option', score: 50 },
                            ],
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add option</span>
                      </button>
                    </div>
                  )}

                  {/* Toggles: Required, Critical, Active, Weight */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/10 grid grid-cols-2 gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQuestion.required}
                        onChange={(e) => handleUpdateSelected({ required: e.target.checked })}
                        className="rounded-sm border-slate-300 text-indigo-600"
                      />
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        Required field
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQuestion.critical}
                        onChange={(e) => handleUpdateSelected({ critical: e.target.checked })}
                        className="rounded-sm border-slate-300 text-rose-500"
                      />
                      <span className="font-semibold text-rose-500">
                        Critical question (auto-flags if low)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQuestion.active}
                        onChange={(e) => handleUpdateSelected({ active: e.target.checked })}
                        className="rounded-sm border-slate-300 text-indigo-600"
                      />
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        Active in customer form
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        Weight (1-5):
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={selectedQuestion.weight}
                        onChange={(e) =>
                          handleUpdateSelected({ weight: parseInt(e.target.value) || 1 })
                        }
                        className="w-14 px-2 py-1 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center font-mono text-xs"
                      />
                    </div>
                  </div>

                  {selectedQuestion.type !== 'text' && (
                    <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedQuestion.followUp)}
                          onChange={(e) => handleUpdateSelected({ followUp: e.target.checked })}
                          className="rounded-sm border-slate-300 text-indigo-600"
                        />
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">
                          Ask the guest to explain a low score
                        </span>
                      </label>
                      {selectedQuestion.followUp && (
                        <div className="flex items-center gap-2 pl-6">
                          <span className="text-slate-500 dark:text-zinc-400">When the score is below</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={selectedQuestion.lowScoreThreshold ?? 40}
                            onChange={(e) => handleUpdateSelected({ lowScoreThreshold: Math.min(100, Math.max(1, parseInt(e.target.value) || 40)) })}
                            className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center font-mono"
                          />
                          <span className="text-slate-500 dark:text-zinc-400">out of 100, a comment box appears and is required.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'customer_fields' && (
            <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Guest Identification Fields
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Configure which guest contact fields appear before the feedback questions.
              </p>

              <div className="space-y-3 pt-2">
                {(['name', 'phone', 'email'] as const).map((field) => (
                  <div
                    key={field}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      Guest {field}
                    </span>
                    <select
                      value={customerFields[field]}
                      onChange={(e) =>
                        setCustomerFields((prev) => ({
                          ...prev,
                          [field]: e.target.value as any,
                        }))
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 cursor-pointer"
                    >
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Welcome & Thank You Messages
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Welcome Title
                  </label>
                  <input
                    type="text"
                    value={welcomeTitle}
                    onChange={(e) => setWelcomeTitle(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Welcome Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={welcomeSubtitle}
                    onChange={(e) => setWelcomeSubtitle(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Thank You Title
                  </label>
                  <input
                    type="text"
                    value={thankYouTitle}
                    onChange={(e) => setThankYouTitle(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Thank You Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={thankYouSubtitle}
                    onChange={(e) => setThankYouSubtitle(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Live Phone Preview Frame */}
        <div className="xl:col-span-4 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <span>Live Guest Mobile Preview</span>
          </div>

          {/* Phone Shell */}
          <div className="w-[310px] h-[640px] rounded-[44px] bg-black p-3.5 shadow-2xl border-4 border-slate-700 dark:border-zinc-800 flex flex-col relative overflow-hidden">
            {/* Dynamic Island Notch */}
            <div className="w-24 h-4 bg-zinc-900 rounded-full mx-auto mb-3 shrink-0" />

            {/* Phone Screen Canvas */}
            <div className="flex-1 bg-white rounded-[32px] overflow-y-auto p-4 text-zinc-900 flex flex-col justify-between shadow-inner">
              <div className="space-y-4">
                {/* Brand Header */}
                <div className="text-center pt-2">
                  <div
                    className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center text-white font-extrabold text-sm shadow-md"
                    style={{ backgroundColor: formConfig.brandColor }}
                  >
                    {formConfig.orgLogoText}
                  </div>
                  <h4 className="mt-2 text-sm font-extrabold tracking-tight">
                    {welcomeTitle}
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                    {welcomeSubtitle}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: '35%',
                      backgroundColor: formConfig.brandColor,
                    }}
                  />
                </div>

                {/* Sample active question */}
                {selectedQuestion && (
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                      Question Preview
                    </span>
                    <p className="text-xs font-bold text-zinc-900">
                      {selectedQuestion.text}
                    </p>

                    {selectedQuestion.type === 'star' && (
                      <div className="flex items-center gap-1 text-amber-400 pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="w-5 h-5 fill-amber-400" />
                        ))}
                      </div>
                    )}

                    {selectedQuestion.type === 'smiley' && (
                      <div className="flex items-center justify-around text-xl pt-1">
                        <span>😡</span>
                        <span>🙁</span>
                        <span>😐</span>
                        <span>😊</span>
                        <span>😍</span>
                      </div>
                    )}

                    {selectedQuestion.type === 'yesno' && (
                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="p-2 rounded-xl border border-zinc-300 text-center font-bold">
                          Yes
                        </div>
                        <div className="p-2 rounded-xl border border-zinc-300 text-center font-bold">
                          No
                        </div>
                      </div>
                    )}

                    {(selectedQuestion.type === 'single' || selectedQuestion.type === 'multiple') && (
                      <div className="space-y-1 pt-1 text-xs">
                        {selectedQuestion.options?.slice(0, 3).map((o) => (
                          <div
                            key={o.id}
                            className="p-1.5 rounded-lg border border-zinc-200 bg-white font-medium text-[11px]"
                          >
                            {o.label}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedQuestion.type === 'scale10' && (
                      <div className="grid grid-cols-11 gap-0.5 text-[9px] font-bold text-center pt-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <div key={n} className="py-1 rounded-sm bg-zinc-200">
                            {n}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedQuestion.type === 'text' && (
                      <div className="h-14 rounded-xl border border-zinc-200 bg-white p-2 text-[10px] text-zinc-400">
                        Type comments here...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button preview */}
              <button
                type="button"
                className="w-full py-2.5 rounded-full text-xs font-bold text-white shadow-md mt-4 transition-transform"
                style={{ backgroundColor: formConfig.brandColor }}
              >
                Continue / Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
