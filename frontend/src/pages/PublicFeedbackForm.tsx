import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Star, ArrowRight, ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { api, storageUrl } from '../api/client';
import { GuestHero } from '../components/GuestHero';

interface PublicOption {
  id: number;
  label: string;
  score_value: number | string;
}

interface PublicQuestion {
  id: number;
  text: string;
  type: 'star' | 'emoji' | 'single_choice' | 'multi_choice' | 'yes_no' | 'nps' | 'text';
  is_required: boolean;
  follow_up_on_low?: boolean;
  low_score_threshold?: number;
  options: PublicOption[];
}

interface PublicForm {
  rtl?: boolean;
  organization: { name: string; primary_color: string | null; logo_url: string | null; rtl_enabled: boolean; language: string };
  branch: { name: string };
  location: { name: string };
  customer_fields: { name?: string; phone?: string; email?: string };
  messages: { welcome_title: string; welcome_text: string; thank_you_title: string; thank_you_text: string };
  captcha: { enabled: boolean; captcha_id?: string; question?: string };
  form: { questions: PublicQuestion[] };
}

type Answer = { option_id?: number; value?: number | string; free_text?: string };

const SMILEYS = [
  { value: 1, icon: '😡' },
  { value: 2, icon: '🙁' },
  { value: 3, icon: '😐' },
  { value: 4, icon: '😊' },
  { value: 5, icon: '😍' },
];

const inputClass =
  'w-full mt-1 p-3 rounded-xl text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10';

export function PublicFeedbackForm() {
  const { org = '', branch = '', location = '' } = useParams();
  const [searchParams] = useSearchParams();
  const locale = searchParams.get('locale') || undefined;

  const [data, setData] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thanks, setThanks] = useState<{ title: string; message: string } | null>(null);
  /** 0 = welcome, 1..N = one question each, N+1 = the guest's details and the send button. */
  const [step, setStep] = useState(0);

  const load = useCallback(() => {
    setLoadError('');
    setData(null);
    api<PublicForm>(`/f/${org}/${branch}/${location}`, { anonymous: true, query: { locale } })
      .then(setData)
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'This feedback form is not available.'));
  }, [org, branch, location, locale]);

  useEffect(() => {
    load();
  }, [load]);

  const brand = data?.organization.primary_color || '#4338F5';
  const questions = data?.form.questions ?? [];
  const lastStep = questions.length + 1;

  const setAnswer = (questionId: number, answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...answer } }));
  };

  /** Mirrors the server's scale only to decide whether to ask for an explanation; the server scores the answer. */
  const needsFollowUp = (question: PublicQuestion) => {
    const answer = answers[question.id];
    if (!question.follow_up_on_low || !answer || question.type === 'text') return false;
    let score: number | null = null;
    if (answer.option_id !== undefined) {
      const option = question.options.find((item) => item.id === answer.option_id);
      score = option ? Number(option.score_value) : null;
    } else if (typeof answer.value === 'number' || (typeof answer.value === 'string' && answer.value !== '' && !Number.isNaN(Number(answer.value)))) {
      const value = Number(answer.value);
      score = question.type === 'nps' ? value * 10 : (Math.min(5, value) - 1) * 25;
    } else if (typeof answer.value === 'string') {
      score = answer.value.toLowerCase() === 'yes' ? 100 : answer.value.toLowerCase() === 'no' ? 0 : null;
    }
    return score !== null && score < Number(question.low_score_threshold ?? 40);
  };

  const isAnswered = (question: PublicQuestion) => {
    const answer = answers[question.id];
    if (!answer) return false;
    if (question.type === 'text') return Boolean(answer.free_text?.trim() || String(answer.value ?? '').trim());
    return answer.option_id !== undefined || (answer.value !== undefined && answer.value !== '');
  };

  /** Returns the reason a question blocks the guest from moving on, if any. */
  const blockerFor = (question: PublicQuestion): string | null => {
    if (question.is_required && !isAnswered(question)) return 'Please answer this question to continue.';
    if (needsFollowUp(question) && !answers[question.id]?.free_text?.trim()) return 'Please tell us a little more to continue.';
    return null;
  };

  const goNext = () => {
    setSubmitError('');
    if (step >= 1 && step <= questions.length) {
      const blocker = blockerFor(questions[step - 1]);
      if (blocker) {
        setSubmitError(blocker);
        return;
      }
    }
    setStep((current) => Math.min(lastStep, current + 1));
  };

  const goBack = () => {
    setSubmitError('');
    setStep((current) => Math.max(0, current - 1));
  };

  const refreshCaptcha = async () => {
    try {
      const fresh = await api<{ enabled: boolean; captcha_id: string | null; question: string | null }>('/captcha', { anonymous: true });
      setData((prev) =>
        prev
          ? { ...prev, captcha: { enabled: fresh.enabled, captcha_id: fresh.captcha_id ?? undefined, question: fresh.question ?? undefined } }
          : prev,
      );
      setCaptchaAnswer('');
    } catch {
      /* the next submit will explain what went wrong */
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data) return;
    if (step !== lastStep) {
      goNext();
      return;
    }
    setSubmitError('');

    const blockedIndex = questions.findIndex((question) => blockerFor(question));
    if (blockedIndex >= 0) {
      setStep(blockedIndex + 1);
      setSubmitError(blockerFor(questions[blockedIndex]) ?? 'Please complete this question.');
      return;
    }

    const payloadAnswers = questions
      .filter((question) => isAnswered(question))
      .map((question) => {
        const answer = answers[question.id];
        if (question.type === 'text') {
          return { question_id: question.id, value: answer.free_text ?? String(answer.value ?? '') };
        }
        return { question_id: question.id, ...answer };
      });

    if (payloadAnswers.length === 0) {
      setSubmitError('Please answer at least one question.');
      setStep(questions.length > 0 ? 1 : 0);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api<{ title: string; message: string }>(`/f/${org}/${branch}/${location}/submit`, {
        method: 'POST',
        anonymous: true,
        body: {
          customer_name: customer.name || null,
          customer_phone: customer.phone || null,
          customer_email: customer.email || null,
          captcha_id: data.captcha.captcha_id ?? null,
          captcha_answer: captchaAnswer || null,
          answers: payloadAnswers,
        },
      });
      setThanks({ title: result.title || data.messages.thank_you_title, message: data.messages.thank_you_text || result.message });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not record your feedback. Please try again.');
      if (data.captcha.enabled) void refreshCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const startAnother = () => {
    setThanks(null);
    setAnswers({});
    setSubmitError('');
    setStep(0);
    void refreshCaptcha();
  };

  const fields = data?.customer_fields ?? {};
  const rtl = Boolean(data?.rtl ?? data?.organization.rtl_enabled);
  const logoSrc = data?.organization.logo_url
    ? storageUrl(
        data.organization.logo_url.includes('/storage/')
          ? data.organization.logo_url.slice(data.organization.logo_url.indexOf('/storage/') + 9)
          : data.organization.logo_url,
      ) ?? null
    : null;
  const showsDetails = (['name', 'phone', 'email'] as const).some((field) => (fields[field] ?? 'optional') !== 'hidden');

  const renderQuestion = (question: PublicQuestion) => {
    const answer = answers[question.id];
    const choiceType = question.type === 'single_choice' || question.type === 'multi_choice';

    return (
      <div className="space-y-4">
        {question.type === 'star' && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAnswer(question.id, { value })}
                className="p-1 hover:scale-125 transition-transform"
                aria-label={`${value} star${value > 1 ? 's' : ''}`}
              >
                <Star
                  className={`w-10 h-10 ${
                    Number(answer?.value || 0) >= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-zinc-600'
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {question.type === 'emoji' && question.options.length === 0 && (
          <div className="flex items-center justify-between text-4xl pt-2">
            {SMILEYS.map((smiley) => (
              <button
                key={smiley.value}
                type="button"
                onClick={() => setAnswer(question.id, { value: smiley.value })}
                className={`p-2 rounded-2xl transition-all ${
                  answer?.value === smiley.value ? 'scale-125' : 'opacity-60 hover:opacity-100 hover:scale-110'
                }`}
                style={answer?.value === smiley.value ? { boxShadow: `0 0 0 2px ${brand}` } : undefined}
              >
                <span>{smiley.icon}</span>
              </button>
            ))}
          </div>
        )}

        {question.type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
            {['Yes', 'No'].map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setAnswer(question.id, { value: choice.toLowerCase() })}
                className={`py-3.5 rounded-2xl font-bold border transition-colors ${
                  answer?.value === choice.toLowerCase()
                    ? choice === 'Yes'
                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500'
                      : 'bg-rose-500/15 text-rose-500 border-rose-500'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {(choiceType || (question.type === 'emoji' && question.options.length > 0)) && (
          <div className="space-y-2 text-sm">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAnswer(question.id, { option_id: option.id })}
                className={`w-full text-start p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  answer?.option_id === option.id
                    ? 'font-bold'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
                style={answer?.option_id === option.id ? { borderColor: brand, color: brand, backgroundColor: `${brand}1A` } : undefined}
              >
                <span>{option.label}</span>
                {answer?.option_id === option.id && <CheckCircle2 className="w-4 h-4" />}
              </button>
            ))}
          </div>
        )}

        {question.type === 'nps' && (
          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 text-sm font-mono font-bold pt-1">
            {Array.from({ length: 11 }, (_, number) => number).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setAnswer(question.id, { value: number })}
                className={`py-3 rounded-xl text-center transition-colors ${
                  answer?.value === number ? 'text-white' : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20'
                }`}
                style={answer?.value === number ? { backgroundColor: brand } : undefined}
              >
                {number}
              </button>
            ))}
          </div>
        )}

        {needsFollowUp(question) && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-rose-500">We are sorry to hear that. What went wrong? *</label>
            <textarea
              rows={3}
              value={answer?.free_text ?? ''}
              onChange={(e) => setAnswer(question.id, { free_text: e.target.value })}
              className="w-full p-3 rounded-xl text-sm bg-white dark:bg-black/30 border border-rose-500/40"
            />
          </div>
        )}

        {question.type === 'text' && (
          <textarea
            rows={5}
            value={answer?.free_text ?? ''}
            onChange={(e) => setAnswer(question.id, { free_text: e.target.value })}
            placeholder="Write any thoughts, compliments, or issues..."
            className="w-full p-3 rounded-xl text-sm bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10"
          />
        )}
      </div>
    );
  };

  const currentQuestion = step >= 1 && step <= questions.length ? questions[step - 1] : null;
  const progress = Math.round((step / lastStep) * 100);

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-100 dark:bg-[#070709] py-6 px-4 flex flex-col items-center justify-start text-slate-900 dark:text-white"
    >
      <div className="w-full max-w-lg min-h-[82vh] flex flex-col rounded-[32px] bg-white dark:bg-[#121217] border border-slate-200 dark:border-white/10 shadow-2xl p-6 sm:p-8">
        {loadError && (
          <div className="py-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
            <p className="text-sm font-bold">This feedback form is not available</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{loadError}</p>
          </div>
        )}

        {!data && !loadError && (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {data && thanks && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <GuestHero
              brand={brand}
              name={data.organization.name}
              subtitle={`${data.location.name} · ${data.branch.name}`}
              celebrate
              logoSrc={logoSrc}
            />
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-xl font-bold">{thanks.title}</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">{thanks.message}</p>
              <button
                type="button"
                onClick={startAnother}
                className="w-full py-2.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Submit another response
              </button>
            </div>
          </div>
        )}

        {data && !thanks && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            {step === 0 ? (
              <GuestHero
                brand={brand}
                name={data.organization.name}
                subtitle={`${data.location.name} · ${data.branch.name}`}
                logoSrc={logoSrc}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold text-lg shadow-md"
                    style={{ backgroundColor: brand }}
                  >
                    {logoSrc ? <img src={logoSrc} alt="" className="w-full h-full object-cover" /> : data.organization.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {data.organization.name} · {data.location.name}
                  </p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: brand }} />
                </div>
              </div>
            )}

            <div key={step} className="fms-step flex-1 pt-6 space-y-5">
              {step === 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-1 text-center">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: brand }}>
                    {data.messages.welcome_title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{data.messages.welcome_text}</p>
                  <p className="pt-2 text-[11px] text-slate-400">
                    {questions.length} quick question{questions.length === 1 ? '' : 's'}
                  </p>
                </div>
              )}

              {currentQuestion && (
                <div className="p-4 rounded-3xl bg-slate-50/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: brand }}>
                      Question {step} of {questions.length}
                    </span>
                    <p className="text-base font-bold leading-snug">
                      {currentQuestion.text} {currentQuestion.is_required && <span className="text-rose-500">*</span>}
                    </p>
                  </div>
                  {renderQuestion(currentQuestion)}
                </div>
              )}

              {step === lastStep && (
                <div className="space-y-4">
                  <div className="space-y-1 text-center">
                    <h3 className="text-base font-bold">{showsDetails ? 'Almost done' : 'Ready to send'}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {showsDetails ? 'Leave your details so we can follow up if needed.' : 'Press the button to send your feedback.'}
                    </p>
                  </div>

                  {(
                    [
                      { key: 'name', label: 'Your name', type: 'text' },
                      { key: 'phone', label: 'Phone number', type: 'tel' },
                      { key: 'email', label: 'Email address', type: 'email' },
                    ] as const
                  ).map((field) => {
                    const mode = fields[field.key] ?? 'optional';
                    if (mode === 'hidden') return null;
                    return (
                      <div key={field.key}>
                        <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          {field.label} {mode === 'required' ? '*' : '(optional)'}
                        </label>
                        <input
                          type={field.type}
                          required={mode === 'required'}
                          value={customer[field.key]}
                          onChange={(e) => setCustomer((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    );
                  })}

                  {data.captcha.enabled && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Quick check: {data.captcha.question}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {submitError && <p className="pt-3 text-xs font-semibold text-rose-500">{submitError}</p>}

            <div className="pt-5 flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="shrink-0 w-12 h-12 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rtl:rotate-180"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              {step < lastStep ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 py-3.5 rounded-full text-sm font-extrabold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                  style={{ backgroundColor: brand }}
                >
                  <span>{step === 0 ? 'Start feedback' : 'Continue'}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 rounded-full text-sm font-extrabold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{ backgroundColor: brand }}
                >
                  <span>{isSubmitting ? 'Sending...' : 'Submit feedback'}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
