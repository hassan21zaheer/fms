import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import GatewayFlow from '../components/ui/gateway-flow';
import { ShineBorder } from '../components/ui/shine-border';
import { LiquidMetalBorder } from '../components/ui/liquid-metal-border';

export function LoginPage() {
  const { login, theme } = useApp();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden ${
        isDark ? 'bg-black text-white' : 'bg-[#EEF1F6] text-slate-900'
      }`}
    >
      {/* Gateway Flow background */}
      <GatewayFlow
        className="absolute inset-0"
        mode={isDark ? 'dark' : 'light'}
        density={1.1}
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-12">
        {/* Title */}
        <div className="mb-9 text-center">
          <h1
            className={`text-5xl font-thin uppercase tracking-[0.35em] md:text-6xl ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            FMS
          </h1>
          <p
            className={`mt-3 text-[10px] font-extralight uppercase tracking-[0.3em] ${
              isDark ? 'text-zinc-500' : 'text-slate-500'
            }`}
          >
            Feedback Management System
          </p>
        </div>

        {/* Card */}
        <ShineBorder
          borderRadius={16}
          borderWidth={1}
          duration={6}
          color={isDark ? '#ffffff' : '#0f172a'}
          className={`w-full max-w-sm rounded-2xl p-7 shadow-2xl backdrop-blur-xl ${
            isDark
              ? 'bg-black/70 shadow-black/60'
              : 'bg-white/70 shadow-slate-500/10'
          }`}
        >
          <form onSubmit={handleSubmit} className="relative z-20 space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className={`mb-1.5 block text-xs font-light uppercase tracking-widest ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                Email
              </label>
              <div
                className={`relative rounded-xl transition-colors duration-300 ${
                  isDark ? 'bg-white/[0.04]' : 'bg-white/60'
                }`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 rounded-xl border transition-colors duration-300 focus-within:border-transparent ${
                    isDark
                      ? 'border-white/[0.09]'
                      : 'border-slate-200'
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-0 rounded-xl p-[1px] opacity-0 transition-opacity duration-300 focus-within:opacity-100 [mask-composite:exclude] [-webkit-mask-composite:xor] [mask-image:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] ${
                    isDark
                      ? 'bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)]'
                      : 'bg-[linear-gradient(110deg,transparent,rgba(15,23,42,0.4),transparent)]'
                  }`}
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`relative z-20 w-full bg-transparent px-4 py-2.5 text-sm outline-none ${
                    isDark
                      ? 'text-white placeholder:text-zinc-700'
                      : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className={`mb-1.5 block text-xs font-light uppercase tracking-widest ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                Password
              </label>
              <div
                className={`relative rounded-xl transition-colors duration-300 ${
                  isDark ? 'bg-white/[0.04]' : 'bg-white/60'
                }`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 rounded-xl border transition-colors duration-300 focus-within:border-transparent ${
                    isDark
                      ? 'border-white/[0.09]'
                      : 'border-slate-200'
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-0 rounded-xl p-[1px] opacity-0 transition-opacity duration-300 focus-within:opacity-100 [mask-composite:exclude] [-webkit-mask-composite:xor] [mask-image:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] ${
                    isDark
                      ? 'bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.35),transparent)]'
                      : 'bg-[linear-gradient(110deg,transparent,rgba(15,23,42,0.4),transparent)]'
                  }`}
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`relative z-20 w-full bg-transparent pl-4 pr-10 py-2.5 text-sm outline-none ${
                    isDark
                      ? 'text-white placeholder:text-zinc-700'
                      : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-md p-1 transition-colors ${
                    isDark
                      ? 'text-zinc-600 hover:text-white'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs font-light tracking-wide text-rose-400">
                {error}
              </p>
            )}

            {/* Submit */}
            <LiquidMetalBorder
              borderRadius={12}
              borderWidth={1.5}
              duration={5}
              tone={isDark ? 'dark' : 'light'}
              className="mt-1 block w-full"
            >
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full rounded-xl py-3 text-xs font-light uppercase tracking-[0.25em] transition-all duration-300 disabled:opacity-70 ${
                  isDark
                    ? 'bg-white text-zinc-950'
                    : 'bg-slate-900 text-white'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSubmitting ? 'Signing in' : 'Sign in'}
                </span>
              </button>
            </LiquidMetalBorder>
          </form>
        </ShineBorder>
      </div>
    </div>
  );
}
