import { describe, expect, it } from 'vitest'
import { nextOpenSet, promoteStarted, reorderByIds } from './exerciseOrder'
import type { LoggedExercise } from '../types'

const ex = (id: string, done: boolean[]): LoggedExercise => ({
  plannedExerciseId: id,
  name: id,
  sets: done.map((completed, setIndex) => ({ setIndex, targetReps: '8', completed, skipped: false })),
})
const ids = (list: LoggedExercise[]) => list.map((e) => e.plannedExerciseId)

describe('reorderByIds', () => {
  it('follows the given order and keeps unlisted exercises at the end', () => {
    expect(ids(reorderByIds([ex('a', []), ex('b', []), ex('c', [])], ['c', 'a', 'zz']))).toEqual(['c', 'a', 'b'])
  })
})

describe('promoteStarted', () => {
  it('moves a newly started exercise ahead of unstarted ones', () => {
    const list = [ex('a', [true, false]), ex('b', [false]), ex('c', [false]), ex('d', [false])]
    expect(ids(promoteStarted(list, 2))).toEqual(['a', 'c', 'b', 'd'])
  })

  it('leaves the order alone when nothing unstarted is ahead, or it was already started', () => {
    const list = [ex('a', [true]), ex('b', [false])]
    expect(promoteStarted(list, 1)).toBe(list)
    const started = [ex('a', [false]), ex('b', [true, false])]
    expect(promoteStarted(started, 1)).toBe(started)
  })
})

describe('nextOpenSet', () => {
  it('prefers the exercise being worked on, then list order', () => {
    const list = [ex('a', [true, false]), ex('b', [false, false])]
    expect(nextOpenSet(list, 1)).toEqual({ exerciseIdx: 1, setIndex: 0 })
    expect(nextOpenSet([ex('a', [true]), ex('b', [true, false])], 0)).toEqual({ exerciseIdx: 1, setIndex: 1 })
    expect(nextOpenSet([ex('a', [true])], 0)).toBeNull()
  })
})
