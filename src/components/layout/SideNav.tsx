import { NavLink, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { ClawdeMark } from '../shared/ClawdeMark'
import { NAV_ITEMS, hidesSideNav, type NavItem } from './navItems'
import { WorkoutDockButton } from './WorkoutDock'
import { useWorkoutDock } from '../../hooks/useWorkoutDock'

const SETTINGS_ITEM: NavItem = { path: '/settings', icon: Settings, label: 'Settings' }

/**
 * Sidebar navigation for iPad and other wide layouts. Shown only when the app
 * container is at least 48rem wide — the same point where BottomNav hides — so
 * tablets get a sidebar instead of a stretched tab bar. Hidden on full-screen
 * routes, like the tab bar (but not under the workout sheet).
 */
export function SideNav() {
  const location = useLocation()
  const dock = useWorkoutDock()

  if (hidesSideNav(location.pathname)) return null

  const item = ({ path, icon: Icon, label }: NavItem) => (
    <li key={path}>
      <NavLink
        to={path}
        end
        className={({ isActive }) => `w-full flex items-center gap-3 h-11 px-3 rounded-2xl text-sm font-medium transition-colors duration-150 ${
          isActive ? 'bg-[#d97756]/15 text-[#d97756]' : 'text-[#949494] hover:bg-[#161616] hover:text-[#a8a29e]'
        }`}
      >
        {({ isActive }) => (
          <>
            <Icon size="1.125em" strokeWidth={isActive ? 2.5 : 1.8} aria-hidden />
            {label}
          </>
        )}
      </NavLink>
    </li>
  )

  return (
    <nav
      aria-label="Primary"
      className="hidden @3xl/app:flex sidebar-dock shrink-0 sticky top-0 h-svh flex-col gap-1 pr-3 pt-safe pb-edge border-r border-[#1a1a1a]"
    >
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-5">
        <ClawdeMark size={28} idle={false} />
        <span className="text-sm font-semibold text-[#f5f5f0]">Coach Clawde</span>
      </div>
      <ul className="flex flex-col gap-1">{NAV_ITEMS.map(item)}</ul>
      <div className="mt-auto flex flex-col gap-3">
        {/* The workout's clock, linking back to it (the tab bar's dock on phones). */}
        {dock && (
          <div className="flex items-center gap-3 px-1">
            <div className="h-14"><WorkoutDockButton dock={dock} /></div>
            <span className="text-xs text-[#a8a29e]">Back to workout</span>
          </div>
        )}
        <ul>{item(SETTINGS_ITEM)}</ul>
      </div>
    </nav>
  )
}
