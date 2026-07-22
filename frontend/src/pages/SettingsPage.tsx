import { Bell, GitBranch, LogOut, MessageSquare, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { ErrorState, LoadingPanel } from '../components/common/States';
import { StatusDot } from '../components/common/Logo';
import { useProfile, useReviewSettings } from '../hooks/useDashboardData';
import { useAuthStore } from '../store/authStore';

export function SettingsPage() {
  const profile = useProfile();
  const reviewSettings = useReviewSettings();
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  if (profile.isLoading) return <LoadingPanel rows={7} />;
  if (profile.isError) return <ErrorState message={profile.error.message} retry={() => profile.refetch()} />;
  const data = profile.data!;

  function signOut() {
    logout();
    navigate('/login');
  }

  return (
    <>
      <PageHeader eyebrow="Workspace settings" title="Profile and integrations." description="Manage your GitHub identity, connected repositories, and notification delivery." />
      <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-6">
          <article className="panel p-6">
            <p className="eyebrow">GitHub profile</p>
            <div className="mt-5 flex items-center gap-4">
              <img className="size-14 rounded-2xl bg-stone-100" src={data.avatarUrl} alt="" />
              <div><h2 className="font-display text-lg font-semibold">{data.name}</h2><p className="text-sm text-stone-500">@{data.login}</p></div>
            </div>
            <div className="mt-6 rounded-xl bg-stone-50 p-4 text-xs dark:bg-ink"><div className="flex justify-between"><span className="text-stone-500">Plan</span><span>{data.plan}</span></div><div className="mt-3 flex justify-between"><span className="text-stone-500">Mode</span><span>{data.demo ? 'Demo workspace' : 'GitHub connected'}</span></div></div>
            <button className="button-secondary mt-5 w-full" onClick={signOut}><LogOut size={15} /> Sign out</button>
          </article>
          <article className="panel p-6">
            <p className="eyebrow">Security</p>
            <div className="mt-4 flex gap-3"><ShieldCheck className="text-emerald-500" /><div><p className="text-sm font-medium">JWT session active</p><p className="mt-1 text-xs leading-5 text-stone-500">Sessions are signed by the GitSense backend and expire automatically.</p></div></div>
          </article>
        </div>
        <div className="space-y-6">
          <article className="panel p-6">
            <p className="eyebrow">Notification channels</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Delivery integrations</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Integration icon={MessageSquare} name="Slack" active={data.integrations.slack} />
              <Integration icon={Bell} name="Microsoft Teams" active={data.integrations.teams} />
            </div>
          </article>
          <article className="panel p-6">
            <p className="eyebrow">Preferences</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Alert policy</h2>
            <div className="mt-5 space-y-3">
              <Preference label="Critical risk reviews" enabled={data.notificationPreferences.critical} />
              <Preference label="High risk reviews" enabled={data.notificationPreferences.high} />
              <Preference label="Low confidence reviews" enabled={data.notificationPreferences.lowConfidence} />
            </div>
          </article>
          <article className="panel p-6">
            <p className="eyebrow">Review mode</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Pipeline profile</h2>
            {reviewSettings.data ? (
              <div className="mt-5 space-y-3">
                <Preference label="AI review enabled" enabled={reviewSettings.data.includeAiReview} />
                <Preference label="Semantic context enabled" enabled={Boolean(reviewSettings.data.includeSemanticContext)} />
                <div className="rounded-xl bg-stone-50 p-4 text-xs dark:bg-ink">
                  <div className="flex justify-between"><span className="text-stone-500">Mode</span><span>{reviewSettings.data.mode}</span></div>
                  <div className="mt-3 flex justify-between"><span className="text-stone-500">Gemini retries</span><span>{reviewSettings.data.geminiRetries}</span></div>
                  <div className="mt-3 flex justify-between"><span className="text-stone-500">Gemini timeout</span><span>{reviewSettings.data.geminiTimeoutMs}ms</span></div>
                </div>
                <p className="text-xs leading-5 text-stone-500">Change `REVIEW_MODE`, `REVIEW_INCLUDE_RAG`, `REVIEW_INCLUDE_AI`, `GEMINI_REVIEW_TIMEOUT_MS`, and `GEMINI_REVIEW_MAX_RETRIES` in `.env`, then restart the backend.</p>
              </div>
            ) : <p className="mt-4 text-sm text-stone-500">Review settings unavailable.</p>}
          </article>
          <article className="panel p-6">
            <div className="flex items-center gap-3"><GitBranch /><div><p className="text-sm font-medium">Connected repositories</p><p className="text-xs text-stone-500">{data.connectedRepositories.length} GitHub repositories available</p></div></div>
          </article>
        </div>
      </section>
    </>
  );
}

function Integration({ icon: Icon, name, active }: { icon: typeof Bell; name: string; active: boolean }) {
  return <div className="rounded-xl border p-4"><div className="flex items-center justify-between"><Icon size={18} /><span className="flex items-center gap-2 text-[11px] text-stone-500"><StatusDot active={active} /> {active ? 'Connected' : 'Not configured'}</span></div><p className="mt-5 text-sm font-medium">{name}</p></div>;
}

function Preference({ label, enabled }: { label: string; enabled: boolean }) {
  return <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3 dark:bg-ink"><span className="text-sm">{label}</span><span className={`relative h-6 w-11 rounded-full ${enabled ? 'bg-signal' : 'bg-stone-300 dark:bg-line'}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} /></span></div>;
}
