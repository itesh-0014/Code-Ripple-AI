import {
  Activity,
  BarChart3,
  Boxes,
  GitBranch,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  RadioTower,
  Settings,
  Sun,
  Timeline,
  X,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { Logo } from '../components/common/Logo';
import { useUIStore } from '../store/uiStore';
import { useEffect } from 'react';

const navigation = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Repositories', path: '/repositories', icon: Boxes },
  { label: 'Reviews', path: '/reviews', icon: GitBranch },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Architecture', path: '/architecture', icon: Activity },
  { label: 'Dependency graph', path: '/dependency-graph', icon: Network },
  { label: 'Timeline', path: '/timeline', icon: Timeline },
  { label: 'Operations', path: '/operations', icon: RadioTower },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export function DashboardLayout() {
  const { darkMode, sidebarOpen, toggleDarkMode, setSidebarOpen } = useUIStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-sand text-stone-900 dark:bg-ink dark:text-stone-100">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-white px-4 py-5 transition-transform dark:border-line dark:bg-panel lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex items-center justify-between px-2">
          <Logo />
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="mt-8 px-3">
          <p className="eyebrow">Workspace</p>
        </div>
        <nav className="mt-3 space-y-1">
          {navigation.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                isActive
                  ? 'bg-ink font-medium text-white dark:bg-signal dark:text-ink'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-line dark:hover:text-white',
              )}
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border bg-stone-50 p-4 dark:border-line dark:bg-ink">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500">System</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Operational
            </span>
          </div>
          <p className="text-xs leading-5 text-stone-500">Multi-agent review pipeline is connected.</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-sand/80 px-4 backdrop-blur-xl dark:border-line dark:bg-ink/80 md:px-8">
          <button className="rounded-xl border bg-white p-2.5 dark:border-line dark:bg-panel lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500 lg:flex">
            <span className="size-1.5 rounded-full bg-signal" />
            Live repository intelligence
          </div>
          <button className="button-secondary ml-auto !p-2.5" onClick={toggleDarkMode} aria-label="Toggle color theme">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
