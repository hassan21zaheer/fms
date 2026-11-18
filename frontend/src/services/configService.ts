import { api } from '../api/client';
import type { Category, FormConfig, Question, QuestionType, RolePermissions, ScoringConfig, SettingsConfig } from '../types';

export const emptyFormConfig: FormConfig = {
  orgName: '',
  orgLogoText: '',
  brandColor: '#4338F5',
  welcomeTitle: '',
  welcomeSubtitle: '',
  thankYouTitle: '',
  thankYouSubtitle: '',
  customerInfoFields: { name: 'optional', phone: 'optional', email: 'optional' },
  categories: [],
  questions: [],
};

const emptyBand = (label: string, min: number, max: number, color: string, desc: string) => ({ min, max, label, color, desc });

export const emptyScoringConfig: ScoringConfig = {
  bands: {
    excellent: emptyBand('Excellent', 80, 100, '#10B981', 'Guests are delighted.'),
    good: emptyBand('Good', 60, 79, '#0EA5E9', 'Solid experience with small gaps.'),
    needs_attention: emptyBand('Needs Attention', 40, 59, '#F59E0B', 'A visit that deserves a follow-up.'),
    critical: emptyBand('Critical', 0, 39, '#F43F5E', 'Act on this right away.'),
  },
  flagThreshold: 60,
  rules: {
    autoFlagOverallBelowThreshold: true,
    autoFlagCriticalQuestionBad: true,
    autoFlagCategoryBelowScore: true,
    categoryThresholdScore: 50,
  },
};

export const emptySettings: SettingsConfig = {
  company: { name: '', tagline: '', brandColor: '#4338F5', supportEmail: '', supportPhone: '', countryCode: '92', address: '' },
  domain: { customDomain: '', status: 'pending', subdomain: '' },
  notifications: {
    emailAlerts: true,
    whatsAppAlerts: false,
    inAppAlerts: true,
    notifyOnFlagged: true,
    dailyDigest: false,
    digestTime: 'monday',
    recipients: [],
  },
  language: { primary: 'en', rtlEnabled: false },
};

// ---------------------------------------------------------------- question types

const TO_UI_TYPE: Record<string, QuestionType> = {
  star: 'star',
  emoji: 'smiley',
  single_choice: 'single',
  multi_choice: 'multiple',
  yes_no: 'yesno',
  nps: 'scale10',
  text: 'text',
};

const TO_BACKEND_TYPE: Record<QuestionType, string> = {
  star: 'star',
  smiley: 'emoji',
  single: 'single_choice',
  multiple: 'multi_choice',
  yesno: 'yes_no',
  scale10: 'nps',
  text: 'text',
};

export const toBackendQuestionType = (type: QuestionType): string => TO_BACKEND_TYPE[type];

// ---------------------------------------------------------------- forms

export interface FormSummary {
  id: string;
  name: string;
  active: boolean;
  questionsCount: number;
  locationsCount: number;
}

/** Which form the builder edits. The design edits one form, the backend can hold several. */
let activeFormId: string | null = null;
export const getActiveFormId = () => activeFormId;
export const setActiveFormId = (id: string | null) => {
  activeFormId = id;
};

export async function fetchForms(): Promise<FormSummary[]> {
  const res = await api('/forms');
  return (res.data || []).map((form: any) => ({
    id: String(form.id),
    name: form.name,
    active: Boolean(form.is_active),
    questionsCount: Number(form.questions_count ?? 0),
    locationsCount: Number(form.locations_count ?? 0),
  }));
}

export function mapQuestion(raw: any): Question {
  return {
    id: String(raw.id),
    categoryId: raw.form_category_id ? String(raw.form_category_id) : '',
    text: raw.text,
    type: TO_UI_TYPE[raw.type] || 'text',
    required: Boolean(raw.is_required),
    critical: Boolean(raw.is_critical),
    weight: Number(raw.weight ?? 1),
    active: Boolean(raw.is_active),
    followUp: Boolean(raw.follow_up_on_low),
    lowScoreThreshold: Math.round(Number(raw.low_score_threshold ?? 40)),
    options: (raw.options || []).map((option: any) => ({
      id: String(option.id),
      label: option.label,
      score: Math.round(Number(option.score_value ?? 0)),
    })),
  };
}

export function mapCategory(raw: any): Category {
  return {
    id: String(raw.id),
    name: raw.name,
    weight: Math.round(Number(raw.weight ?? 0)),
    icon: raw.icon || 'Star',
    color: raw.color || '#4338F5',
  };
}

export async function loadFormConfig(): Promise<FormConfig> {
  const forms = await fetchForms();
  const chosen = forms.find((form) => form.id === activeFormId) || forms[0];
  let company: { name?: string; primary_color?: string | null } = {};
  try {
    const settings = await api('/settings');
    company = settings.organization || {};
  } catch {
    /* people without the settings permission still get the form itself */
  }

  if (!chosen) return { ...emptyFormConfig, orgName: company.name || '', orgLogoText: (company.name || '?')[0] };

  activeFormId = chosen.id;
  const res = await api(`/forms/${chosen.id}`);
  const form = res.data;
  const defaults = res.defaults || {};
  const fields = { ...(defaults.customer_fields || {}), ...(form.customer_fields || {}) };

  return {
    formId: chosen.id,
    active: Boolean(form.is_active),
    orgName: company.name || '',
    orgLogoText: (company.name || '?')[0].toUpperCase(),
    brandColor: company.primary_color || '#4338F5',
    welcomeTitle: form.welcome_title || '',
    welcomeSubtitle: form.welcome_text || defaults.welcome_text || '',
    thankYouTitle: form.thank_you_title || '',
    thankYouSubtitle: form.thank_you_text || defaults.thank_you_text || '',
    customerInfoFields: {
      name: fields.name || 'optional',
      phone: fields.phone || 'optional',
      email: fields.email || 'optional',
    },
    categories: (form.categories || []).map(mapCategory),
    questions: (form.questions || []).map(mapQuestion),
  };
}

// ---------------------------------------------------------------- scoring

const BAND_KEYS = ['excellent', 'good', 'needs_attention', 'critical'] as const;

export async function loadScoringConfig(): Promise<ScoringConfig> {
  const res = await api('/scoring/settings');
  const data = res.data;
  const bands = [...(data.rating_bands || [])].sort((a: any, b: any) => b.min - a.min);
  const config: ScoringConfig = JSON.parse(JSON.stringify(emptyScoringConfig));

  BAND_KEYS.forEach((key, index) => {
    const band = bands[index];
    if (band) {
      config.bands[key] = { ...config.bands[key], label: band.label, min: Number(band.min), max: Number(band.max) };
    }
  });

  config.flagThreshold = Math.round(Number(data.flag_threshold ?? 60));
  config.criticalThreshold = Math.round(Number(data.critical_threshold ?? 50));
  config.rules = {
    autoFlagOverallBelowThreshold: Boolean(data.flag_on_overall),
    autoFlagCriticalQuestionBad: Boolean(data.flag_on_critical_question),
    autoFlagCategoryBelowScore: Boolean(data.flag_on_category),
    categoryThresholdScore: Math.round(Number(data.flag_category_threshold ?? 50)),
  };
  return config;
}

// ---------------------------------------------------------------- settings

export async function loadSettings(): Promise<SettingsConfig> {
  const res = await api('/settings');
  const org = res.organization || {};
  const notify = res.notifications || {};
  let domain: SettingsConfig['domain'] = { customDomain: org.domain || '', status: 'pending', subdomain: org.slug || '' };

  try {
    const state = await api('/settings/domain');
    const info = state.data ?? state;
    domain = {
      customDomain: info.domain || '',
      status: info.domain_verified_at ? 'verified' : 'pending',
      subdomain: org.slug || '',
      instructions: info.instructions || undefined,
    };
  } catch {
    /* the domain panel stays on the organization's own values */
  }

  return {
    company: {
      name: org.name || '',
      tagline: org.tagline || '',
      brandColor: org.primary_color || '#4338F5',
      supportEmail: org.support_email || '',
      supportPhone: org.support_phone || '',
      countryCode: String(org.default_country_code || '92'),
      address: org.address || '',
      logoUrl: org.logo_path ? `/storage/${String(org.logo_path).replace(/^\/+/, '')}` : undefined,
    },
    domain,
    notifications: {
      emailAlerts: Boolean(notify.email_on_flagged ?? true),
      whatsAppAlerts: Boolean(notify.whatsapp_enabled),
      inAppAlerts: true,
      notifyOnFlagged: Boolean(notify.email_on_flagged ?? true),
      dailyDigest: Boolean(notify.weekly_summary_enabled),
      digestTime: notify.weekly_summary_day || 'monday',
      recipients: Array.isArray(notify.notify_emails) ? notify.notify_emails : [],
    },
    language: { primary: org.language === 'ur' ? 'ur' : 'en', rtlEnabled: Boolean(org.rtl_enabled) },
  };
}

// ---------------------------------------------------------------- roles

/** The Roles page reads the real permission catalog itself; this keeps the shared state shape. */
export async function loadRolesPermissions(): Promise<Record<string, RolePermissions>> {
  return {};
}

// ---------------------------------------------------------------- saving the form

const isSavedId = (id: string) => /^\d+$/.test(id);

function questionPayload(question: Question, categoryId?: string) {
  const choiceTypes: QuestionType[] = ['single', 'multiple'];
  return {
    form_category_id: (categoryId ?? question.categoryId) && isSavedId(categoryId ?? question.categoryId) ? Number(categoryId ?? question.categoryId) : null,
    text: question.text,
    type: toBackendQuestionType(question.type),
    is_required: question.required,
    is_critical: question.critical,
    is_active: question.active,
    follow_up_on_low: Boolean(question.followUp),
    low_score_threshold: question.lowScoreThreshold ?? 40,
    weight: question.type === 'text' ? Math.min(question.weight, 5) : Math.max(1, Math.min(5, question.weight)),
    ...(choiceTypes.includes(question.type)
      ? {
          options: (question.options || []).map((option, index) => ({
            label: option.label,
            score_value: option.score,
            sort_order: index,
          })),
        }
      : {}),
  };
}

export interface FormDraft {
  welcomeTitle: string;
  welcomeSubtitle: string;
  thankYouTitle: string;
  thankYouSubtitle: string;
  customerInfoFields: FormConfig['customerInfoFields'];
  questions: Question[];
}

/** Saves the builder by comparing the draft with what is stored: new, changed, removed and re-ordered questions. */
export async function saveFormConfig(previous: FormConfig, draft: FormDraft): Promise<void> {
  const formId = activeFormId;
  if (!formId) throw new Error('There is no form to save.');

  await api(`/forms/${formId}`, {
    method: 'PATCH',
    body: {
      welcome_title: draft.welcomeTitle || null,
      welcome_text: draft.welcomeSubtitle || null,
      thank_you_title: draft.thankYouTitle || null,
      thank_you_text: draft.thankYouSubtitle || null,
      customer_fields: draft.customerInfoFields,
    },
  });

  const before = new Map(previous.questions.map((question) => [question.id, question]));
  const draftIds = new Set(draft.questions.map((question) => question.id));

  for (const question of previous.questions) {
    if (!draftIds.has(question.id)) {
      await api(`/questions/${question.id}`, { method: 'DELETE' });
    }
  }

  const finalOrder: number[] = [];
  for (const question of draft.questions) {
    if (!isSavedId(question.id)) {
      const created = await api(`/forms/${formId}/questions`, { method: 'POST', body: questionPayload(question) });
      finalOrder.push(created.data.id);
      continue;
    }
    const old = before.get(question.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(question)) {
      await api(`/questions/${question.id}`, { method: 'PATCH', body: questionPayload(question) });
    }
    finalOrder.push(Number(question.id));
  }

  if (finalOrder.length > 0) {
    await api(`/forms/${formId}/questions/reorder`, { method: 'POST', body: { order: finalOrder } });
  }
}

export async function createForm(name: string): Promise<string> {
  const res = await api('/forms', {
    method: 'POST',
    body: { name, with_starter: true, connect_all_locations: false },
  });
  return String(res.data.id);
}

// ---------------------------------------------------------------- scoring

const BAND_ORDER = ['excellent', 'good', 'needs_attention', 'critical'] as const;

export async function saveScoringConfig(config: ScoringConfig, categories: Category[]): Promise<void> {
  const bands = BAND_ORDER.map((key) => ({
    label: config.bands[key].label,
    min: config.bands[key].min,
    max: config.bands[key].max,
  }));

  await api('/scoring/settings', {
    method: 'PATCH',
    body: {
      flag_on_overall: config.rules.autoFlagOverallBelowThreshold,
      flag_threshold: config.flagThreshold,
      flag_on_critical_question: config.rules.autoFlagCriticalQuestionBad,
      critical_threshold: config.criticalThreshold ?? 50,
      flag_on_category: config.rules.autoFlagCategoryBelowScore,
      flag_category_threshold: config.rules.categoryThresholdScore,
      rating_bands: bands,
    },
  });

  if (activeFormId && categories.length > 0) {
    const weights: Record<string, number> = {};
    categories.forEach((category) => {
      weights[category.id] = category.weight;
    });
    await api(`/scoring/forms/${activeFormId}/category-weights`, { method: 'PUT', body: { weights } });
  }
}

export interface ScorePreview {
  overall_score: number | null;
  rating_band: string | null;
  is_flagged: boolean;
  flag_reasons: string[];
}

/** The server scores sample answers with the real rules; the browser never calculates a score itself. */
export async function previewScore(categoryTargets: Record<string, number>, criticalFails: boolean): Promise<ScorePreview | null> {
  if (!activeFormId) return null;
  const res = await api(`/forms/${activeFormId}`);
  const questions: any[] = (res.data.questions || []).filter((q: any) => q.is_active && q.type !== 'text');

  const answers = questions.map((question) => {
    const target = criticalFails && question.is_critical ? 0 : (categoryTargets[String(question.form_category_id)] ?? 75);
    const options: any[] = question.options || [];
    const nearest = options.length
      ? options.reduce((best, option) =>
          Math.abs(Number(option.score_value) - target) < Math.abs(Number(best.score_value) - target) ? option : best,
        )
      : null;

    switch (question.type) {
      case 'star':
      case 'emoji':
        return nearest && question.type === 'emoji'
          ? { question_id: question.id, option_id: nearest.id }
          : { question_id: question.id, value: 1 + (target / 100) * 4 };
      case 'nps':
        return { question_id: question.id, value: target / 10 };
      case 'yes_no':
        return { question_id: question.id, value: target >= 50 ? 'yes' : 'no' };
      default:
        return nearest ? { question_id: question.id, option_id: nearest.id } : { question_id: question.id };
    }
  });

  if (answers.length === 0) return null;
  return api(`/scoring/forms/${activeFormId}/preview`, { method: 'POST', body: { answers } });
}

// ---------------------------------------------------------------- categories

export interface CategoryDraft {
  name: string;
  icon?: string;
  color?: string;
}

export async function createCategory(draft: CategoryDraft): Promise<Category> {
  if (!activeFormId) throw new Error('There is no form selected.');
  const res = await api(`/forms/${activeFormId}/categories`, {
    method: 'POST',
    body: { name: draft.name, icon: draft.icon || null, color: draft.color || null },
  });
  return mapCategory(res.data);
}

export async function updateCategory(id: string, draft: CategoryDraft): Promise<void> {
  await api(`/categories/${id}`, {
    method: 'PATCH',
    body: { name: draft.name, icon: draft.icon || null, color: draft.color || null },
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await api(`/categories/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------- question library and templates

export interface LibraryItem {
  id: string;
  group: string;
  text: string;
  type: string;
  category: string | null;
  weight: number;
  is_critical: boolean;
  options: Array<{ label: string; score_value: number }>;
}

export interface TemplateInfo {
  key: string;
  name: string;
  categories: string[];
  question_count: number;
}

export async function fetchLibrary(): Promise<LibraryItem[]> {
  const res = await api('/templates/library');
  return res.data || [];
}

export async function fetchTemplates(): Promise<TemplateInfo[]> {
  const res = await api('/templates');
  return res.data || [];
}

/** Adds ready-made questions to the current form, creating any category they need. */
export async function addLibraryQuestions(items: LibraryItem[], existingCategories: Category[]): Promise<number> {
  if (!activeFormId) throw new Error('There is no form selected.');
  const byName = new Map(existingCategories.map((category) => [category.name.trim().toLowerCase(), category.id]));

  let added = 0;
  for (const item of items) {
    let categoryId: string | null = null;
    if (item.category) {
      const key = item.category.trim().toLowerCase();
      if (!byName.has(key)) {
        const created = await createCategory({ name: item.category });
        byName.set(key, created.id);
      }
      categoryId = byName.get(key) ?? null;
    }
    await api(`/forms/${activeFormId}/questions`, {
      method: 'POST',
      body: {
        form_category_id: categoryId ? Number(categoryId) : null,
        text: item.text,
        type: item.type,
        is_required: true,
        weight: item.type === 'text' ? 0 : Math.max(1, Math.min(5, item.weight || 1)),
        is_critical: item.is_critical,
        follow_up_on_low: item.is_critical,
        options: item.options.map((option, index) => ({ label: option.label, score_value: option.score_value, sort_order: index })),
      },
    });
    added += 1;
  }
  return added;
}

export async function applyTemplate(key: string, connectAllLocations: boolean): Promise<string> {
  const res = await api('/templates/apply', { method: 'POST', body: { template: key, connect_all_locations: connectAllLocations } });
  return String(res.data.id);
}

// ---------------------------------------------------------------- links, locations, active switch

export interface GuestLink {
  locationId: string;
  label: string;
  url: string;
}

export interface FormLinks {
  links: GuestLink[];
  active: boolean;
  organizationWide: boolean;
}

export async function fetchFormLinks(): Promise<FormLinks> {
  if (!activeFormId) return { links: [], active: false, organizationWide: true };
  const res = await api(`/forms/${activeFormId}`);
  return {
    links: (res.guest_links || []).map((link: any) => ({
      locationId: String(link.location_id),
      label: link.label,
      url: link.public_url,
    })),
    active: Boolean(res.data.is_active),
    organizationWide: res.data.branch_id === null,
  };
}

export async function setFormActive(active: boolean): Promise<void> {
  if (!activeFormId) return;
  await api(`/forms/${activeFormId}`, { method: 'PATCH', body: { is_active: active } });
}

/** Connect (or disconnect with null) a location to a form. */
export async function connectLocation(locationId: string, formId: string | null): Promise<void> {
  await api(`/locations/${locationId}`, { method: 'PATCH', body: { form_id: formId ? Number(formId) : null } });
}

// ---------------------------------------------------------------- branch overrides

export interface QuestionOverride {
  questionId: string;
  hidden: boolean;
  text: string | null;
  required: boolean | null;
  weight: number | null;
}

export async function fetchOverrides(branchId: string): Promise<QuestionOverride[]> {
  if (!activeFormId) return [];
  const res = await api(`/forms/${activeFormId}/branches/${branchId}/overrides`);
  return (res.data || []).map((row: any) => ({
    questionId: String(row.question_id),
    hidden: Boolean(row.is_hidden),
    text: row.text_override ?? null,
    required: row.is_required_override ?? null,
    weight: row.weight_override !== null && row.weight_override !== undefined ? Number(row.weight_override) : null,
  }));
}

export async function saveOverride(branchId: string, override: QuestionOverride): Promise<void> {
  if (!activeFormId) return;
  await api(`/forms/${activeFormId}/branches/${branchId}/overrides`, {
    method: 'POST',
    body: {
      question_id: Number(override.questionId),
      is_hidden: override.hidden,
      text_override: override.text || null,
      is_required_override: override.required,
      weight_override: override.weight,
    },
  });
}

export async function removeOverride(branchId: string, questionId: string): Promise<void> {
  if (!activeFormId) return;
  await api(`/forms/${activeFormId}/branches/${branchId}/overrides/${questionId}`, { method: 'DELETE' });
}
