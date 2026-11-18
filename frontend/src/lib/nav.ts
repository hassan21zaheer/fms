import type { PageId } from '../context/AppContext';

/** Permissions (any one is enough) that open each screen. Owner has its own screen set. */
export const PAGE_PERMISSIONS: Record<Exclude<PageId, 'public_form'>, string[]> = {
  dashboard: ['view feedback', 'view reports', 'manage cases'],
  feedback: ['view feedback'],
  cases: ['manage cases'],
  builder: ['manage forms'],
  scoring: ['manage scoring'],
  reports: ['view reports'],
  customers: ['view feedback', 'contact customers'],
  branches: ['manage branches', 'manage locations'],
  users: ['manage users'],
  roles: ['manage users'],
  settings: ['manage settings'],
  organizations: ['manage organizations'],
};

/** Screens that only make sense for the platform owner or only for an organization. */
export const OWNER_ONLY: PageId[] = ['organizations'];
export const ORGANIZATION_ONLY: PageId[] = [
  'dashboard',
  'feedback',
  'cases',
  'builder',
  'scoring',
  'reports',
  'customers',
  'settings',
];
