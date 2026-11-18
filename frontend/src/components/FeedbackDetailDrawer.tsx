import { useEffect, useState } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Drawer } from './Drawer';
import { ScoreBadge } from './ScoreBadge';
import { StatusPill, StatusValue } from './StatusPill';
import { updateFeedbackStatus, createCaseFromFeedback, fetchFeedbackDetail } from '../services/dataService';
import { mapFeedback } from '../api/mappers';
import type { FeedbackRecord } from '../types';

export function FeedbackDetailDrawer() {
  const {
    selectedFeedbackId,
    setSelectedFeedbackId,
    feedback,
    setSelectedCaseId,
    setActivePage,
    showToast,
    branches,
    can,
  } = useApp();

  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [detail, setDetail] = useState<FeedbackRecord | null>(null);

  useEffect(() => {
    if (!selectedFeedbackId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchFeedbackDetail(selectedFeedbackId)
      .then((raw) => {
        if (!cancelled) setDetail(mapFeedback(raw));
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFeedbackId, feedback]);

  const listRecord = feedback.find((f) => f.id === selectedFeedbackId);
  const selectedRecord = detail && detail.id === selectedFeedbackId ? detail : listRecord;
  if (!selectedRecord) return null;
  const branchLabel = branches.find((item) => item.id === selectedRecord.branchId)?.name ?? '';

  const handleStatusChange = async (newStatus: StatusValue) => {
    try {
      await updateFeedbackStatus(selectedRecord.id, newStatus);
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleCreateCase = async () => {
    try {
      setIsCreatingCase(true);
      const newCase = await createCaseFromFeedback(selectedRecord.id);
      showToast(`Created ${newCase.id} from feedback #${selectedRecord.id}`, 'success');
      setSelectedCaseId(newCase.id);
      setActivePage('cases');
      setSelectedFeedbackId(null);
    } catch {
      showToast('Failed to create case', 'error');
    } finally {
      setIsCreatingCase(false);
    }
  };

  return (
    <Drawer
      isOpen={!!selectedFeedbackId}
      onClose={() => setSelectedFeedbackId(null)}
      title={`Feedback #${selectedRecord.id}`}
      subtitle={`Submitted on ${new Date(selectedRecord.createdAt).toLocaleString()}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-zinc-400">Status:</span>
            <StatusPill
              status={selectedRecord.status}
              disabled={!selectedRecord.caseId}
              onChange={handleStatusChange}
            />
          </div>

          {selectedRecord.caseId ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCaseId(selectedRecord.caseId!);
                setActivePage('cases');
                setSelectedFeedbackId(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>View Case {selectedRecord.caseId}</span>
            </button>
          ) : can('manage cases') ? (
            <button
              type="button"
              onClick={handleCreateCase}
              disabled={isCreatingCase}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#15151A] dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-transform active:scale-95 disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isCreatingCase ? 'Creating...' : 'Create Case'}</span>
            </button>
          ) : null}
        </div>
      }
    >
      {/* Customer Header Card */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-sm">
              {selectedRecord.customerName.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedRecord.customerName}
              </h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                {selectedRecord.locationName}{branchLabel ? ` · ${branchLabel}` : ''}
              </p>
            </div>
          </div>
          <ScoreBadge score={selectedRecord.overallScore} showBand={true} size="lg" />
        </div>

        <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">{selectedRecord.customerPhone}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{selectedRecord.customerEmail}</span>
          </div>
        </div>
      </div>

      {/* Flag reasons banner if flagged */}
      {selectedRecord.flagged && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Auto-Flagged Feedback Warning</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
            {selectedRecord.flagReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Category Scores breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          Category Scores
        </h4>
        <div className="space-y-2">
          {Object.entries(selectedRecord.categoryScores).map(([catId, score]) => {
            const label = catId;
            return (
              <div key={catId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-zinc-300">{label}</span>
                  <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                    {score}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      score >= 80
                        ? 'bg-emerald-500'
                        : score >= 60
                        ? 'bg-amber-500'
                        : score >= 40
                        ? 'bg-yellow-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Question & Answer Log */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          Question Responses
        </h4>
        <div className="space-y-3">
          {selectedRecord.answers.map((ans, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#15151A] border border-slate-200/80 dark:border-white/10 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {ans.questionText}
                </p>
                <ScoreBadge score={ans.score} size="sm" />
              </div>
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">Response:</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {typeof ans.value === 'object' ? JSON.stringify(ans.value) : String(ans.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
