import { describe, expect, it } from 'vitest'
import { createRestAlarmController, MIN_ARM_MS, type AlarmRequest } from './restAlarmController'

function setup(opts: { prepared?: string | null } = {}) {
  let now = 1_000_000
  let hidden = false
  let ids = 0
  const armed: { prepared: string; request: AlarmRequest }[] = []
  const cancelled: string[] = []
  const resolvers: ((v: string | null) => void)[] = []
  const controller = createRestAlarmController<string>({
    now: () => now,
    isHidden: () => hidden,
    newId: () => `alarm-${++ids}`,
    prepare: () =>
      opts.prepared === undefined
        ? Promise.resolve('token+sub')
        : new Promise((resolve) => {
            resolvers.push(resolve)
          }),
    arm: (prepared, request) => armed.push({ prepared, request }),
    cancel: (_prepared, alarmId) => cancelled.push(alarmId),
  })
  const flush = () => new Promise((r) => setTimeout(r, 0))
  return {
    controller,
    armed,
    cancelled,
    flush,
    /** Resolves the latest pending prepare (or the `index`th). */
    resolvePrepare: (v: string | null, index = resolvers.length - 1) => resolvers[index](v),
    advance: (ms: number) => (now += ms),
    hide: () => {
      hidden = true
      controller.hidden()
    },
    show: () => {
      hidden = false
      controller.shown()
    },
    get now() {
      return now
    },
  }
}

describe('rest alarm controller', () => {
  it('does nothing while the app stays on screen', async () => {
    const t = setup()
    t.controller.start(t.now + 90_000, 'Up next: Squat · set 2', '/session/s1')
    await t.flush()
    t.advance(90_000)
    t.controller.stop()
    expect(t.armed).toHaveLength(0)
    expect(t.cancelled).toHaveLength(0)
  })

  it('arms once when hidden mid-rest, for the time that is left', async () => {
    const t = setup()
    t.controller.start(t.now + 90_000, 'Up next: Squat · set 2', '/session/s1')
    await t.flush()
    t.advance(30_000)
    t.hide()
    t.hide()
    expect(t.armed).toEqual([
      {
        prepared: 'token+sub',
        request: { alarmId: 'alarm-1', delayMs: 60_000, title: 'Rest over', body: 'Up next: Squat · set 2', url: '/session/s1' },
      },
    ])
  })

  it('cancels when the athlete comes back before the rest ends', async () => {
    const t = setup()
    t.controller.start(t.now + 90_000, 'x', '/')
    await t.flush()
    t.hide()
    t.advance(20_000)
    t.show()
    expect(t.cancelled).toEqual(['alarm-1'])
    // Hidden again: armed again for the remainder.
    t.hide()
    expect(t.armed.map((a) => a.request.delayMs)).toEqual([90_000, 70_000])
  })

  it("doesn't cancel an alarm that has already gone off", async () => {
    const t = setup()
    t.controller.start(t.now + 60_000, 'x', '/')
    await t.flush()
    t.hide()
    t.advance(75_000)
    t.show()
    t.controller.stop()
    expect(t.cancelled).toHaveLength(0)
    expect(t.controller.state()).toBeNull()
  })

  it('skips rests that are about to end anyway', async () => {
    const t = setup()
    t.controller.start(t.now + 60_000, 'x', '/')
    await t.flush()
    t.advance(60_000 - MIN_ARM_MS + 1)
    t.hide()
    expect(t.armed).toHaveLength(0)
  })

  it('arms as soon as it is ready if the phone was locked first', async () => {
    const t = setup({ prepared: null })
    t.controller.start(t.now + 60_000, 'x', '/')
    t.hide()
    expect(t.armed).toHaveLength(0)
    t.resolvePrepare('late')
    await t.flush()
    expect(t.armed).toHaveLength(1)
    expect(t.armed[0].prepared).toBe('late')
  })

  it('never arms when alerts are off', async () => {
    const t = setup({ prepared: null })
    t.controller.start(t.now + 60_000, 'x', '/')
    t.resolvePrepare(null)
    await t.flush()
    t.hide()
    expect(t.armed).toHaveLength(0)
  })

  it('ignores a slow prepare from a rest that was replaced', async () => {
    const t = setup({ prepared: null })
    t.controller.start(t.now + 60_000, 'first', '/')
    t.controller.start(t.now + 90_000, 'second', '/')
    t.resolvePrepare('stale', 0)
    await t.flush()
    expect(t.controller.state()).toEqual({ alarmId: 'alarm-2', armed: false, prepared: false })
  })

  it('cancels the armed alarm when a rest is stopped', async () => {
    const t = setup()
    t.controller.start(t.now + 60_000, 'x', '/')
    await t.flush()
    t.hide()
    t.controller.stop()
    expect(t.cancelled).toEqual(['alarm-1'])
  })
})
