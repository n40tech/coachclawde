import { NavLink, useLocation } from 'react-router-dom'
import { NAV_ITEMS, hidesTabBar } from './navItems'
import { FixedLayer } from './FixedLayer'
import { WorkoutDockButton } from './WorkoutDock'
import { useWorkoutDock } from '../../hooks/useWorkoutDock'

/**
 * Floating tab bar for phone widths: a pill that hovers above the home
 * indicator and stays within the phone column. Hidden at sidebar widths
 * (see SideNav), on full-screen routes and on Settings. Geometry lives in the `--tabbar-*`
 * tokens in index.css, which pages clear with `pb-tabbar`.
 *
 * The destinations are links in a list (NavLink marks the current one with
 * `aria-current="page"`), so they're announced and behave as navigation.
 *
 * During a workout the bar squeezes right to make room for a little timer
 * circle on the left (WorkoutDock) that leads back to the workout.
 */
export function BottomNav() {
  const location = useLocation()
  const dock = useWorkoutDock()

  if (hidesTabBar(location.pathname)) return null

  return (
    <FixedLayer>
      <div className="absolute tabbar-dock @3xl/app:hidden flex gap-2">
      {dock && <WorkoutDockButton dock={dock} />}
      <nav aria-label="Primary" className="flex-1 min-w-0 h-full">
        <ul className="flex h-full rounded-(--tabbar-radius) p-(--tabbar-pad) bg-[#161616]/85 backdrop-blur-xl ring-1 ring-inset ring-[#2a2a2a] shadow-lg shadow-black/50">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
            <li key={path} className="flex-1 flex">
              <NavLink
                to={path}
                end
                className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-0.5 rounded-(--tabbar-item-radius) transition-colors duration-150 ${
                  isActive ? 'bg-[#d97756]/15 text-[#d97756]' : 'text-[#949494] hover:text-[#a8a29e]'
                }`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size="1.25em" strokeWidth={isActive ? 2.5 : 1.8} aria-hidden />
                    <span className="text-2xs font-medium leading-none">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      </div>
    </FixedLayer>
  )
}
