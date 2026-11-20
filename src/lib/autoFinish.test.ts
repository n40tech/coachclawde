import { describe, expect, it } from 'vitest'
import { AUTO_FINISH_GRACE_MS, autoFinishTarget, graceOver } from './autoFinish'
import type { LoggedExercise } from '../types'

const ex = (id: string, done: boolean[]): LoggedExercise => ({
  plannedExerciseId: id,
  name: id,
  sets: done.map((completed, setIndex) => ({ setIndex, targetReps: '8', completed, skipped: false })),
})

describe('graceOver', () => {
  it('ignores taps for the first seconds after a rest', () => {
    expect(graceOver(1000, 1000 + AUTO_FINISH_GRACE_MS - 1)).toBe(false)
    expect(graceOver(1000, 1000 + AUTO_FINISH_GRACE_MS)).toBe(true)
  })
})

describe('autoFinishTarget', () => {
  const list = [ex('a', [true, false]), ex('b', [false, false])]

  it('finishes the open set that was touched', () => {
    expect(autoFinishTarget(list, { exerciseIdx: 1, setIndex: 1 }, 0)).toEqual({ exerciseIdx: 1, setIndex: 1 })
  })

  it('otherwise the next open set, in the touched exercise or the one in progress', () => {
    expect(autoFinishTarget(list, {}, 0)).toEqual({ exerciseIdx: 0, setIndex: 1 })
    expect(autoFinishTarget(list, { exerciseIdx: 1 }, 0)).toEqual({ exerciseIdx: 1, setIndex: 0 })
    // A done set was touched: fall back to the next open one.
    expect(autoFinishTarget(list, { exerciseIdx: 0, setIndex: 0 }, 0)).toEqual({ exerciseIdx: 0, setIndex: 1 })
  })

  it('returns null when everything is done', () => {
    expect(autoFinishTarget([ex('a', [true])], {}, 0)).toBeNull()
  })
})
