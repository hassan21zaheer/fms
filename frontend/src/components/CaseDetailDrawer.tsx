import { useEffect, useState } from 'react';
import {
  Send,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Drawer } from './Drawer';
import { addCaseNote, updateCaseStatus, assignCase, fetchCaseById } from '../services/dataService';
import { CaseStatus, CaseItem } from '../types';

export function CaseDetailDrawer() {
  const {
    selectedCaseId,
    setSelectedCaseId,
    cases,
    assignees,
    setSelectedFeedbackId,
    setActivePage,
    showToast,
    branches,
    user,
  } = useApp();

  const [noteContent, setNoteContent] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const [detail, setDetail] = useState<CaseItem | null>(null);

  useEffect(() => {
    if (!selectedCaseId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchCaseById(selectedCaseId)
      .then((item) => {
        if (!cancelled) setDetail(item);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId, cases]);

  const listCase = cases.find((c) => c.id === selectedCaseId);
  const selectedCase = detail && detail.id === selectedCaseId ? detail : listCase;
  if (!selectedCase) return null;
  const branchLabel = branches.find((item) => item.id === selectedCase.branchId)?.name ?? '';

  const handleStatusChange = async (newStatus: CaseStatus) => {
    try {
      await updateCaseStatus(
        selectedCase.id,
        newStatus,
        newStatus === 'resolved' ? resolutionText || 'Case resolved successfully.' : undefined
      );
      showToast(`Case marked as ${newStatus}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleAssignChange = async (userId: string) => {
    if (!userId) return;
    try {
      await assignCase(selectedCase.id, userId);
      showToast('Case assignee updated', 'success');
    } catch {
      showToast('Failed to reassign', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      setIsAddingNote(true);
      await addCaseNote(
        selectedCase.id,
        user?.name || '',
        '',
        noteContent.trim()
      );
      setNoteContent('');
      showToast('Note added to timeline', 'success');
    } catch {
      showToast('Failed to add note', 'error');
    } finally {
      setIsAddingNote(false);
    }
  };

  const priorityColor =
    selectedCase.priority === 'urgent'
      ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
      : selectedCase.priority === 'high'
      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
      : 'bg-blue-500/15 text-blue-500 border-blue-500/30';

  return (
    <Drawer
      isOpen={!!selectedCaseId}
      onClose={() => setSelectedCaseId(null)}
      title={selectedCase.title}
      subtitle={`Case ${selectedCase.id} · Created ${new Date(selectedCase.createdAt).toLocaleString()}`}
      headerActions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Status:</span>
          <select
            value={selectedCase.status}
            onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      }
      footer={
        <div className="flex items-center justify-end w-full">
          <button
            type="button"
            onClick={() => {
              setSelectedFeedbackId(selectedCase.feedbackId);
              setActivePage('feedback');
              setSelectedCaseId(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <span>Original Feedback #{selectedCase.feedbackRef}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      {/* Overview Card */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${priorityColor}`}
            >
              {selectedCase.priority}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500">
              Score: <strong className="text-rose-500 font-mono">{selectedCase.score}/100</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 dark:text-zinc-500">Assignee:</span>
            <select
              value={selectedCase.assigneeId}
              onChange={(e) => handleAssignChange(e.target.value)}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="">Unassigned</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 text-xs text-slate-600 dark:text-zinc-300">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            {selectedCase.customerName} · {selectedCase.customerPhone}
          </p>
          <p className="text-slate-500 dark:text-zinc-400">
            {selectedCase.locationName}{branchLabel ? ` (${branchLabel})` : ''}
          </p>
          <p className="mt-2 text-slate-700 dark:text-zinc-300 italic bg-white dark:bg-black/20 p-2.5 rounded-xl border border-slate-200/50 dark:border-white/5">
            "{selectedCase.description}"
          </p>
        </div>
      </div>

      {/* Resolution Summary if resolved */}
      {selectedCase.status === 'resolved' && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="font-bold flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Resolved</span>
          </div>
          <p>{selectedCase.resolutionSummary || 'Case marked as resolved with guest.'}</p>
        </div>
      )}

      {/* Notes & Actions Timeline */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Activity Timeline ({selectedCase.notes.length})</span>
        </h4>

        {/* Notes list */}
        <div className="space-y-3">
          {selectedCase.notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200/80 dark:border-white/10 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img
                    src={note.authorAvatar}
                    alt={note.authorName}
                    className="w-5 h-5 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-bold text-slate-900 dark:text-white">
                    {note.authorName}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                  {new Date(note.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300 pl-7 leading-relaxed">
                {note.content}
              </p>
            </div>
          ))}
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="space-y-2 pt-2">
          <textarea
            rows={2}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Add update or action note..."
            className="w-full p-3 rounded-2xl text-xs bg-white dark:bg-[#15151A] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAddingNote || !noteContent.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Send className="w-3 h-3" />
              <span>Post Note</span>
            </button>
          </div>
        </form>
      </div>
    </Drawer>
  );
}
