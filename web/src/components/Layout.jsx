import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Logo from './Logo'
import { HomeIcon, ClientsIcon, PlusIcon } from './Icons'

const NAV = [
  { to: '/', label: 'All Open', Icon: HomeIcon, end: true },
  { to: '/clients', label: 'Clients', Icon: ClientsIcon, end: false },
  { to: '/new', label: 'New', Icon: PlusIcon, end: false },
]

function deskLink({ isActive }) {
  return [
    'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
    isActive ? 'bg-white/10 text-gold' : 'text-slate-300 hover:bg-white/5',
  ].join(' ')
}

function tabLink({ isActive }) {
  return [
    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 transition',
    isActive ? 'text-gold' : 'text-slate-400',
  ].join(' ')
}

export default function Layout() {
  const { email, signOut } = useAuth()

  return (
    <div className="flex h-full flex-col bg-navy md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-white/10 md:flex md:w-60 md:flex-col">
        <div className="px-5 py-5">
          <Logo variant="full" size="sm" className="text-slate-100" />
          <div className="mt-1.5 text-xs text-sage">Trade Instructions</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={deskLink}>
              <Icon width={20} height={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="truncate text-xs text-slate-400" title={email}>
            {email}
          </div>
          <button
            onClick={signOut}
            className="mt-1 text-xs font-medium text-gold hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 md:hidden">
        <Logo variant="full" size="sm" className="text-slate-100" />
        <button onClick={signOut} className="text-xs font-medium text-gold">
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={tabLink}>
            <Icon width={22} height={22} />
            <span className="text-[11px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
