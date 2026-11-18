import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FeedbackRecord,
  CaseItem,
  Customer,
  Branch,
  LocationItem,
  UserItem,
  FormConfig,
  ScoringConfig,
  SettingsConfig,
  RolePermissions,
  BranchId,
  UserRole,
} from '../types';
import { api, getActiveOrganizationId, getToken, setActiveOrganizationId, setToken } from '../api/client';
import {
  ChangeKind,
  SessionUser,
  fetchAssignees,
  fetchBranches,
  fetchCases,
  fetchCustomers,
  fetchFeedbackList,
  fetchLocations,
  fetchSession,
  fetchUsers,
  loginRequest,
  logoutRequest,
  onDataChange,
} from '../services/dataService';
import { emptyFormConfig, emptyScoringConfig, emptySettings, loadFormConfig, loadRolesPermissions, loadScoringConfig, loadSettings } from '../services/configService';

export type PageId =
  | 'dashboard'
  | 'feedback'
  | 'cases'
  | 'builder'
  | 'scoring'
  | 'reports'
  | 'customers'
  | 'branches'
  | 'users'
  | 'roles'
  | 'settings'
  | 'organizations'
  | 'public_form';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export interface OrganizationSummary {
  id: number;
  name: string;
  slug: string;
}

interface AppContextType {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  toggleTheme: () => void;
  currentRole: UserRole;
  selectedBranch: BranchId | 'all';
  setSelectedBranch: (branch: BranchId | 'all') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchFeedback: (q: string) => void;
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;

  // Authentication
  user: SessionUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
  /** True for people tied to one branch (branch admin and staff with a branch). */
  branchLocked: boolean;

  // Organization (owner works inside one organization at a time)
  organizationName: string;
  organizationSlug: string;
  organizations: OrganizationSummary[];
  activeOrganizationId: number | null;
  setActiveOrganization: (id: number | null) => void;
  reloadOrganizations: () => Promise<void>;

  // Selected details for drawers
  selectedFeedbackId: string | null;
  setSelectedFeedbackId: (id: string | null) => void;
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;

  // Public form
  openPublicForm: (branchSlug?: string, locationSlug?: string) => void;

  // Live data
  loading: boolean;
  feedback: FeedbackRecord[];
  cases: CaseItem[];
  customers: Customer[];
  branches: Branch[];
  locations: LocationItem[];
  users: UserItem[];
  assignees: UserItem[];
  rolesPermissions: Record<string, RolePermissions>;
  formConfig: FormConfig;
  scoringConfig: ScoringConfig;
  settings: SettingsConfig;
  refresh: (...kinds: ChangeKind[]) => Promise<void>;

  // Toasts
  toasts: Toast[];
  showToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const PAGE_PATHS: Record<Exclude<PageId, 'public_form'>, string> = {
  dashboard: '/',
  feedback: '/feedback',
  cases: '/cases',
  builder: '/form-builder',
  scoring: '/scoring',
  reports: '/reports',
  customers: '/customers',
  branches: '/branches',
  users: '/team',
  roles: '/roles',
  settings: '/settings',
  organizations: '/organizations',
};

function pageFromPath(pathname: string): PageId {
  if (pathname.startsWith('/f/')) return 'public_form';
  const match = (Object.entries(PAGE_PATHS) as Array<[PageId, string]>).find(
    ([, path]) => path !== '/' && (pathname === path || pathname.startsWith(`${path}/`)),
  );
  return match ? match[0] : 'dashboard';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activePage = pageFromPath(location.pathname);

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('fms_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [selectedBranch, setSelectedBranchState] = useState<BranchId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(() => Boolean(getToken()));
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [activeOrganizationId, setActiveOrgState] = useState<number | null>(() => {
    const stored = getActiveOrganizationId();
    return stored ? Number(stored) : null;
  });

  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [assignees, setAssignees] = useState<UserItem[]>([]);
  const [rolesPermissions, setRolesPermissions] = useState<Record<string, RolePermissions>>({});
  const [formConfig, setFormConfig] = useState<FormConfig>(emptyFormConfig);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(emptyScoringConfig);
  const [settings, setSettings] = useState<SettingsConfig>(emptySettings);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const currentRole: UserRole = user?.role ?? 'staff';
  const branchLocked = Boolean(user?.branchId) && currentRole !== 'owner';

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const applyTheme = (t: 'dark' | 'light') => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.classList.toggle('light', t === 'light');
  };

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem('fms_theme', t);
    } catch {
      /* storage unavailable, the theme still applies for this visit */
    }
  };

  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A search belongs to the page it was typed on.
  const keepSearch = useRef(false);
  useEffect(() => {
    if (keepSearch.current) {
      keepSearch.current = false;
      return;
    }
    setSearchQuery('');
  }, [location.pathname]);

  const searchFeedback = (query: string) => {
    keepSearch.current = true;
    setSearchQuery(query);
    navigate(PAGE_PATHS.feedback);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const toggleSidebar = () => setSidebarExpanded((prev) => !prev);

  const can = useCallback(
    (...permissions: string[]) => {
      if (!user) return false;
      if (permissions.length === 0) return true;
      return permissions.some((permission) => user.permissions.includes(permission));
    },
    [user],
  );

  const setSelectedBranch = (branch: BranchId | 'all') => {
    if (branchLocked) return;
    setSelectedBranchState(branch);
  };

  const setActivePage = (page: PageId) => {
    if (page === 'public_form') return;
    navigate(PAGE_PATHS[page]);
  };

  const openPublicForm = (branchSlug?: string, locationSlug?: string) => {
    const org = user?.organization?.slug || organizations.find((item) => item.id === activeOrganizationId)?.slug || '';
    const firstLocation = locations.find((item) => item.slug && item.branchSlug);
    const branchPart = branchSlug || firstLocation?.branchSlug;
    const locationPart = locationSlug || firstLocation?.slug;
    if (!org || !branchPart || !locationPart) {
      showToast('Add a branch and a location first, then the customer form can be previewed.', 'warning');
      return;
    }
    window.open(`/f/${org}/${branchPart}/${locationPart}`, '_blank', 'noopener');
  };

  // ---------------------------------------------------------------- session

  useEffect(() => {
    if (!getToken()) {
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    fetchSession()
      .then((session) => {
        if (!cancelled) {
          setUser(session);
          setSelectedBranchState(session.branchId ?? 'all');
        }
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('fms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fms:unauthorized', onUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const session = await loginRequest(email, password);
    if (session.role !== 'owner') {
      setActiveOrganizationId(null);
      setActiveOrgState(null);
    }
    setSelectedBranchState(session.branchId ?? 'all');
    setUser(session);
    navigate(session.role === 'owner' ? '/organizations' : '/');
  };

  const logout = async () => {
    await logoutRequest();
    setActiveOrganizationId(null);
    setActiveOrgState(null);
    setUser(null);
    setFeedback([]);
    setCases([]);
    setCustomers([]);
    setBranches([]);
    setLocations([]);
    setUsers([]);
    navigate('/login');
  };

  // ---------------------------------------------------------------- organizations (owner)

  const reloadOrganizations = useCallback(async () => {
    if (user?.role !== 'owner') return;
    const res = await api('/organizations', { global: true, query: { per_page: 200 } });
    setOrganizations(
      (res.data || []).map((item: any) => ({ id: item.id, name: item.name, slug: item.slug })),
    );
  }, [user?.role]);

  useEffect(() => {
    reloadOrganizations().catch(() => undefined);
  }, [reloadOrganizations]);

  const setActiveOrganization = (id: number | null) => {
    setActiveOrganizationId(id === null ? null : String(id));
    setActiveOrgState(id);
    setSelectedBranchState('all');
  };

  const organizationName =
    user?.organization?.name ||
    organizations.find((item) => item.id === activeOrganizationId)?.name ||
    (user?.role === 'owner' ? 'Platform owner' : '');
  const organizationSlug =
    user?.organization?.slug || organizations.find((item) => item.id === activeOrganizationId)?.slug || '';

  // ---------------------------------------------------------------- data loading

  const hasOrganizationScope = Boolean(user) && (user?.role !== 'owner' || activeOrganizationId !== null);

  const userRef = useRef(user);
  userRef.current = user;

  const refresh = useCallback(
    async (...kinds: ChangeKind[]) => {
      const current = userRef.current;
      if (!current) return;
      if (current.role === 'owner' && getActiveOrganizationId() === null) return;
      const all = kinds.length === 0;
      const wants = (kind: ChangeKind) => all || kinds.includes(kind);
      const branchFilter = current.branchId ?? selectedBranchRef.current;
      const has = (permission: string) => current.permissions.includes(permission);

      const jobs: Array<Promise<unknown>> = [];
      const safe = <T,>(job: Promise<T>, apply: (value: T) => void) =>
        jobs.push(
          job.then(apply).catch(() => {
            /* a section the person cannot open simply stays empty */
          }),
        );

      if (wants('feedback') && has('view feedback')) safe(fetchFeedbackList(branchFilter), setFeedback);
      if (wants('cases') && has('manage cases')) {
        safe(fetchCases(branchFilter), setCases);
        safe(fetchAssignees(), setAssignees);
      }
      if (wants('customers') && (has('view feedback') || has('contact customers'))) {
        safe(fetchCustomers(branchFilter), setCustomers);
      }
      if ((wants('branches') || wants('organizations')) && has('manage branches')) {
        safe(fetchBranches(), setBranches);
      } else if (current.branch && wants('branches')) {
        // People tied to one branch cannot list branches, so show the one they belong to.
        setBranches([
          {
            id: current.branch.id,
            name: current.branch.name,
            shortCode: current.branch.name.slice(0, 3).toUpperCase(),
            city: '',
            address: '',
            roomsCount: 0,
            tablesCount: 0,
            rating: 0,
            active: true,
            manager: '—',
          },
        ]);
      }
      if ((wants('locations') || wants('branches')) && has('manage locations')) {
        safe(fetchLocations(current.organization?.slug || organizationSlugRef.current), setLocations);
      }
      if (wants('users') && has('manage users')) safe(fetchUsers(), setUsers);
      if (wants('form') && has('manage forms')) safe(loadFormConfig(), setFormConfig);
      if (wants('scoring') && has('manage scoring')) safe(loadScoringConfig(), setScoringConfig);
      if (wants('settings') && has('manage settings')) safe(loadSettings(), setSettings);
      if (wants('roles') && has('manage users')) safe(loadRolesPermissions(), setRolesPermissions);

      await Promise.all(jobs);
    },
    [],
  );

  const selectedBranchRef = useRef<BranchId | 'all'>(selectedBranch);
  selectedBranchRef.current = selectedBranch;
  const organizationSlugRef = useRef(organizationSlug);
  organizationSlugRef.current = organizationSlug;

  useEffect(() => {
    if (!hasOrganizationScope) return;
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hasOrganizationScope, activeOrganizationId, selectedBranch, user?.id, organizationSlug, refresh]);

  useEffect(() => onDataChange((kind) => void refresh(kind)), [refresh]);

  /** New guest feedback appears at the top without anyone reloading the page. */
  useEffect(() => {
    if (!hasOrganizationScope) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh('feedback', 'cases');
    }, 30000);
    return () => window.clearInterval(timer);
  }, [hasOrganizationScope, refresh]);

  const value = useMemo<AppContextType>(
    () => ({
      activePage,
      setActivePage,
      theme,
      setTheme,
      toggleTheme,
      currentRole,
      selectedBranch,
      setSelectedBranch,
      searchQuery,
      setSearchQuery,
      searchFeedback,
      sidebarExpanded,
      setSidebarExpanded,
      toggleSidebar,
      user,
      isAuthenticated: Boolean(user),
      authLoading,
      login,
      logout,
      can,
      branchLocked,
      organizationName,
      organizationSlug,
      organizations,
      activeOrganizationId,
      setActiveOrganization,
      reloadOrganizations,
      selectedFeedbackId,
      setSelectedFeedbackId,
      selectedCaseId,
      setSelectedCaseId,
      selectedCustomerId,
      setSelectedCustomerId,
      openPublicForm,
      loading,
      feedback,
      cases,
      customers,
      branches,
      locations,
      users,
      assignees,
      rolesPermissions,
      formConfig,
      scoringConfig,
      settings,
      refresh,
      toasts,
      showToast,
      removeToast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activePage, theme, currentRole, selectedBranch, searchQuery, sidebarExpanded, user, authLoading, can, branchLocked,
      organizationName, organizationSlug, organizations, activeOrganizationId, selectedFeedbackId, selectedCaseId,
      selectedCustomerId, loading, feedback, cases, customers, branches, locations, users, assignees, rolesPermissions,
      formConfig, scoringConfig, settings, refresh, toasts, showToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
