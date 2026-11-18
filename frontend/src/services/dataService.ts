import { api, ApiError, download, getActiveOrganizationId, setToken } from '../api/client';
import {
  mapBranch,
  mapCase,
  mapCustomer,
  mapFeedback,
  mapLocation,
  mapRole,
  mapUser,
} from '../api/mappers';
import { avatarFor, caseNumericId, numericId } from '../lib/format';
import type {
  Branch,
  BranchId,
  CaseItem,
  CasePriority,
  CaseStatus,
  Customer,
  FeedbackRecord,
  FeedbackStatus,
  LocationItem,
  UserItem,
  UserRole,
} from '../types';

// ---------------------------------------------------------------- change notifications
// Pages call the functions below and the app reloads whatever changed, so every screen stays current.

export type ChangeKind =
  | 'feedback'
  | 'cases'
  | 'customers'
  | 'branches'
  | 'locations'
  | 'users'
  | 'form'
  | 'scoring'
  | 'settings'
  | 'roles'
  | 'organizations';

type Listener = (kind: ChangeKind) => void;
const listeners = new Set<Listener>();

export function onDataChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChange(...kinds: ChangeKind[]) {
  kinds.forEach((kind) => listeners.forEach((listener) => listener(kind)));
}

// ---------------------------------------------------------------- session

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  role: UserRole;
  branchId: BranchId | null;
  branch: { id: string; name: string } | null;
  organization: { id: number; name: string; slug: string; plan_expires_at?: string | null } | null;
}

function mapSessionUser(raw: any): SessionUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    roles: raw.roles || [],
    permissions: raw.permissions || [],
    role: mapRole((raw.roles || [])[0]),
    branchId: raw.branch_id ? String(raw.branch_id) : null,
    branch: raw.branch ? { id: String(raw.branch.id), name: raw.branch.name } : null,
    organization: raw.organization
      ? {
          id: raw.organization.id,
          name: raw.organization.name,
          slug: raw.organization.slug,
          plan_expires_at: raw.organization.plan_expires_at,
        }
      : null,
  };
}

export async function loginRequest(email: string, password: string): Promise<SessionUser> {
  const data = await api('/auth/login', { method: 'POST', body: { email, password }, anonymous: true });
  setToken(data.token);
  return mapSessionUser(data.user);
}

export async function fetchSession(): Promise<SessionUser> {
  const data = await api('/auth/me', { global: true });
  return mapSessionUser(data.user);
}

export async function logoutRequest(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', global: true });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  } finally {
    setToken(null);
  }
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  page: 'feedback' | 'cases' | null;
  read: boolean;
  createdAt: string;
}

export async function fetchNotifications(): Promise<{ items: AppNotification[]; unread: number }> {
  const res = await api('/notifications');
  return {
    unread: Number(res.unread_count || 0),
    items: (res.data || []).map((item: any) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      page: item.page === 'cases' || item.page === 'feedback' ? item.page : null,
      read: Boolean(item.read),
      createdAt: item.created_at,
    })),
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api('/notifications/read-all', { method: 'POST' });
}

export async function changePassword(current: string, next: string): Promise<void> {
  await api('/auth/change-password', {
    method: 'POST',
    global: true,
    body: { current_password: current, password: next, password_confirmation: next },
  });
}

// ---------------------------------------------------------------- feedback

const PAGE = 200;

function branchQuery(branch?: BranchId | 'all') {
  return branch && branch !== 'all' ? { branch_id: branch } : {};
}

export async function fetchFeedbackList(branch?: BranchId | 'all'): Promise<FeedbackRecord[]> {
  const res = await api('/feedback', { query: { per_page: PAGE, ...branchQuery(branch) } });
  return (res.data || []).map(mapFeedback);
}

export async function fetchFeedbackById(id: string): Promise<FeedbackRecord | null> {
  try {
    const res = await api(`/feedback/${numericId(id)}`);
    const record = mapFeedback(res.data);
    return record;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The raw detail (answers, case and notes) for the feedback drawer. */
export async function fetchFeedbackDetail(id: string): Promise<any> {
  const res = await api(`/feedback/${numericId(id)}`);
  return res.data;
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<FeedbackRecord> {
  const detail = await fetchFeedbackDetail(id);
  const linked = detail.feedback_case ?? detail.feedbackCase;
  if (!linked) throw new Error('This feedback has no case to update.');
  if (status === 'open' || status === 'in_progress' || status === 'resolved') {
    await api(`/cases/${linked.id}`, { method: 'PATCH', body: { status } });
  }
  emitChange('feedback', 'cases');
  return mapFeedback((await fetchFeedbackDetail(id)) as any);
}

export async function createCaseFromFeedback(feedbackId: string, _title?: string, priority?: CasePriority): Promise<CaseItem> {
  const res = await api(`/feedback/${numericId(feedbackId)}/case`, {
    method: 'POST',
    body: { priority: priority && priority !== 'low' ? priority : undefined },
  });
  emitChange('feedback', 'cases', 'customers');
  const created = await api(`/cases/${res.data.id}`);
  return mapCase(created.data);
}

export async function exportFeedback(format: 'csv' | 'pdf', branch?: BranchId | 'all') {
  await download(`/feedback/export.${format}`, `feedback-records.${format}`, branchQuery(branch));
}

// ---------------------------------------------------------------- cases

export async function fetchCases(branch?: BranchId | 'all'): Promise<CaseItem[]> {
  const res = await api('/cases', { query: { per_page: PAGE, ...branchQuery(branch) } });
  return (res.data || []).map(mapCase);
}

export async function fetchCaseById(caseId: string): Promise<CaseItem> {
  const res = await api(`/cases/${caseNumericId(caseId)}`);
  const data = res.data;
  // The detail endpoint nests the submission differently from the list, so rebuild what the drawer needs.
  const submission = data.submission || {};
  return mapCase({
    ...data,
    submission: { ...submission, location: submission.location || data.branch },
  });
}

export async function updateCaseStatus(caseId: string, status: CaseStatus, resolutionText?: string): Promise<CaseItem> {
  await api(`/cases/${caseNumericId(caseId)}`, {
    method: 'PATCH',
    body: { status, resolution: status === 'resolved' ? resolutionText || null : undefined },
  });
  emitChange('cases', 'feedback');
  return fetchCaseById(caseId);
}

export async function addCaseNote(caseId: string, _authorName: string, _authorAvatar: string, content: string): Promise<CaseItem> {
  await api(`/cases/${caseNumericId(caseId)}/notes`, { method: 'POST', body: { note: content } });
  emitChange('cases');
  return fetchCaseById(caseId);
}

export async function assignCase(caseId: string, assigneeId: string): Promise<CaseItem> {
  await api(`/cases/${caseNumericId(caseId)}`, { method: 'PATCH', body: { assigned_to: Number(assigneeId) } });
  emitChange('cases');
  return fetchCaseById(caseId);
}

export async function fetchAssignees(): Promise<UserItem[]> {
  const res = await api('/cases/assignees');
  return (res.data || []).map((person: any) =>
    mapUser({ ...person, is_active: true, branch_name: person.branch_name }),
  );
}

// ---------------------------------------------------------------- customers

export async function fetchCustomers(branch?: BranchId | 'all'): Promise<Customer[]> {
  const res = await api('/customers', { query: { per_page: PAGE, ...branchQuery(branch) } });
  const branchId = branch && branch !== 'all' ? String(branch) : '';
  return (res.data || []).map((item: any) => mapCustomer(item, branchId));
}

// ---------------------------------------------------------------- paged lists (the server does the searching, sorting and counting)

export interface PageResult<T> {
  items: T[];
  total: number;
  lastPage: number;
  /** Extra numbers the endpoint sends along, such as case counts per status. */
  counts?: Record<string, number>;
}

interface PageParams {
  page: number;
  perPage: number;
  branch?: BranchId | 'all';
  search?: string;
}

const pageOf = <T,>(res: any, items: T[]): PageResult<T> => ({
  items,
  total: Number(res.total ?? items.length),
  lastPage: Math.max(1, Number(res.last_page ?? 1)),
  counts: res.counts,
});

export async function fetchFeedbackPage(
  params: PageParams & { flaggedOnly?: boolean; scoreMin?: number; scoreBelow?: number; sort?: 'newest' | 'score_high' | 'score_low' },
): Promise<PageResult<FeedbackRecord>> {
  const res = await api('/feedback', {
    query: {
      page: params.page,
      per_page: params.perPage,
      ...branchQuery(params.branch),
      ...(params.flaggedOnly ? { flagged: 1 } : {}),
      ...(params.scoreMin !== undefined ? { score_min: params.scoreMin } : {}),
      ...(params.scoreBelow !== undefined ? { score_below: params.scoreBelow } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      ...(params.sort && params.sort !== 'newest' ? { sort: params.sort } : {}),
    },
  });
  return pageOf(res, (res.data || []).map(mapFeedback));
}

/** How many feedback records fall in a score range, counted by the database. */
export async function countFeedback(params: { branch?: BranchId | 'all'; scoreMin?: number; scoreBelow?: number }): Promise<number> {
  const res = await api('/feedback', {
    query: {
      per_page: 1,
      ...branchQuery(params.branch),
      ...(params.scoreMin !== undefined ? { score_min: params.scoreMin } : {}),
      ...(params.scoreBelow !== undefined ? { score_below: params.scoreBelow } : {}),
    },
  });
  return Number(res.total ?? 0);
}

export async function fetchCasesPage(
  params: PageParams & { status?: CaseStatus; priority?: string },
): Promise<PageResult<CaseItem>> {
  const res = await api('/cases', {
    query: {
      page: params.page,
      per_page: params.perPage,
      ...branchQuery(params.branch),
      ...(params.status ? { status: params.status } : {}),
      ...(params.priority && params.priority !== 'all' ? { priority: params.priority } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
  });
  return pageOf(res, (res.data || []).map(mapCase));
}

export async function fetchCustomersPage(params: PageParams): Promise<PageResult<Customer>> {
  const res = await api('/customers', {
    query: {
      page: params.page,
      per_page: params.perPage,
      ...branchQuery(params.branch),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
  });
  const branchId = params.branch && params.branch !== 'all' ? String(params.branch) : '';
  return pageOf(res, (res.data || []).map((item: any) => mapCustomer(item, branchId)));
}

/** Numbers the dashboard shows that must not depend on how many records the screen loaded. */
export async function fetchDashboardStats(branch?: BranchId | 'all'): Promise<{
  openCases: number;
  unassignedCases: number;
  waitingCustomers: number;
}> {
  const res = await api('/dashboard', { query: branchQuery(branch) });
  const stats = res.stats || {};
  return {
    openCases: Number(stats.open_cases ?? 0),
    unassignedCases: Number(stats.unassigned_cases ?? 0),
    waitingCustomers: Number(stats.waiting_customers ?? 0),
  };
}

/** Profile of one customer: stats, feedback history, cases and messages. */
export async function fetchCustomerProfile(id: string): Promise<any> {
  const res = await api(`/customers/${id}`);
  return res.data;
}

export async function createCustomer(payload: { name?: string; phone?: string; email?: string; notes?: string }) {
  const res = await api('/customers', { method: 'POST', body: payload });
  emitChange('customers');
  return res.data;
}

export async function updateCustomer(id: string, payload: { name?: string; phone?: string; email?: string; notes?: string }) {
  const res = await api(`/customers/${id}`, { method: 'PATCH', body: payload });
  emitChange('customers');
  return res.data;
}

export async function deleteCustomer(id: string) {
  await api(`/customers/${id}`, { method: 'DELETE' });
  emitChange('customers');
}

export async function sendCustomerEmail(id: string, subject: string, body: string) {
  await api(`/customers/${id}/email`, { method: 'POST', body: { subject, body } });
}

export async function prepareCustomerWhatsApp(id: string, body: string): Promise<string | undefined> {
  const res = await api(`/customers/${id}/whatsapp`, { method: 'POST', body: { body } });
  return res.whatsapp_link;
}

export async function exportCustomers() {
  await download('/customers/export.csv', 'customers.csv');
}

// ---------------------------------------------------------------- branches and locations

export async function fetchBranches(): Promise<Branch[]> {
  const res = await api('/branches');
  return (res.data || []).map(mapBranch);
}

export async function createBranch(payload: { name: string; city?: string; address?: string }) {
  const res = await api('/branches', { method: 'POST', body: payload });
  emitChange('branches', 'organizations');
  return mapBranch(res.data);
}

export async function updateBranch(id: string, payload: Record<string, unknown>) {
  const res = await api(`/branches/${id}`, { method: 'PATCH', body: payload });
  emitChange('branches', 'organizations');
  return mapBranch(res.data);
}

export async function fetchLocations(orgSlug: string, branch?: BranchId): Promise<LocationItem[]> {
  const res = await api('/locations', { query: { ...(branch ? { branch_id: branch } : {}) } });
  return (res.data || []).map((item: any) => mapLocation(item, orgSlug));
}

export async function addLocation(payload: { branchId: string; name: string; type: string; formId?: string }) {
  const res = await api('/locations', {
    method: 'POST',
    body: { branch_id: Number(payload.branchId), name: payload.name, type: payload.type, form_id: payload.formId ? Number(payload.formId) : null },
  });
  emitChange('locations', 'branches', 'organizations');
  return res.data;
}

export async function updateLocation(id: string, payload: Record<string, unknown>) {
  const res = await api(`/locations/${id}`, { method: 'PATCH', body: payload });
  emitChange('locations');
  return res.data;
}

export async function deleteBranch(id: string) {
  await api(`/branches/${id}`, { method: 'DELETE' });
  emitChange('branches', 'locations', 'organizations', 'feedback', 'cases', 'customers');
}

export async function deleteLocation(id: string) {
  await api(`/locations/${id}`, { method: 'DELETE' });
  emitChange('locations', 'branches', 'organizations');
}

export async function generateLocationQr(id: string): Promise<{ qrUrl: string | null; publicUrl: string }> {
  const res = await api(`/locations/${id}/qr`, { method: 'POST' });
  emitChange('locations');
  return { qrUrl: res.qr_url, publicUrl: res.public_url };
}

export async function downloadLocationQr(id: string, name: string) {
  await download(`/locations/${id}/qr/download`, `${name}-qr.png`);
}

export async function downloadAllQr(branch?: BranchId | 'all') {
  await download('/locations/qr-sheet', 'location-qr-codes.pdf', branchQuery(branch));
}

// ---------------------------------------------------------------- users

export async function fetchUsers(): Promise<UserItem[]> {
  const res = await api('/users');
  return (res.data || []).map(mapUser);
}

export interface TeamOptions {
  branches: Array<{ id: number; name: string; organization_name?: string | null }>;
  roles: Array<{ value: string; label: string }>;
  branchLocked: boolean;
}

export async function fetchTeamOptions(): Promise<TeamOptions> {
  const res = await api('/team/options');
  return { branches: res.branches || [], roles: res.roles || [], branchLocked: Boolean(res.branch_locked) };
}

export async function createUser(data: {
  name: string;
  email: string;
  role: UserRole;
  branchId?: string;
  password: string;
  phone?: string;
}): Promise<UserItem> {
  const res = await api('/users', {
    method: 'POST',
    body: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      password: data.password,
      role: data.role === 'branch_admin' ? 'admin' : data.role,
      branch_id: data.branchId && data.role !== 'superadmin' && data.role !== 'owner' ? Number(data.branchId) : null,
    },
  });
  emitChange('users');
  return mapUser(res.data);
}

export async function updateUser(
  id: string,
  updates: { name?: string; email?: string; phone?: string; role?: UserRole; branchId?: string | null; active?: boolean },
): Promise<UserItem> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.email !== undefined) body.email = updates.email;
  if (updates.phone !== undefined) body.phone = updates.phone || null;
  if (updates.role !== undefined) body.role = updates.role === 'branch_admin' ? 'admin' : updates.role;
  if (updates.branchId !== undefined) body.branch_id = updates.branchId ? Number(updates.branchId) : null;
  if (updates.active !== undefined) body.is_active = updates.active;

  const res = await api(`/users/${id}`, { method: 'PATCH', body });
  emitChange('users');
  return mapUser(res.data);
}

export async function resetUserPassword(id: string, password: string) {
  await api(`/users/${id}/password`, { method: 'POST', body: { password } });
  emitChange('users');
}

export async function revokeUserSessions(id: string) {
  await api(`/users/${id}/sessions/revoke`, { method: 'POST' });
  emitChange('users');
}

export async function deleteUser(id: string) {
  await api(`/users/${id}`, { method: 'DELETE' });
  emitChange('users');
}

export { avatarFor, getActiveOrganizationId };

