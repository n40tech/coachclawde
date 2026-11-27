import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettingsStore } from '../store/useSettingsStore'
import { useAppStore } from '../store/useAppStore'
import { useAutoSync } from '../hooks/useAutoSync'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/shared/Button'
import { Card, CardSection } from '../components/shared/Card'
import { SyncIndicator } from '../components/shared/SyncIndicator'
import { UserCircle, CheckCircle, AlertCircle, RefreshCw, LogOut, Sparkles, ChevronRight, Info, ShieldCheck, Bell, Timer } from 'lucide-react'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { Switch } from '../components/shared/Switch'
import { ChoiceChip, ChoiceGroup } from '../components/shared/Choice'
import { APP_VERSION } from '../lib/appVersion'
import { getDeviceShape } from '../lib/deviceShape'
import { ageFromBirthDate, isValidBirthDate } from '../lib/dateUtils'
import { toLocalISODate } from '../lib/weekUtils'
import { fromWeight, toWeight, type DistanceUnit, type WeightUnit } from '../lib/units'
import { checkRestAlerts, disableRestAlerts, enableRestAlerts, prepareRestAlerts, restAlertSupport, sendTestAlert } from '../lib/restAlerts'
import type { UserProfile } from '../types'

export function Settings() {
  const { user, configured, signOut } = useAuth()
  const { syncStatus, syncError, units, setUnits } = useSettingsStore()
  const { profile, setProfile } = useAppStore()
  const { sync } = useAutoSync()

  const [name, setName] = useState(profile.name ?? '')
  const [weight, setWeight] = useState(String(toWeight(profile.weightKg, units.weight)))
  const [height, setHeight] = useState(String(profile.heightCm))
  const [sex, setSex] = useState<UserProfile['sex']>(profile.sex)
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '')
  const age = ageFromBirthDate(birthDate)
  const [profileSaved, setProfileSaved] = useState(false)
  const [confirmHealth, setConfirmHealth] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  // Changes made here that haven't reached the account (lib/outbox): signing out would lose them.
  const pendingChanges = useAppStore((s) => s.outbox.length)
  const healthFlags = profile.goal?.health.flags ?? []

  /**
   * Health-screen answers are special-category data: let the athlete delete
   * them. Injuries stay (they're edited by the athlete and safety-critical),
   * but the medical flags and conservative mode go.
   */
  function deleteHealthInfo() {
    if (!profile.goal) return
    const flags = profile.injuries.length ? (['injury'] as const) : []
    setProfile({ goal: { ...profile.goal, health: { ...profile.goal.health, flags: [...flags], conservative: undefined, cleared: undefined }, updatedAt: new Date().toISOString() } })
    void sync('profile')
    setConfirmHealth(false)
  }

  function setWeightUnit(u: WeightUnit) {
    // Keep the body-weight field showing the same weight in the new unit.
    if (Number(weight)) setWeight(String(toWeight(fromWeight(Number(weight), units.weight), u)))
    setUnits({ weight: u })
  }

  function handleSaveProfile() {
    // Never wipe a previously-set name with a blank field.
    const nextName = name.trim() || profile.name
    setName(nextName)
    setProfile({
      name: nextName,
      weightKg: Number(weight) ? fromWeight(Number(weight), units.weight) : profile.weightKg,
      heightCm: Number(height) || profile.heightCm,
      sex,
      // Blank clears it; a half-typed or out-of-range date keeps the old one.
      birthDate: birthDate === '' ? undefined : isValidBirthDate(birthDate) ? birthDate : profile.birthDate,
    })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
    // Push the freshly-saved profile so details survive a future restore.
    void sync('profile')
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#0a0a0a] pb-edge">
      <PageHeader title="Settings" backTo="/progress" />

      <div className="flex flex-col gap-5 px-4 pt-4">
        {/* Account & Sync */}
        <div>
          <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">
            Account &amp; Sync
          </h2>
          <Card accent={!!user}>
            <CardSection>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCircle size={18} className="text-[#f5f5f0] shrink-0" />
                  <span className="text-sm font-semibold text-[#f5f5f0] truncate">
                    {user?.email ?? (configured ? 'Signed out' : 'Local mode')}
                  </span>
                </div>
                <SyncIndicator />
              </div>

              {user ? (
                <div className="flex flex-col gap-3">
                  <div className="text-xs text-[#949494] leading-relaxed bg-[#1a1a1a] rounded-2xl px-4 py-3">
                    <p className="font-medium text-[#a8a29e] mb-1">✓ Syncing to your account</p>
                    <p>Workouts and plans save to the cloud automatically, and load each time you open the app. Sign in on any device to pick up where you left off.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => sync('all')} fullWidth>
                      <RefreshCw size={14} />
                      Sync now
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => (pendingChanges ? setConfirmSignOut(true) : signOut())} fullWidth>
                      <LogOut size={14} />
                      Sign out
                    </Button>
                  </div>
                  {/* Always in the page, so a failed sync is announced. */}
                  <div role="alert">
                    {syncStatus === 'error' && (
                      <div className="flex items-start gap-2 text-red-400 bg-red-500/10 rounded-xl p-3">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
                        <p className="text-xs">{syncError}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#949494] leading-relaxed">
                  {configured
                    ? 'You are signed out. Data is stored only on this device until you sign in.'
                    : 'Running in local-only mode — no backend is configured, so data stays on this device.'}
                </p>
              )}
            </CardSection>
          </Card>
        </div>

        {/* Profile */}
        <div>
          <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">Profile</h2>
          <Card>
            <CardSection className="flex flex-col gap-3">
              <p className="text-xs text-[#949494] leading-relaxed">
                Saved to your account and included in the plan prompt so Clawde can program around your details.
              </p>
              <Field label="Name" htmlFor="settings-name">
                <input
                  id="settings-name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`Weight (${units.weight})`} htmlFor="settings-weight">
                  <input
                    id="settings-weight"
                    inputMode="decimal"
                    placeholder={units.weight === 'lb' ? '180' : '81'}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Height (cm)" htmlFor="settings-height">
                  <input
                    id="settings-height"
                    inputMode="numeric"
                    placeholder="184"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field
                label="Date of birth"
                htmlFor="settings-birth-date"
                hint={age !== undefined ? `${age} years old. Clawde uses this to pitch your training.` : 'Optional. Clawde uses your age to pitch your training.'}
              >
                <input
                  id="settings-birth-date"
                  autoComplete="bday"
                  aria-describedby="settings-birth-date-hint"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  min="1900-01-01"
                  max={toLocalISODate(new Date())}
                  style={{ colorScheme: 'dark' }}
                  className={inputClass}
                />
              </Field>
              <ChoiceGroup legend="Gender" legendClassName="block text-xs font-medium text-[#a8a29e] mb-1.5" className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <ChoiceChip key={g} name="settings-gender" value={g} checked={sex === g} onChange={() => setSex(g)} className={toggleLook(sex === g)}>
                    <span className="capitalize">{g}</span>
                  </ChoiceChip>
                ))}
              </ChoiceGroup>
              <Button variant="secondary" onClick={handleSaveProfile} fullWidth>
                {profileSaved ? <CheckCircle size={16} /> : null}
                {profileSaved ? 'Saved' : 'Save profile'}
              </Button>
              {/* The button's label change isn't reliably read out; this is. */}
              <p role="status" className="sr-only">{profileSaved ? 'Profile saved' : ''}</p>
            </CardSection>
          </Card>
        </div>

        {/* Units */}
        <div>
          <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">Units</h2>
          <Card>
            <CardSection className="flex flex-col gap-3">
              <p className="text-xs text-[#949494] leading-relaxed">
                How weights and distances are shown on this device. Clawde always plans in metric; the app converts.
              </p>
              <UnitToggle legend="Weight" name="unit-weight" options={['kg', 'lb'] as WeightUnit[]} value={units.weight} onChange={setWeightUnit} />
              <UnitToggle legend="Distance" name="unit-distance" options={['km', 'mi'] as DistanceUnit[]} value={units.distance} onChange={(d) => setUnits({ distance: d })} />
            </CardSection>
          </Card>
        </div>

        <RestAlertsSetting />

        <BetaFeatures />

        {/* Health */}
        <div>
          <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">Privacy</h2>
          <Card>
            <CardSection className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#d97756]/15 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="text-[#d97756]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#f5f5f0]">Health screen</p>
                <p className="text-xs text-[#949494] mt-0.5 leading-relaxed">
                  {healthFlags.some((f) => f !== 'injury')
                    ? 'We keep only which boxes you ticked (never any details) so plans stay safe. You can delete them.'
                    : 'Nothing stored beyond your injury list. We only ever keep which boxes you tick, never details.'}
                </p>
                {healthFlags.some((f) => f !== 'injury') && (
                  <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmHealth(true)}>
                    Delete health information
                  </Button>
                )}
              </div>
            </CardSection>
          </Card>
        </div>

        {/* Onboarding */}
        <div>
          <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">Onboarding</h2>
          <Card>
            <Link to="/onboarding" className="block w-full text-left">
              <CardSection className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#d97756]/15 flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-[#d97756]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#f5f5f0]">Redo onboarding</p>
                  <p className="text-xs text-[#949494] mt-0.5">
                    Start over with a new goal. Your history stays.
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#858585] shrink-0" aria-hidden />
              </CardSection>
            </Link>
          </Card>
        </div>

        {/* About */}
        <div>
          <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">About</h2>
          <Card>
            <CardSection className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#d97756]/15 flex items-center justify-center shrink-0">
                <Info size={18} className="text-[#d97756]" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#f5f5f0]">Coach Clawde</p>
                <p className="text-xs text-[#949494] mt-0.5">Version {APP_VERSION}</p>
              </div>
            </CardSection>
          </Card>
          <DisplayInfo />
        </div>
      </div>

      {confirmSignOut && (
        <ConfirmDialog
          icon={<LogOut size={20} />}
          title="Sign out anyway?"
          confirmLabel="Sign out"
          danger
          onConfirm={() => { setConfirmSignOut(false); void signOut() }}
          onCancel={() => setConfirmSignOut(false)}
        >
          {pendingChanges === 1 ? "1 change hasn't" : `${pendingChanges} changes haven't`} reached your account yet. Signing out
          now loses {pendingChanges === 1 ? 'it' : 'them'}. Try Sync now first if you're back online.
        </ConfirmDialog>
      )}

      {confirmHealth && (
        <ConfirmDialog
          icon={<ShieldCheck size={20} />}
          title="Delete health information?"
          confirmLabel="Delete"
          onConfirm={deleteHealthInfo}
          onCancel={() => setConfirmHealth(false)}
        >
          This removes the medical flags from your health screen, and plans stop being kept extra conservative.
          Your injury list stays (edit it by redoing onboarding).
        </ConfirmDialog>
      )}
    </div>
  )
}

/**
 * One line of screen geometry: what the app measured and what iOS reports.
 * Lets a tester screenshot the real numbers if the layout sits wrong on a
 * device we can't test.
 */
function DisplayInfo() {
  const shape = getDeviceShape()
  const probe = (side: string) => {
    const el = document.createElement('div')
    el.style.cssText = `position:absolute;visibility:hidden;padding-top:env(safe-area-inset-${side})`
    document.body.appendChild(el)
    const px = Math.round(parseFloat(getComputedStyle(el).paddingTop))
    el.remove()
    return px
  }
  const parts = [
    `${screen.width}×${screen.height}`,
    `viewport ${window.innerWidth}×${window.innerHeight}`,
    `safe ${probe('top')}/${probe('bottom')}`,
    shape.screenRadius ? `corners ${shape.screenRadius}pt` : 'corners —',
    shape.standalone ? `app${shape.viewportGap ? ` +${shape.viewportGap}` : ''}` : 'browser',
  ]
  return <p className="text-2xs text-[#858585] text-center mt-3 tabular-nums">Display: {parts.join(' · ')}</p>
}

/** Rest alerts: push notifications when a rest ends with the app in the background. */
function RestAlertsSetting() {
  const restAlerts = useSettingsStore((s) => s.restAlerts)
  const [support, setSupport] = useState(restAlertSupport)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  // Notice permission withdrawn in iOS Settings since the switch was turned on,
  // and get ready to subscribe within the tap.
  useEffect(() => {
    void checkRestAlerts()
    void prepareRestAlerts()?.catch(() => {})
  }, [])

  if (support === 'unsupported') return null
  const showInfo = support !== 'available' || restAlerts
  // Under the info section (sharing its padding) or in a section of its own.
  const messageClass = `px-5 pb-4 text-xs leading-relaxed ${showInfo ? '-mt-1' : 'pt-4'}`

  async function toggle() {
    setMessage(null)
    setBusy(true)
    // enableRestAlerts must be the first thing awaited: Safari only allows
    // subscribing (and its permission prompt) inside the tap.
    const result = restAlerts ? (await disableRestAlerts(), { ok: true as const }) : await enableRestAlerts()
    setBusy(false)
    setSupport(restAlertSupport())
    if (!result.ok) setMessage({ error: true, text: result.message })
  }

  async function test() {
    setMessage(null)
    setBusy(true)
    const result = await sendTestAlert()
    setBusy(false)
    setMessage(
      result.ok
        ? { error: false, text: 'Sent. It arrives in about 5 seconds: lock your phone to see it as you would mid-workout.' }
        : { error: true, text: result.message },
    )
  }

  return (
    <div>
      <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">Notifications</h2>
      <Card>
        <CardSection className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#d97756]/15 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-[#d97756]" />
          </div>
          <div className="flex-1 min-w-0">
            <p id="rest-alerts-title" className="text-sm font-semibold text-[#f5f5f0]">Rest alerts</p>
            <p id="rest-alerts-desc" className="text-xs text-[#949494] mt-0.5">A notification when rest is over, even with your phone locked.</p>
          </div>
          {support === 'available' && (
            <Switch checked={restAlerts} onChange={() => void toggle()} busy={busy} labelledBy="rest-alerts-title" describedBy="rest-alerts-desc" />
          )}
        </CardSection>
        {(showInfo || message) && <div className="border-t border-[#2a2a2a]" />}
        {showInfo && (
          <CardSection className="flex flex-col gap-3">
            {support === 'install' && (
              <p className="text-xs text-[#949494] leading-relaxed">
                On iPhone and iPad, add Coach Clawde to your Home Screen first (Share → Add to Home Screen), then open it
                from there and turn this on.
              </p>
            )}
            {support === 'blocked' && (
              <p className="text-xs text-[#949494] leading-relaxed">
                Notifications are turned off for Coach Clawde. Turn them on in your phone’s Settings → Notifications →
                Coach Clawde, then come back here.
              </p>
            )}
            {support === 'available' && restAlerts && (
              <Button variant="secondary" size="sm" onClick={test} loading={busy} className="self-start">
                Send a test alert
              </Button>
            )}
          </CardSection>
        )}
        {/* Always in the page, so a new message is announced (errors interrupt). */}
        <div role="status">
          {message && !message.error && <p className={`${messageClass} text-[#a8a29e]`}>{message.text}</p>}
        </div>
        <div role="alert">
          {message?.error && <p className={`${messageClass} text-red-400`}>{message.text}</p>}
        </div>
      </Card>
    </div>
  )
}

/** A labelled row. Pass `htmlFor` (the control's id) when it wraps a single input. */
function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-[#a8a29e]">{label}</label>
      {/* The input names this hint with aria-describedby={`${htmlFor}-hint`}. */}
      {hint && <p id={`${htmlFor}-hint`} className="text-2xs text-[#858585]">{hint}</p>}
      {children}
    </div>
  )
}

const inputClass = 'w-full bg-[#1a1a1a] border border-[#666666] rounded-2xl px-4 py-3 text-base text-[#f5f5f0] placeholder-[#858585] focus:outline-none focus:border-[#d97756] focus:ring-1 focus:ring-[#d97756] transition-colors'

function toggleLook(on: boolean): string {
  return `px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-150 ${
    on
      ? 'bg-accent-fill text-white shadow-lg shadow-[#d97756]/20'
      : 'bg-[#1a1a1a] text-[#949494] border border-[#2a2a2a] hover:text-[#a8a29e]'
  }`
}

/** Two units as a radio group (one of them is always picked). */
function UnitToggle<T extends string>({ legend, name, options, value, onChange }: { legend: string; name: string; options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <ChoiceGroup legend={legend} legendClassName="block text-xs font-medium text-[#a8a29e] mb-1.5" className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <ChoiceChip key={o} name={name} value={o} checked={value === o} onChange={() => onChange(o)} className={toggleLook(value === o)}>
          {o}
        </ChoiceChip>
      ))}
    </ChoiceGroup>
  )
}

/** Newer workout features that can be switched off while they settle in. */
function BetaFeatures() {
  const autoSetTimer = useSettingsStore((s) => s.autoSetTimer)
  const setAutoSetTimer = useSettingsStore((s) => s.setAutoSetTimer)
  return (
    <div>
      <h2 className="text-xs text-[#858585] uppercase tracking-widest font-medium px-1 mb-3">Beta features</h2>
      <Card>
        <CardSection className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#d97756]/15 flex items-center justify-center shrink-0">
            <Timer size={18} className="text-[#d97756]" />
          </div>
          <div className="flex-1 min-w-0">
            <p id="auto-finish-title" className="text-sm font-semibold text-[#f5f5f0]">Auto-finish sets</p>
            <p id="auto-finish-desc" className="text-xs text-[#949494] mt-0.5">After a rest and a 15-second grace period, your next tap finishes the set (orange tick) and starts the next rest. Fix reps or weight, then tap the tick to confirm.</p>
          </div>
          <Switch checked={autoSetTimer} onChange={setAutoSetTimer} labelledBy="auto-finish-title" describedBy="auto-finish-desc" />
        </CardSection>
      </Card>
    </div>
  )
}
