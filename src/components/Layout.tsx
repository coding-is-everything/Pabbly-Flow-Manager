import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { History, LayoutDashboard, LogOut, Menu, Search, Settings, Upload, Users, Workflow, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { MetaProvider } from '../lib/meta';
import { RoleBadge, cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/flows', label: 'Flows', icon: Workflow },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/import', label: 'Import / Export', icon: Upload },
  { to: '/activity', label: 'Activity', icon: History },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const links = isAdmin ? [...NAV, { to: '/users', label: 'Users', icon: Users }] : NAV;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600">
          <Workflow className="size-4.5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Pabbly Flow</div>
          <div className="text-[11px] text-indigo-200/80">Manager</div>
        </div>
      </div>
      <nav className="mt-4 flex-1 space-y-0.5 px-3">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <NavLink to="/account" className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-semibold text-white">
            {user?.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user?.name}</div>
            <div className="truncate text-xs text-slate-400">{user?.email}</div>
          </div>
          <Settings className="size-4 text-slate-400" />
        </NavLink>
        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <MetaProvider>
      <div className="min-h-screen">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-slate-900 lg:block">{sidebar}</aside>

        {/* Mobile sidebar */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-64 bg-slate-900">
              <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-slate-300" aria-label="Close menu">
                <X className="size-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="lg:pl-60">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
            <button onClick={() => setOpen(true)} className="text-slate-500 lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <form onSubmit={onSearch} className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search flows & steps — e.g. Gallabox, Razorpay, webhook…"
                className="h-9 w-full rounded-md bg-slate-100 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </form>
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              {user && <RoleBadge role={user.role} />}
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </MetaProvider>
  );
}
