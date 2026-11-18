import { useEffect, useState } from 'react';
import {
  Building,
  Globe,
  Bell,
  Check,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emitChange } from '../services/dataService';
import { api, getActiveOrganizationId } from '../api/client';

export function SettingsPage() {
  const { settings, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'branding' | 'domain' | 'notifications'>('branding');
  const [saving, setSaving] = useState(false);

  // Local state
  const [companyName, setCompanyName] = useState(settings.company.name);
  const [tagline, setTagline] = useState(settings.company.tagline);
  const [brandColor, setBrandColor] = useState(settings.company.brandColor);
  const [supportEmail, setSupportEmail] = useState(settings.company.supportEmail);
  const [supportPhone, setSupportPhone] = useState(settings.company.supportPhone);
  const [address, setAddress] = useState(settings.company.address);
  const [countryCode, setCountryCode] = useState(settings.company.countryCode);
  const [recipientsText, setRecipientsText] = useState(settings.notifications.recipients.join(', '));

  const [customDomain, setCustomDomain] = useState(settings.domain.customDomain);
  const [domainBusy, setDomainBusy] = useState(false);

  const [notifState, setNotifState] = useState({ ...settings.notifications });

  useEffect(() => {
    setCompanyName(settings.company.name);
    setTagline(settings.company.tagline);
    setBrandColor(settings.company.brandColor);
    setSupportEmail(settings.company.supportEmail);
    setSupportPhone(settings.company.supportPhone);
    setAddress(settings.company.address);
    setCountryCode(settings.company.countryCode);
    setRecipientsText(settings.notifications.recipients.join(', '));
    setCustomDomain(settings.domain.customDomain);
    setNotifState({ ...settings.notifications });
  }, [settings]);

  const COLOR_PALETTE = ['#4338F5', '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED'];

  const handleSave = async () => {
    const recipients = recipientsText
      .split(/[\s,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);
    const invalid = recipients.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalid) {
      showToast(`"${invalid}" is not a valid email address`, 'error');
      return;
    }
    if (!/^\+?\d{1,4}$/.test(countryCode.trim())) {
      showToast('The country code must be digits only, for example 92', 'error');
      return;
    }

    setSaving(true);
    try {
      await api('/settings/organization', {
        method: 'PATCH',
        body: {
          name: companyName,
          tagline: tagline || null,
          support_email: supportEmail || null,
          support_phone: supportPhone || null,
          default_country_code: countryCode.trim(),
          address: address || null,
          primary_color: brandColor,
        },
      });
      await api('/settings/notifications', {
        method: 'PATCH',
        body: {
          email_on_flagged: notifState.emailAlerts,
          notify_emails: recipients,
          whatsapp_enabled: notifState.whatsAppAlerts,
          weekly_summary_enabled: notifState.dailyDigest,
          weekly_summary_day: notifState.digestTime || 'monday',
        },
      });
      emitChange('settings', 'form');
      showToast('Settings saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runDomainAction = async (action: 'connect' | 'verify' | 'disconnect') => {
    setDomainBusy(true);
    try {
      if (action === 'connect') {
        await api('/settings/domain/connect', { method: 'POST', body: { domain: customDomain.trim() } });
        showToast('Domain added. Add the DNS record below, then press Verify.', 'info');
      } else if (action === 'verify') {
        await api('/settings/domain/verify', { method: 'POST' });
        showToast('Domain verified', 'success');
      } else {
        await api('/settings/domain', { method: 'DELETE' });
        showToast('Domain disconnected', 'info');
      }
      emitChange('settings', 'locations');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The domain action failed', 'error');
    } finally {
      setDomainBusy(false);
    }
  };

  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoUrl = logoPreview ?? settings.company.logoUrl ?? null;

  const handleLogoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('The logo must be smaller than 2 MB.', 'warning');
      return;
    }
    const form = new FormData();
    form.append('logo', file);
    const organizationId = getActiveOrganizationId();
    if (organizationId) form.append('organization_id', organizationId);
    setUploading(true);
    try {
      await api('/settings/logo', { method: 'POST', body: form });
      setLogoPreview(URL.createObjectURL(file));
      emitChange('settings');
      showToast('Logo uploaded', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not upload the logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    setUploading(true);
    try {
      await api('/settings/logo', { method: 'DELETE' });
      setLogoPreview(null);
      emitChange('settings');
      showToast('Logo removed', 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not remove the logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const companyInitials =
    companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'FM';

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            System & Organization Settings
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Company branding, your own website address, and alert channels.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="disabled:opacity-60 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-md transition-transform active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 dark:bg-[#15151A] border border-slate-200 dark:border-white/10 w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'branding'
              ? 'bg-white dark:bg-white/15 text-indigo-500 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Company & Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('domain')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'domain'
              ? 'bg-white dark:bg-white/15 text-indigo-500 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Website & Custom Domain</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'notifications'
              ? 'bg-white dark:bg-white/15 text-indigo-500 shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifications</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-8 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Brand Identity & Theme Accent
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden flex items-center justify-center text-slate-400 font-extrabold">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : companyInitials}
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block">Company logo</label>
                  <div className="flex items-center gap-2">
                    <label className="px-3.5 py-1.5 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                      {uploading ? 'Working...' : logoUrl ? 'Replace logo' : 'Upload logo'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => void handleLogoPick(e)} />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => void handleLogoRemove()}
                        disabled={uploading}
                        className="px-3.5 py-1.5 rounded-full font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">PNG or JPG, up to 2 MB. Shown on the guest form.</p>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Brand Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              {/* Live Color Picker & Presets */}
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 mb-1.5 block">
                  Brand Color Accent (Live in Customer Forms)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBrandColor(c)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                          brandColor === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      >
                        {brandColor === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    ))}
                  </div>

                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                    {brandColor}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-white/10">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Support Phone (WhatsApp)
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    Default country code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    placeholder="92"
                    className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Added to guest numbers written like 0300 1234567, so WhatsApp opens the right chat (92 = Pakistan).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="md:col-span-4 p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Live Customer Form Header
            </span>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/60 dark:border-white/10 space-y-3">
              <div
                className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white font-extrabold text-base shadow-lg transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover rounded-2xl" /> : companyInitials}
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{companyName}</h4>
              <p className="text-xs text-slate-400">{tagline}</p>
              <button
                type="button"
                className="w-full py-2 rounded-full text-xs font-bold text-white shadow-sm transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                Sample Button
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'domain' && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Custom Domain</h3>
              <p className="text-xs text-slate-400">
                Open guest forms on your own website address (for example feedback.yourhotel.com).
              </p>
            </div>
            {settings.domain.customDomain && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  settings.domain.status === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}
              >
                {settings.domain.status === 'verified' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                <span>{settings.domain.status === 'verified' ? 'Verified' : 'Waiting for DNS'}</span>
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs max-w-xl">
            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Your domain</label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="feedback.yourhotel.com"
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-zinc-300">Default address (always works)</label>
              <input
                type="text"
                disabled
                value={settings.domain.subdomain}
                className="w-full mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void runDomainAction('connect')}
                disabled={domainBusy || !customDomain.trim()}
                className="px-4 py-2 rounded-full font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {settings.domain.customDomain ? 'Update domain' : 'Connect domain'}
              </button>
              {settings.domain.customDomain && settings.domain.status !== 'verified' && (
                <button
                  type="button"
                  onClick={() => void runDomainAction('verify')}
                  disabled={domainBusy}
                  className="px-4 py-2 rounded-full font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                >
                  Verify DNS
                </button>
              )}
              {settings.domain.customDomain && (
                <button
                  type="button"
                  onClick={() => void runDomainAction('disconnect')}
                  disabled={domainBusy}
                  className="px-4 py-2 rounded-full font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {settings.domain.customDomain && settings.domain.status !== 'verified' && settings.domain.instructions && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-white">DNS record to add:</h4>
              <div className="font-mono text-[11px] bg-white dark:bg-black/40 p-3 rounded-xl border border-slate-200 dark:border-white/10 break-all">
                {settings.domain.instructions}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-[#15151A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Alert Channels & Dispatch Triggers
          </h3>

          <div className="space-y-3 text-xs max-w-lg">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-2">
              <label className="font-bold text-slate-900 dark:text-white" htmlFor="alert-recipients">
                Who receives the emails
              </label>
              <p className="text-[11px] text-slate-400">
                Flagged-feedback alerts and the weekly summary go to these addresses. Separate several with commas.
              </p>
              <textarea
                id="alert-recipients"
                rows={2}
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="manager@hotel.com, duty@hotel.com"
                className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 opacity-60">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Instant WhatsApp Alerts</span>
                <p className="text-[11px] text-slate-400">Not available yet. You can still message guests on WhatsApp from their profile.</p>
              </div>
              <input type="checkbox" checked={false} disabled readOnly className="rounded-sm border-slate-300" />
            </div>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Email Notifications</span>
                <p className="text-[11px] text-slate-400">Send detailed reports to hotel management</p>
              </div>
              <input
                type="checkbox"
                checked={notifState.emailAlerts}
                onChange={(e) => setNotifState({ ...notifState, emailAlerts: e.target.checked })}
                className="rounded-sm border-slate-300 text-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Weekly summary email</span>
                <p className="text-[11px] text-slate-400">Scores, flagged feedback and open cases for the past week</p>
              </div>
              <input
                type="checkbox"
                checked={notifState.dailyDigest}
                onChange={(e) => setNotifState({ ...notifState, dailyDigest: e.target.checked })}
                className="rounded-sm border-slate-300 text-indigo-600"
              />
            </label>

            {notifState.dailyDigest && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                <span className="font-bold text-slate-900 dark:text-white">Send it every</span>
                <select
                  value={notifState.digestTime}
                  onChange={(e) => setNotifState({ ...notifState, digestTime: e.target.value })}
                  className="p-2 rounded-xl bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white capitalize"
                >
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <option key={day} value={day} className="capitalize">
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
