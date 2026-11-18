import { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ExternalLink,
  ChevronDown,
  Building,
  Network,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BranchId } from '../types';
import { avatarFor } from '../lib/format';
import { ChangePasswordModal } from './ChangePasswordModal';
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/dataService';

export function TopBar() {
  const {
    theme,
    toggleTheme,
    currentRole,
    selectedBranch,
    setSelectedBranch,
    branchLocked,
    branches,
    user,
    organizations,
    activeOrganizationId,
    setActiveOrganization,
    can,
    searchQuery,
    setSearchQuery,
    activePage,
    searchFeedback,
    setActivePage,
    openPublicForm,
    logout,
  } = useApp();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Formatted date: "Today, Mon 22 Nov" or current date
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isOwner = currentRole === 'owner';

  useEffect(() => {
    if (isOwner) {
      setAlerts([]);
      setUnreadCount(0);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      fetchNotifications()
        .then((result) => {
          if (!cancelled) {
            setAlerts(result.items);
            setUnreadCount(result.unread);
          }
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOwner, activePage, user?.id]);

  const openAlert = (alert: AppNotification) => {
    if (!alert.read) {
      setAlerts((prev) => prev.map((item) => (item.id === alert.id ? { ...item, read: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      void markNotificationRead(alert.id).catch(() => undefined);
    }
    if (alert.page) {
      setActivePage(alert.page);
    }
    setNotificationsOpen(false);
  };

  const readAll = () => {
    setAlerts((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    void markAllNotificationsRead().catch(() => undefined);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-4 bg-[#0A0A0D]/80 dark:bg-[#0A0A0D]/80 bg-[#F1F4FA]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
      {/* Left: Rounded Search Input */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search this page, or press Enter to search feedback..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim() && !['feedback', 'cases', 'customers'].includes(activePage)) {
                searchFeedback(searchQuery);
              }
            }}
            className="w-full pl-10 pr-4 py-2 rounded-full text-xs bg-white dark:bg-[#15151A] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 border border-slate-200 dark:border-white/10 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Center/Right controls */}
      <div className="flex items-center gap-3">
        {/* Date string */}
        <div className="hidden lg:flex items-center text-xs font-semibold text-slate-600 dark:text-zinc-400 px-3 py-1.5 rounded-full bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xs">
          {todayStr}
        </div>

        {/* Organization switcher (platform owner only) */}
        {currentRole === 'owner' && (
          <div className="relative">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xs text-slate-700 dark:text-zinc-300">
              <Network className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={activeOrganizationId ?? ''}
                onChange={(e) => setActiveOrganization(e.target.value ? Number(e.target.value) : null)}
                className="bg-transparent border-none text-slate-900 dark:text-white font-semibold cursor-pointer focus:outline-hidden text-xs pr-1 max-w-[160px]"
              >
                <option value="" className="bg-white dark:bg-[#1A1A22] text-slate-900 dark:text-white">
                  Choose organization
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id} className="bg-white dark:bg-[#1A1A22] text-slate-900 dark:text-white">
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Branch Selector */}
        <div className="relative">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xs ${
              branchLocked ? 'opacity-70 cursor-not-allowed' : 'text-slate-700 dark:text-zinc-300'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-sky-500" />
            <select
              value={selectedBranch}
              disabled={branchLocked}
              onChange={(e) => setSelectedBranch(e.target.value as BranchId | 'all')}
              className="bg-transparent border-none text-slate-900 dark:text-white font-semibold cursor-pointer focus:outline-hidden text-xs pr-1 disabled:cursor-not-allowed"
            >
              <option value="all" className="bg-white dark:bg-[#1A1A22] text-slate-900 dark:text-white">
                All Branches
              </option>
              {(branches.length > 0 ? branches : user?.branch ? [user.branch] : []).map((branch) => (
                <option key={branch.id} value={branch.id} className="bg-white dark:bg-[#1A1A22] text-slate-900 dark:text-white">
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Public Feedback Form Launcher (Quick QR simulation) */}
        {can('manage locations') && (
        <button
          type="button"
          onClick={() => openPublicForm()}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-transform active:scale-95"
          title="Open customer feedback form (QR preview)"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Customer Form</span>
        </button>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {/* Settings button */}
        {can('manage settings') && (
        <button
          type="button"
          onClick={() => setActivePage('settings')}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
        )}

        {/* Notification Bell with red dot */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#15151A]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Notifications
                </span>
                {unreadCount > 0 ? (
                  <button type="button" onClick={readAll} className="text-[10px] font-semibold text-indigo-500 hover:underline">
                    Mark all read ({unreadCount})
                  </button>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">All caught up</span>
                )}
              </div>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No notifications yet</p>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => openAlert(alert)}
                      className={`p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10 ${
                        alert.read ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{alert.title}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">{alert.body}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{new Date(alert.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar with Profile popover */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <img
              src={avatarFor(user?.name || 'User')}
              alt={user?.name || 'Profile'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30"
              referrerPolicy="no-referrer"
            />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 border-b border-slate-100 dark:border-white/10">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-400 truncate">
                  {user?.email}
                </p>
                <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
                  {currentRole.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-1 pt-1 space-y-0.5 text-xs">
                {can('manage settings') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('settings');
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300"
                  >
                    Account Settings
                  </button>
                )}
                {can('manage users') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('users');
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300"
                  >
                    Manage Team
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPasswordOpen(true);
                    setProfileOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300"
                >
                  Change password
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </>
  );
}
