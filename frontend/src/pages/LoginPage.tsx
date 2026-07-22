import { GitBranch, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { githubLoginUrl } from '../api/auth';
import { Logo } from '../components/common/Logo';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const error = params.get('message');

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [navigate, token]);

  function login() {
    setLoading(true);
    window.location.assign(githubLoginUrl());
  }

  return (
    <main className="grid min-h-screen bg-ink text-white lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden overflow-hidden border-r border-line p-12 lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(184,243,74,.16),transparent_28%)]" />
        <div className="relative"><Logo /></div>
        <div className="relative my-auto max-w-xl">
          <p className="eyebrow !text-signal">Architectural PR intelligence</p>
          <h1 className="mt-5 font-display text-6xl font-semibold leading-[1.02] tracking-[-0.055em]">
            See the risk<br />before it ships.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-stone-400">
            Multi-agent reviews, dependency intelligence, and architecture signals in one operational workspace.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            <Feature icon={ShieldCheck} label="Risk-aware reviews" />
            <Feature icon={Sparkles} label="Context-rich findings" />
          </div>
        </div>
        <p className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
          Built for engineering teams who care about systems
        </p>
      </section>

      <section className="flex items-center justify-center bg-sand px-6 text-stone-900 dark:bg-ink dark:text-white">
        <div className="w-full max-w-md">
          <div className="mb-12 lg:hidden"><Logo /></div>
          <p className="eyebrow">Welcome to GitSense</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Your review command center.</h2>
          <p className="mt-4 text-sm leading-6 text-stone-500">
            Sign in with GitHub to connect repositories and explore review intelligence.
          </p>
          {error && (
            <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}
          <button className="button-primary mt-8 w-full !py-3" disabled={loading} onClick={login}>
            {loading ? <LoaderCircle className="animate-spin" size={18} /> : <GitBranch size={18} />}
            {loading ? 'Connecting to GitHub…' : 'Continue with GitHub'}
          </button>
          <p className="mt-5 text-center text-[11px] leading-5 text-stone-500">
            GitSense requests profile and repository access to display connected review data.
          </p>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel/70 p-4 text-sm text-stone-300">
      <Icon size={17} className="text-signal" /> {label}
    </div>
  );
}
