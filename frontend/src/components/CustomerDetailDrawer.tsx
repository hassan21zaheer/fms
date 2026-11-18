import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Phone, Mail, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Drawer } from './Drawer';
import { ScoreBadge } from './ScoreBadge';
import {
  fetchCustomerProfile,
  prepareCustomerWhatsApp,
  sendCustomerEmail,
} from '../services/dataService';
import { feedbackLabel, whole } from '../lib/format';

type Channel = 'email' | 'whatsapp' | null;

export function CustomerDetailDrawer() {
  const { selectedCustomerId, setSelectedCustomerId, customers, setSelectedFeedbackId, showToast, can, branches } =
    useApp();

  const [profile, setProfile] = useState<any | null>(null);
  const [channel, setChannel] = useState<Channel>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setChannel(null);
    setSubject('');
    setBody('');
    if (!selectedCustomerId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetchCustomerProfile(selectedCustomerId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId, reloadKey]);

  const listed = customers.find((c) => c.id === selectedCustomerId);
  if (!selectedCustomerId || (!profile && !listed)) return null;

  const name = profile?.name || listed?.name || 'Guest';
  const phone = profile?.phone || listed?.phone || '';
  const email = profile?.email || listed?.email || '';
  const stats = profile?.stats;
  const visits = stats?.feedback_count ?? listed?.feedbackCount ?? 0;
  const average = stats?.average_score ?? listed?.avgScore ?? 0;
  const branchName = profile?.branch?.name || branches.find((item) => item.id === listed?.branchId)?.name || '';
  const history: any[] = profile?.submissions || [];
  const messages: any[] = profile?.messages || [];
  const canContact = can('contact customers');

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || !selectedCustomerId) return;
    setSending(true);
    try {
      if (channel === 'email') {
        await sendCustomerEmail(selectedCustomerId, subject.trim() || 'Following up on your visit', body.trim());
        showToast(`Email sent to ${email}`, 'success');
      } else {
        const link = await prepareCustomerWhatsApp(selectedCustomerId, body.trim());
        if (link) window.open(link, '_blank', 'noopener');
        showToast('WhatsApp chat opened with your message ready to send', 'success');
      }
      setChannel(null);
      setSubject('');
      setBody('');
      setReloadKey((key) => key + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send the message', 'error');
    } finally {
      setSending(false);
    }
  };

  const openComposer = (next: Exclude<Channel, null>) => {
    if (next === 'email' && !email) {
      showToast('This guest has no email address on file.', 'warning');
      return;
    }
    if (next === 'whatsapp' && !phone) {
      showToast('This guest has no phone number on file.', 'warning');
      return;
    }
    setChannel(next);
  };

  return (
    <Drawer
      isOpen={!!selectedCustomerId}
      onClose={() => setSelectedCustomerId(null)}
      title={name}
      subtitle={`Guest profile · ${visits} total visits`}
      footer={
        canContact ? (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => openComposer('whatsapp')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              WhatsApp Guest
            </button>
            <button
              type="button"
              onClick={() => openComposer('email')}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Email Guest
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-base">
              {name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h3>
              {branchName && <p className="text-xs text-slate-400">Preferred: {branchName}</p>}
            </div>
          </div>
          <ScoreBadge score={whole(average)} showBand={true} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5 text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">{phone || '—'}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{email || '—'}</span>
          </div>
        </div>
      </div>

      {channel && (
        <form
          onSubmit={handleSend}
          className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#15151A] space-y-2"
        >
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {channel === 'email' ? `Email ${email}` : `WhatsApp ${phone}`}
          </p>
          {channel === 'email' && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="w-full p-3 rounded-xl text-xs bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setChannel(null)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending && <Loader2 className="w-3 h-3 animate-spin" />}
              {channel === 'email' ? 'Send email' : 'Open WhatsApp'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          Stay & Feedback History ({history.length})
        </h4>

        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedCustomerId(null);
                setSelectedFeedbackId(feedbackLabel(item.id));
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200/80 dark:border-white/10 hover:border-indigo-500/50 cursor-pointer transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-500">{feedbackLabel(item.id)}</span>
                <ScoreBadge score={whole(item.overall_score)} size="sm" />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>{item.location?.name}</span>
                <span className="tabular-nums">{new Date(item.submitted_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-xs text-slate-400">No feedback from this guest yet.</p>}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
            Messages Sent ({messages.length})
          </h4>
          {messages.map((message) => (
            <div
              key={message.id}
              className="p-3 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200/80 dark:border-white/10 text-xs space-y-1"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="uppercase font-bold tracking-wider text-[10px]">{message.channel}</span>
                <span>{new Date(message.created_at).toLocaleString()}</span>
              </div>
              <p className="text-slate-700 dark:text-zinc-300">{message.body}</p>
              {message.user?.name && <p className="text-[10px] text-slate-400">by {message.user.name}</p>}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
