import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchDynamicType } from './lib/dynamicType'
import { watchDeviceShape } from './lib/deviceShape'
import { startUpdateChecks } from './lib/appUpdate'

// Follow the iOS text-size setting, and measure the installed iPhone app's
// real screen size and corner radius (both no-ops elsewhere).
watchDynamicType()
watchDeviceShape()
// Pick up new versions in the installed app (see lib/appUpdate).
startUpdateChecks()

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// Preview builds open on demo data (lib/demoData); `?demo=reset` starts it
// over. The import only exists in preview bundles: production builds drop it.
if (import.meta.env.VITE_DEMO_DATA === 'true') {
  void Promise.all([import('./lib/demoData'), import('./store/useAppStore'), import('./lib/appVersion')])
    .then(([{ buildDemoData, demoAction }, { useAppStore }, { markVersionSeen }]) => {
      const store = useAppStore.getState()
      const action = demoAction({ demoBuild: true, onboarded: !!store.profile.onboarded, search: location.search })
      if (action) {
        store.reset()
        store.restoreFromRemote({ ...buildDemoData(new Date()), checkIns: [] })
        markVersionSeen()
      }
      if (action === 'reset') history.replaceState(null, '', location.pathname)
    })
    .finally(render)
} else {
  render()
}
