import type {
  Branch,
  CaseItem,
  CaseNote,
  Customer,
  FeedbackRecord,
  LocationItem,
  UserItem,
  UserRole,
} from '../types';
import { avatarFor, caseLabel, feedbackLabel, timeAgo, whole } from '../lib/format';

export function mapRole(role?: string): UserRole {
  switch (role) {
    case 'owner':
      return 'owner';
    case 'superadmin':
      return 'superadmin';
    case 'admin':
      return 'branch_admin';
    default:
      return 'staff';
  }
}

export function toBackendRole(role: UserRole): string {
  return role === 'branch_admin' ? 'admin' : role;
}

/** Feedback list row (a submission) to the design's feedback record. */
export function mapFeedback(item: any): FeedbackRecord {
  const categoryScores: Record<string, number> = {};
  for (const row of item.category_scores || []) {
    categoryScores[String(row.name ?? row.category_id ?? 'General')] = whole(row.score);
  }

  const flagged = Boolean(item.is_flagged);
  const caseStatus = item.feedback_case?.status ?? item.feedbackCase?.status;
  const caseId = item.feedback_case?.id ?? item.feedbackCase?.id;

  return {
    id: feedbackLabel(item.id),
    customerName: item.customer_name || item.customer?.name || 'Anonymous guest',
    customerPhone: item.customer_phone || item.customer?.phone || '',
    customerEmail: item.customer_email || item.customer?.email || '',
    branchId: String(item.branch_id),
    locationName: item.location?.name || '—',
    locationId: String(item.location_id),
    createdAt: item.submitted_at,
    overallScore: whole(item.overall_score),
    categoryScores,
    answers: (item.answers || []).map((answer: any) => ({
      questionId: String(answer.question_id ?? answer.id),
      questionText: answer.question_text_snapshot,
      categoryId: String(answer.form_category_id ?? 'general'),
      value:
        answer.option_label_snapshot ??
        answer.free_text_value ??
        (answer.score_snapshot != null ? `${whole(answer.score_snapshot)} / 100` : ''),
      score: whole(answer.score_snapshot),
    })),
    flagged,
    flagReasons: item.flag_reasons || [],
    status: flagged ? (caseStatus ?? 'open') : 'verified',
    caseId: caseId ? caseLabel(caseId) : undefined,
    comment:
      (item.answers || []).map((answer: any) => answer.free_text_value).find((text: string | null) => !!text) ||
      undefined,
  };
}

function mapNote(note: any): CaseNote {
  const name = note.user?.name || 'System';
  return {
    id: String(note.id),
    authorName: name,
    authorAvatar: avatarFor(name),
    content: note.note,
    createdAt: note.created_at,
  };
}

export function mapCase(item: any): CaseItem {
  const submission = item.submission || {};
  const assigneeName = item.assignee?.name || 'Unassigned';
  const location = submission.location?.name || '';

  return {
    id: caseLabel(item.id),
    feedbackId: feedbackLabel(item.submission_id),
    feedbackRef: feedbackLabel(item.submission_id),
    customerName: submission.customer_name || 'Anonymous guest',
    customerPhone: submission.customer_phone || '',
    customerEmail: submission.customer_email || '',
    branchId: String(item.branch_id),
    locationName: location || item.branch?.name || '—',
    priority: item.priority || 'medium',
    status: item.status,
    assigneeId: item.assigned_to ? String(item.assigned_to) : '',
    assigneeName,
    assigneeAvatar: avatarFor(assigneeName),
    title: location ? `Guest concern at ${location}` : 'Guest concern',
    description: (submission.flag_reasons || []).join('; ') || 'Flagged feedback needs a follow-up.',
    score: whole(submission.overall_score),
    createdAt: item.created_at,
    resolvedAt: item.resolved_at || undefined,
    resolutionSummary: item.resolution || undefined,
    notes: (item.notes || []).map(mapNote),
  };
}

export function mapCustomer(item: any, branchId: string): Customer {
  return {
    id: String(item.id),
    name: item.name || 'No name',
    phone: item.phone || '',
    email: item.email || '',
    branchId: item.branch_id ? String(item.branch_id) : branchId,
    feedbackCount: Number(item.feedback_count ?? 0),
    avgScore: item.average_score != null ? whole(item.average_score) : 0,
    lastVisit: item.last_feedback_at || item.created_at || '',
    flaggedCount: Number(item.flagged_count ?? 0),
  };
}

export function mapBranch(item: any): Branch {
  const slug = String(item.slug || item.name || '');
  return {
    id: String(item.id),
    slug,
    name: item.name,
    shortCode: slug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'BR',
    city: item.city || '',
    address: item.address || '',
    roomsCount: Number(item.rooms_count ?? 0),
    tablesCount: Number(item.tables_count ?? 0),
    rating: item.average_score != null ? Math.round((Number(item.average_score) / 20) * 10) / 10 : 0,
    active: Boolean(item.is_active),
    manager: item.manager_name || '—',
  };
}

const LOCATION_TYPES: Record<string, LocationItem['type']> = {
  room: 'room',
  table: 'table',
  counter: 'counter',
  other: 'facility',
};

export function toBackendLocationType(type: LocationItem['type']): string {
  return type === 'facility' ? 'other' : type;
}

export function mapLocation(item: any, orgSlug: string): LocationItem {
  const branchSlug = item.branch?.slug || '';
  return {
    id: String(item.id),
    branchId: String(item.branch_id),
    name: item.name,
    type: LOCATION_TYPES[item.type] || 'facility',
    identifier: item.slug,
    slug: item.slug,
    branchSlug,
    active: Boolean(item.is_active),
    qrScansCount: Number(item.scans_count ?? 0),
    lastScan: item.last_scan_at ? timeAgo(item.last_scan_at) : 'Never',
    publicUrl: `${window.location.origin}/f/${orgSlug}/${branchSlug}/${item.slug}`,
    qrReady: Boolean(item.qr_code_path),
    formId: item.form_id ? String(item.form_id) : undefined,
    formName: item.form?.name,
  };
}

export function mapUser(item: any): UserItem {
  return {
    id: String(item.id),
    name: item.name,
    email: item.email,
    avatar: avatarFor(item.name),
    role: mapRole(item.role),
    branchId: item.branch_id ? String(item.branch_id) : undefined,
    active: Boolean(item.is_active),
    lastActive: item.last_login_at ? timeAgo(item.last_login_at) : 'Never signed in',
    phone: item.phone || undefined,
    branchName: item.branch_name || undefined,
    organizationName: item.organization_name || undefined,
    sessions: Number(item.sessions_count ?? 0),
  };
}
