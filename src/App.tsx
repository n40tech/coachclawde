import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, type Location } from 'react-router-dom'
import { isAcceptedAlertUrl } from './lib/alertLink'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyPendingUpdate } from './lib/appUpdate'
import type { ReactNode } from 'react'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { BottomNav } from './components/layout/BottomNav'
import { SideNav } from './components/layout/SideNav'
import { EdgeSwipeBack } from './components/layout/EdgeSwipeBack'
import { FixedLayer } from './components/layout/FixedLayer'
import { PageSuspense } from './components/layout/PageSuspense'
import { useAppStore } from './store/useAppStore'
import { Home } from './pages/Home'
import { Session } from './pages/Session'
import { useKeyboardInset } from './hooks/useKeyboardInset'
import { lazyPage } from './lib/lazyPage'
import { focusNewScreen } from './lib/viewTransition'
import { resetDocumentTitle } from './hooks/useDocumentTitle'

// Home and Session (with the movement guides) are in the entry
// chunk: the workout path never waits on a chunk, and an update can't pull a
// chunk out from under a workout (see lib/lazyPage). Everything else loads on
// first visit.
const Login = lazyPage(() => import('./pages/Login'), 'Login')
const Onboarding = lazyPage(() => import('./pages/Onboarding'), 'Onboarding')
const CheckIn = lazyPage(() => import('./pages/CheckIn'), 'CheckIn')
const WeekPlanner = lazyPage(() => import('./pages/WeekPlanner'), 'WeekPlanner')
const History = lazyPage(() => import('./pages/History'), 'History')
const Progress = lazyPage(() => import('./pages/Progress'), 'Progress')
const Program = lazyPage(() => import('./pages/Program'), 'Program')
const ProgramEdit = lazyPage(() => import('./pages/ProgramEdit'), 'ProgramEdit')
const BestEfforts = lazyPage(() => import('./pages/BestEfforts'), 'BestEfforts')
const Settings = lazyPage(() => import('./pages/Settings'), 'Settings')

function App() {
  useKeyboardInset()

  return (
    <AuthProvider>
      <BrowserRouter>
        <UpdateOnNavigate />
        <ServiceWorkerLinks />
        <RouteChange />
        {/* The `app` container drives the phone ↔ iPad layout switch: container
            queries (`@3xl/app:`) rather than media queries, so the shell
            responds to the space it actually has. */}
        <div className="@container/app w-full min-h-svh relative bg-abyss overflow-x-clip">
          {/* Backs the translucent iOS status bar so content scrolling up on
              header-less screens (Home) doesn't run under the clock and
              Dynamic Island. Zero-height where there's no top inset. */}
          <FixedLayer>
            <div aria-hidden className="absolute top-0 inset-x-0 h-(--safe-top) bg-abyss/90 backdrop-blur-xl pointer-events-none" />
          </FixedLayer>
          <Routes>
            <Route path="/login" element={<PhoneColumn><Login /></PhoneColumn>} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <Routes>
                    <Route path="/onboarding" element={<PhoneColumn><Onboarding /></PhoneColumn>} />
                    <Route path="/check-in" element={<RequireOnboarded><PhoneColumn><CheckIn /></PhoneColumn></RequireOnboarded>} />
                    <Route
                      path="/*"
                      element={
                        <RequireOnboarded>
                          <MainApp />
                        </RequireOnboarded>
                      }
                    />
                  </Routes>
                </RequireAuth>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

/**
 * First-run gate: until the athlete has completed onboarding, every in-app route
 * redirects to the onboarding chat. Existing accounts are treated as
 * onboarded (see the Supabase column default / `rowToProfile`).
 */
function RequireOnboarded({ children }: { children: ReactNode }) {
  const onboarded = useAppStore((s) => s.profile.onboarded)
  if (!onboarded) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

/**
 * A downloaded update waits while the athlete is mid-workout or mid-chat;
 * leaving that screen is the next safe moment to switch to it.
 */
function UpdateOnNavigate() {
  const { pathname } = useLocation()
  useEffect(() => {
    applyPendingUpdate()
  }, [pathname])
  return null
}

/**
 * On each route change: the title goes back to the app's name before the new
 * screen sets its own (hooks/useDocumentTitle), and if focus was left on the
 * old screen (the card that was tapped is gone), it moves to the new screen's
 * heading. A lazily loaded screen may take a moment to have one.
 */
function RouteChange() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useLayoutEffect(() => {
    resetDocumentTitle()
  }, [pathname])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    let tries = 0
    let timer = 0
    const frame = requestAnimationFrame(function attempt() {
      if (!focusNewScreen() && ++tries < 10) timer = window.setTimeout(attempt, 50)
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [pathname])
  return null
}

/**
 * A tapped rest alert, with the app already open: the service worker
 * (public/push-sw.js) focuses the app and posts the alert's path, opened here
 * in-app (the workout at the exercise up next).
 */
function ServiceWorkerLinks() {
  const navigate = useNavigate()
  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
    if (!sw) return
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: unknown; url?: unknown } | null
      if (d?.type === 'open-url' && typeof d.url === 'string' && isAcceptedAlertUrl(d.url)) navigate(d.url)
    }
    sw.addEventListener('message', onMessage)
    // Deliver any message that arrived before this listener.
    sw.startMessages()
    return () => sw.removeEventListener('message', onMessage)
  }, [navigate])
  return null
}

/** Single centred phone-width column, for the screens without navigation. */
function PhoneColumn({ children }: { children: ReactNode }) {
  return (
    <main className="block w-full max-w-md mx-auto min-h-svh relative">
      <PageSuspense>{children}</PageSuspense>
    </main>
  )
}

/** What's under a workout opened first thing (a deep link, a rest alert). */
const HOME_UNDER: Location = { pathname: '/', search: '', hash: '', state: null, key: 'home-under' }

const isWorkout = (pathname: string) => pathname.startsWith('/session/')

/**
 * Signed-in shell. Phones: one column with the floating tab bar. At 48rem+
 * (iPad, wide windows): sidebar on the left and a wider content column.
 *
 * The workout (`/session/…`) is a sheet over the screen it was opened from
 * (components/session/WorkoutSheet): that screen stays rendered underneath,
 * as it was, and the sheet slides down to reveal it.
 */
function MainApp() {
  const page = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const workout = isWorkout(location.pathname)
  const [under, setUnder] = useState<Location | null>(workout ? null : location)
  if (!workout && under !== location) setUnder(location)
  const background = workout ? under ?? HOME_UNDER : location
  return (
    <div className="flex min-h-svh">
      <SideNav />
      <main className="app-main flex-1 min-w-0 @3xl/app:pr-(--safe-right)">
        <div ref={page} className="w-full max-w-md @3xl/app:max-w-xl @5xl/app:max-w-2xl mx-auto min-h-svh relative">
          <PageSuspense>
            <Routes location={background}>
              <Route path="/" element={<Home />} />
              <Route path="/plan" element={<WeekPlanner />} />
              <Route path="/history" element={<History />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/progress/best-efforts" element={<BestEfforts />} />
              <Route path="/program" element={<Program />} />
              <Route path="/program/edit" element={<ProgramEdit />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </PageSuspense>
        </div>
      </main>
      {workout && (
        <Routes>
          <Route path="/session/:id" element={<Session />} />
          <Route path="/session/:id/next/:exerciseId" element={<Session />} />
        </Routes>
      )}
      <BottomNav />
      <EdgeSwipeBack target={page} />
    </div>
  )
}

export default App
