import { describe, expect, it } from 'vitest'
import { backAction, backSwipeCommits, setBackAction } from './backGesture'

describe('backSwipeCommits', () => {
  it('goes back past a third of the screen, or on a quick flick', () => {
    expect(backSwipeCommits(140, 900, 390)).toBe(true)
    expect(backSwipeCommits(60, 100, 390)).toBe(true)
  })

  it('springs back on a slow short drag', () => {
    expect(backSwipeCommits(100, 800, 390)).toBe(false)
    expect(backSwipeCommits(30, 20, 390)).toBe(false)
  })
})

describe('setBackAction', () => {
  it('only clears the action it set', () => {
    const a = () => {}
    const b = () => {}
    const offA = setBackAction(a)
    setBackAction(b)
    offA()
    expect(backAction()).toBe(b)
  })
})
