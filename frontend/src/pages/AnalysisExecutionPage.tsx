import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Cpu, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Home, 
  RefreshCw 
} from 'lucide-react';
import { useReview, useReviewJobs, useReanalyzeReview } from '../hooks/useDashboardData';
import { ErrorState, LoadingPanel } from '../components/common/States';

const STAGE_LOGS: Record<string, string[]> = {
  queued: [
    '🤖 [Orchestrator] Initializing multi-agent graph state...',
    '📋 [Planner] Analyzing changes. Compiling execution plan...',
    '⚙️ System ready. Executing graph workflow nodes...'
  ],
  'fetching-files': [
    '📦 [Dependency] Scanning repository import graph...',
    '🔍 [Dependency] Calculating blast radius and coupling boundaries...',
    '📊 [Dependency] Dependency analysis complete: module hierarchy mapped.'
  ],
  analyzing: [
    '🧠 [Context] Querying ChromaDB semantic vector store...',
    '🤖 [Rules] Evaluating local architectural guidelines...',
    '🧠 [Review] Ingesting diff changes into Gemini review engine...',
    '🧠 [Review] Reviewing file modifications for coupling issues...',
    '⚠️ [Risk Intelligence] Computing security, performance, and maintenance risk scores...'
  ],
  persisting: [
    '🎯 [Smart Review] Filtering review suggestions for false positives...',
    '📝 [Risk Summary] Drafting executive review summary...',
    '🚀 [GitHub] Publishing check run and PR markdown review comment...',
    '🔔 [Notification] Sending alerts to configured Slack and Teams webhooks...'
  ],
  complete: [
    '🎉 [Orchestrator] Multi-agent execution workflow finished successfully!',
    '💾 [History] Persisted analysis report to MongoDB.',
    '✓ All systems clear. Redirecting to report...'
  ],
  failed: [
    '❌ [Orchestrator] Agent execution encountered a critical error.',
    '🛑 Execution halted.'
  ]
};

const STAGES_ORDER = ['queued', 'fetching-files', 'analyzing', 'persisting', 'complete', 'failed'];

interface AgentInfo {
  key: string;
  name: string;
  description: string;
}

const AGENTS: AgentInfo[] = [
  { key: 'orchestrator', name: 'Orchestrator Agent', description: 'Prepares graph execution state' },
  { key: 'planner', name: 'Planner Agent', description: 'Plans target file scan budgets' },
  { key: 'dependency', name: 'Dependency Agent', description: 'Computes modules coupling graphs' },
  { key: 'context', name: 'Context Agent', description: 'Queries semantic ChromaDB indices' },
  { key: 'ruleEngine', name: 'Rule Engine Agent', description: 'Matches deterministic guidelines' },
  { key: 'review', name: 'Review Agent', description: 'Generates Gemini code reviews' },
  { key: 'architecture', name: 'Architecture Agent', description: 'Checks boundary violations' },
  { key: 'riskIntelligence', name: 'Risk Intelligence', description: 'Assesses security and risks' },
  { key: 'smartReview', name: 'Smart Review Agent', description: 'Filters false positives' },
  { key: 'riskSummary', name: 'Risk Summary Agent', description: 'Drafts executive report details' },
  { key: 'github', name: 'GitHub Publisher', description: 'Publishes comments and check run' },
  { key: 'notification', name: 'Notification Agent', description: 'Pushes Slack and Teams webhooks' }
];

export function AnalysisExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const repoParam = searchParams.get('repository') || '';
  const prParam = Number(searchParams.get('pr') || '0');
  const isPendingPR = id === 'pending';

  const review = useReview(isPendingPR ? undefined : id);
  const jobs = useReviewJobs();
  const reanalyze = useReanalyzeReview();
  
  const [logs, setLogs] = useState<string[]>([]);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  // Find the current job for this review
  const currentJob = jobs.data?.find(job => {
    if (isPendingPR) {
      return job.repository === repoParam && job.pullNumber === prParam;
    }
    return job.repository === review.data?.repository && job.pullNumber === review.data?.prNumber;
  });

  // Accumulate console logs based on current stage
  useEffect(() => {
    if (!currentJob) return;

    const accumulatedLogs: string[] = [];
    const currentIdx = STAGES_ORDER.indexOf(currentJob.stage);
    
    if (currentIdx !== -1) {
      for (let i = 0; i <= currentIdx; i++) {
        const s = STAGES_ORDER[i];
        if (s === 'failed' && currentJob.status !== 'failed') continue;
        if (STAGE_LOGS[s]) {
          accumulatedLogs.push(...STAGE_LOGS[s]);
        }
      }
      setLogs(accumulatedLogs);
    }
  }, [currentJob?.stage, currentJob?.status]);

  // Terminal auto-scrolling
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Calculate live runtime ticker
  useEffect(() => {
    if (!currentJob || currentJob.status !== 'running') return;
    
    const start = new Date(currentJob.startedAt).getTime();
    const interval = setInterval(() => {
      setRuntimeSeconds(Math.max(1, Math.round((Date.now() - start) / 1000)));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentJob?.status, currentJob?.startedAt]);

  // Handle successful completion redirect
  useEffect(() => {
    if (currentJob?.status === 'completed') {
      setShowSuccessScreen(true);
      if (!isPendingPR) {
        review.refetch(); // Fetch latest review metrics (risk score, confidence, etc.)
      }
      
      const redirectId = isPendingPR ? currentJob.reviewHistoryId : id;
      if (redirectId) {
        const timer = setTimeout(() => {
          navigate(`/reviews/${redirectId}`);
        }, 3000); // 3 seconds display
        return () => clearTimeout(timer);
      }
    }
  }, [currentJob?.status, currentJob?.reviewHistoryId, id, isPendingPR, navigate]);

  // Determine active agent key based on stage and progress
  function getActiveAgentKey(stage: string, progress: number): string {
    if (stage === 'queued') return 'orchestrator';
    if (stage === 'fetching-files') return 'dependency';
    if (stage === 'analyzing') {
      if (progress < 45) return 'context';
      if (progress < 60) return 'review';
      if (progress < 75) return 'architecture';
      return 'riskIntelligence';
    }
    if (stage === 'persisting') {
      if (progress < 90) return 'smartReview';
      return 'github';
    }
    return 'notification';
  }

  // Get status of specific agent in list
  function getAgentStatus(agentKey: string): 'pending' | 'running' | 'completed' | 'failed' {
    if (!currentJob) return 'pending';
    
    if (currentJob.status === 'failed') {
      const active = getActiveAgentKey(currentJob.stage, currentJob.progress);
      if (active === agentKey) return 'failed';
    }
    
    if (currentJob.status === 'completed') return 'completed';
    
    const order = AGENTS.map(a => a.key);
    const activeAgent = getActiveAgentKey(currentJob.stage, currentJob.progress);
    const activeIdx = order.indexOf(activeAgent);
    const agentIdx = order.indexOf(agentKey);
    
    if (agentIdx < activeIdx) return 'completed';
    if (agentIdx === activeIdx) return 'running';
    return 'pending';
  }

  if (!isPendingPR && review.isLoading) return <LoadingPanel rows={8} />;
  if (!isPendingPR && review.isError) return <ErrorState message={review.error.message} retry={() => review.refetch()} />;

  const data = review.data || {
    repository: repoParam,
    prNumber: prParam,
    title: currentJob?.title || `Analyzing PR #${prParam}`,
    riskScore: 0,
    confidence: 0,
    githubPublicationStatus: 'Pending',
    notificationStatus: 'Pending'
  };
  
  // Calculate final runtime
  const calculatedRuntime = currentJob?.completedAt && currentJob?.startedAt
    ? `${Math.max(1, Math.round((new Date(currentJob.completedAt).getTime() - new Date(currentJob.startedAt).getTime()) / 1000))}s`
    : `${runtimeSeconds}s`;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <span className="font-mono text-xs text-stone-500">{data.repository} · PR #{data.prNumber}</span>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{data.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {currentJob?.status === 'running' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              <Loader2 className="animate-spin" size={13} /> Analyzing...
            </span>
          )}
          {currentJob?.status === 'completed' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              ✓ Ready
            </span>
          )}
          {currentJob?.status === 'failed' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-500">
              ⚠ Failed
            </span>
          )}
        </div>
      </header>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr] relative">
        {/* Left Column: Agents Timeline */}
        <section className="panel p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu size={18} />
            <h2 className="font-display text-base font-semibold">Agent execution pipeline</h2>
          </div>
          
          <div className="relative border-l border-stone-200 dark:border-line ml-3 mt-6 pl-6 space-y-5">
            {AGENTS.map((agent) => {
              const status = getAgentStatus(agent.key);
              return (
                <div key={agent.key} className="relative">
                  {/* Status dot */}
                  <span className={`absolute -left-[31px] top-1 grid size-5 place-items-center rounded-full border bg-white dark:bg-panel ${
                    status === 'completed' ? 'border-emerald-500 bg-emerald-50 text-emerald-500' :
                    status === 'running' ? 'border-lime-500 ring-4 ring-lime-500/10' :
                    status === 'failed' ? 'border-rose-500 bg-rose-50 text-rose-500' :
                    'border-stone-200 text-stone-300'
                  }`}>
                    {status === 'completed' && <span className="size-2 rounded-full bg-emerald-500" />}
                    {status === 'running' && <span className="size-2 rounded-full bg-lime-500 animate-pulse" />}
                    {status === 'failed' && <span className="size-2 rounded-full bg-rose-500" />}
                    {status === 'pending' && <span className="size-1.5 rounded-full bg-stone-300 dark:bg-line" />}
                  </span>
                  
                  <div>
                    <h4 className={`text-xs font-semibold ${
                      status === 'running' ? 'text-lime-500 font-display' : 
                      status === 'pending' ? 'text-stone-400' : 'text-stone-700 dark:text-stone-200'
                    }`}>{agent.name}</h4>
                    <p className="text-[10px] text-stone-500 mt-0.5">{agent.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Console / Timeline Logs */}
        <section className="flex flex-col h-[520px] rounded-2xl border border-stone-200 bg-stone-950 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between bg-stone-900 border-b border-stone-800 px-4 py-3">
            <div className="flex items-center gap-2 text-stone-300 font-mono text-xs">
              <Terminal size={14} />
              <span>execution_logs.sh</span>
            </div>
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-stone-700" />
              <span className="size-2.5 rounded-full bg-stone-700" />
              <span className="size-2.5 rounded-full bg-stone-700" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-stone-300 space-y-2 leading-relaxed">
            {logs.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-stone-600 select-none">[{calculatedRuntime}]</span>
                <span className={
                  log.startsWith('❌') || log.startsWith('🛑') ? 'text-rose-400 font-semibold' :
                  log.startsWith('✓') || log.startsWith('🎉') ? 'text-emerald-400 font-semibold' :
                  log.startsWith('🤖') ? 'text-lime-400' : 'text-stone-300'
                }>{log}</span>
              </div>
            ))}
            {currentJob?.status === 'running' && (
              <div className="flex gap-2 items-center text-stone-500 animate-pulse">
                <span>[{calculatedRuntime}]</span>
                <Loader2 size={12} className="animate-spin" />
                <span>Waiting for next workflow node...</span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </section>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-panel/95 backdrop-blur border-t border-stone-200 dark:border-line -mx-6 -mb-6 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-stone-100 dark:bg-ink">
            <div className="h-full bg-signal transition-all duration-500" style={{ width: `${currentJob?.progress || 5}%` }} />
          </div>
          <span className="font-mono text-xs text-stone-500">{currentJob?.progress || 5}%</span>
        </div>
        <div className="flex gap-3 w-full sm:w-auto justify-end">
          <button
            className="button-primary w-full sm:w-auto"
            onClick={() => navigate(`/reviews/${currentJob?.reviewHistoryId || id}`)}
            disabled={!showSuccessScreen}
          >
            Open Final Report <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Success overlay transition screen */}
      {showSuccessScreen && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="panel max-w-md w-full bg-white dark:bg-panel p-6 text-center border-emerald-500/20 shadow-2xl space-y-6">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">✓ Analysis Complete</h2>
              <p className="text-sm text-stone-500 mt-2">Aggregating multi-agent results...</p>
            </div>
            
            <div className="border-t border-b py-4 space-y-2.5 text-left text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Total Runtime:</span><span className="font-mono font-semibold">{calculatedRuntime}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Agents Executed:</span><span className="font-mono font-semibold">12</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Risk Score:</span><span className="font-mono font-semibold">{data.riskScore.toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Confidence:</span><span className="font-mono font-semibold">{data.confidence}%</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Review Published:</span><span className="font-mono font-semibold text-emerald-500">{data.githubPublicationStatus || 'Success'}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Notifications Sent:</span><span className="font-mono font-semibold text-emerald-500">{data.notificationStatus || 'Success'}</span></div>
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => navigate(`/reviews/${currentJob?.reviewHistoryId || id}`)}
                className="button-primary w-full"
              >
                Go to Report Now
              </button>
              <p className="text-[10px] text-stone-400">Redirecting automatically in a moment...</p>
            </div>
          </div>
        </div>
      )}

      {/* Failure screen display */}
      {currentJob?.status === 'failed' && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="panel max-w-md w-full bg-white dark:bg-panel p-6 text-center border-rose-500/20 shadow-2xl space-y-6">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-rose-500/10 text-rose-500">
              <AlertCircle size={36} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-rose-500">Analysis Failed</h2>
              <p className="text-sm text-stone-500 mt-2">The pipeline halted during agent execution.</p>
            </div>
            
            <div className="rounded-xl bg-stone-50 dark:bg-ink p-4 text-left border space-y-3">
              <div>
                <span className="text-[10px] uppercase tracking-wide text-stone-500 block">Failed Step:</span>
                <span className="text-xs font-semibold text-rose-500 font-mono">
                  {getActiveAgentKey(currentJob.stage, currentJob.progress)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-stone-500 block">Error Message:</span>
                <p className="text-xs font-mono text-stone-600 dark:text-stone-300 mt-1 break-words">
                  {currentJob.error?.message || 'Workflow run was cancelled.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                onClick={() => {
                  if (id) {
                    reanalyze.mutate(id);
                  }
                }}
                disabled={reanalyze.isPending}
                className="button-primary flex-1 gap-2"
              >
                <RefreshCw size={14} className={reanalyze.isPending ? 'animate-spin' : ''} /> Retry Analysis
              </button>
              <button 
                onClick={() => navigate('/')}
                className="button-secondary flex-1 gap-2"
              >
                <Home size={14} /> Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
