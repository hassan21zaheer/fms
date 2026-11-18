import {
  LayoutDashboard,
  MessageSquareText,
  AlertTriangle,
  SlidersHorizontal,
  BarChart3,
  Users,
  Building2,
  UserCheck,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronsRight,
  ChevronsLeft,
  FileEdit,
  Building,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp, PageId } from '../context/AppContext';
import { fetchCasesPage, onDataChange } from '../services/dataService';
import { PAGE_PERMISSIONS } from '../lib/nav';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export function Sidebar() {
  const {
    activePage,
    setActivePage,
    sidebarExpanded,
    toggleSidebar,
    currentRole,
    can,
    selectedBranch,
    activeOrganizationId,
    organizationName,
    logout,
  } = useApp();

  const [openCasesCount, setOpenCasesCount] = useState(0);

  useEffect(() => {
    if (!can('manage cases') || (currentRole === 'owner' && activeOrganizationId === null)) {
      setOpenCasesCount(0);
      return undefined;
    }
    let cancelled = false;
    const load = () =>
      fetchCasesPage({ page: 1, perPage: 1, branch: selectedBranch })
        .then((res) => !cancelled && setOpenCasesCount(res.counts?.open ?? 0))
        .catch(() => undefined);

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    const stopListening = onDataChange((kind) => {
      if (kind === 'cases' || kind === 'feedback') void load();
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stopListening();
    };
  }, [can, currentRole, activeOrganizationId, selectedBranch]);

  const NAV_ITEMS: NavItem[] = [
    { id: 'organizations', label: 'Organizations', icon: Building },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'feedback', label: 'Feedback', icon: MessageSquareText },
    { id: 'cases', label: 'Cases', icon: AlertTriangle, badge: openCasesCount > 0 ? openCasesCount : undefined },
    { id: 'builder', label: 'Form Builder', icon: FileEdit },
    { id: 'scoring', label: 'Scoring Rules', icon: SlidersHorizontal },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'branches', label: 'Branches & Locations', icon: Building2 },
    { id: 'users', label: 'Team', icon: UserCheck },
    { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.id === 'public_form') return false;
    if (!can(...PAGE_PERMISSIONS[item.id as Exclude<PageId, 'public_form'>])) return false;
    if (item.id === 'organizations') return currentRole === 'owner';
    if (item.id === 'roles') return true;
    return currentRole !== 'owner' || activeOrganizationId !== null;
  });

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col justify-between py-6 px-3 bg-[#0A0A0D]/90 dark:bg-[#0A0A0D]/90 bg-white/90 backdrop-blur-md border-r border-slate-200 dark:border-white/10 transition-all duration-300 ease-in-out ${
        sidebarExpanded ? 'w-64' : 'w-[76px]'
      }`}
    >
      {/* Top Section: Logo & Expand Button */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2">
          {/* Flowing Spiral Brand Mark */}
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4338F5] via-indigo-500 to-sky-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/25">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 9.5 21.1 7.2 19.6 5.4"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            {sidebarExpanded && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                  {organizationName || 'FMS'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
                  {currentRole === 'owner' ? 'Platform owner' : 'Admin Panel'}
                </span>
              </div>
            )}
          </div>

          {/* Expand / Collapse Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? (
              <ChevronsLeft className="w-4 h-4" />
            ) : (
              <ChevronsRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`group relative flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition-all duration-150 ${
                  isActive
                    ? 'dark:bg-white dark:text-zinc-950 bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
                title={!sidebarExpanded ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />

                {sidebarExpanded && (
                  <span className="text-xs truncate tracking-wide flex-1 text-left">
                    {item.label}
                  </span>
                )}

                {item.badge !== undefined && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                      isActive
                        ? 'dark:bg-zinc-900 dark:text-white bg-white text-slate-900'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Tooltip for collapsed state */}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-3 hidden group-hover:flex items-center z-50 pointer-events-none">
                    <span className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 dark:bg-zinc-800 rounded-lg shadow-lg whitespace-nowrap border border-white/10">
                      {item.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Logout / Exit */}
      <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void logout()}
          className={`flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ${
            !sidebarExpanded ? 'justify-center' : ''
          }`}
          title={!sidebarExpanded ? 'Sign Out' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0 stroke-[1.8]" />
          {sidebarExpanded && (
            <span className="text-xs font-medium tracking-wide">Sign Out</span>
          )}
        </button>
      </div>
    </aside>
  );
}
