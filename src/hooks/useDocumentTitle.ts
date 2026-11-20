import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const APP = 'Coach Clawde'

/**
 * Sets the tab / window title for the screen on show, front-loaded with
 * what's unique to it ("Upper Body · Coach Clawde"), so screens can be told
 * apart in the app switcher and screen readers announce where you are after
 * a navigation. App.tsx resets it to the app's name on each route change, so
 * a screen that doesn't set one never keeps the previous screen's.
 */
export function useDocumentTitle(title: string | undefined) {
  // Re-applied on every route change too: the reset runs first.
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP
  }, [title, pathname])
}

export function resetDocumentTitle() {
  document.title = APP
}
