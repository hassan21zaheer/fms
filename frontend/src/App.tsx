import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useApp, AppProvider, PageId } from './context/AppContext';
import { PAGE_PERMISSIONS } from './lib/nav';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { FeedbackDetailDrawer } from './components/FeedbackDetailDrawer';
import { CaseDetailDrawer } from './components/CaseDetailDrawer';
import { CustomerDetailDrawer } from './components/CustomerDetailDrawer';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { CasesPage } from './pages/CasesPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { ScoringPage } from './pages/ScoringPage';
import { ReportsPage } from './pages/ReportsPage';
import { CustomersPage } from './pages/CustomersPage';
import { BranchesPage } from './pages/BranchesPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { SettingsPage } from './pages/SettingsPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { PublicFeedbackForm } from './pages/PublicFeedbackForm';

type ShellPage = Exclude<PageId, 'public_form'>;

const PAGES: Record<ShellPage, ComponentType> = {
  dashboard: DashboardPage,
  feedback: FeedbackPage,
  cases: CasesPage,
  builder: FormBuilderPage,
  scoring: ScoringPage,
  reports: ReportsPage,
  customers: CustomersPage,
  branches: BranchesPage,
  users: UsersPage,
  roles: RolesPage,
  settings: SettingsPage,
  organizations: OrganizationsPage,
};

const ROUTES: Array<[ShellPage, string]> = [
  ['dashboard', '/'],
  ['feedback', '/feedback'],
  ['cases', '/cases'],
  ['builder', '/form-builder'],
  ['scoring', '/scoring'],
  ['reports', '/reports'],
  ['customers', '/customers'],
  ['branches', '/branches'],
  ['users', '/team'],
  ['roles', '/roles'],
  ['settings', '/settings'],
  ['organizations', '/organizations'],
];

function AccessGate({ page }: { page: ShellPage }) {
  const { can, currentRole, activeOrganizationId } = useApp();
  const Page = PAGES[page];

  if (page === 'dashboard' && currentRole === 'owner' && activeOrganizationId === null) {
    return <Navigate to="/organizations" replace />;
  }

  const allowedByRole =
    page === 'organizations'
      ? currentRole === 'owner'
      : page === 'roles' || currentRole !== 'owner' || activeOrganizationId !== null;

  if (!can(...PAGE_PERMISSIONS[page]) || !allowedByRole) {
    const ownerNeedsOrganization = currentRole === 'owner' && page !== 'organizations' && activeOrganizationId === null;
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {ownerNeedsOrganization ? 'Choose an organization first' : 'You do not have access to this page'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
          {ownerNeedsOrganization
            ? 'Open Organizations and enter a workspace to see its data.'
            : 'Ask your administrator if you need it.'}
        </p>
      </div>
    );
  }

  return <Page />;
}

function AdminShell() {
  const { sidebarExpanded, theme, toasts, removeToast } = useApp();

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-[#F1F4FA]' : 'bg-[#0A0A0D]'}`}>
      <div
        className={`${
          theme === 'light'
            ? 'rounded-[32px] bg-[#F8FAFD] border border-[#E5E9F2] shadow-2xl shadow-indigo-500/5 min-h-[95vh] overflow-hidden'
            : 'min-h-screen bg-[#0A0A0D]'
        }`}
      >
        <Sidebar />

        <div
          className={`flex flex-col min-h-screen transition-all duration-300 ${
            sidebarExpanded ? 'pl-64' : 'pl-[76px]'
          }`}
        >
          <TopBar />

          <main className="flex-1 px-4 sm:px-8 py-6">
            <Routes>
              {ROUTES.map(([page, path]) => (
                <Route key={page} path={path} element={<AccessGate page={page} />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>

      <FeedbackDetailDrawer />
      <CaseDetailDrawer />
      <CustomerDetailDrawer />

      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`pointer-events-auto px-4 py-3 rounded-2xl text-white text-xs font-semibold shadow-2xl border border-white/10 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-150 cursor-pointer ${
              t.type === 'error' ? 'bg-rose-600' : t.type === 'warning' ? 'bg-amber-600' : 'bg-slate-900 dark:bg-zinc-800'
            }`}
          >
            <span>{t.message}</span>
            <span className="text-[10px] opacity-60">✕</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, authLoading } = useApp();

  return (
    <Routes>
      <Route path="/f/:org/:branch/:location" element={<PublicFeedbackForm />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={
          authLoading ? (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0D] text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isAuthenticated ? (
            <AdminShell />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
