import { describe, expect, it } from 'vitest'
import { rubberBand, swipeCommits } from './swipe'

describe('swipeCommits', () => {
  it('acts on a long drag in the right direction', () => {
    expect(swipeCommits(70, 900, 1)).toBe(true)
    expect(swipeCommits(-70, 900, -1)).toBe(true)
    expect(swipeCommits(70, 900, -1)).toBe(false)
  })

  it('acts on a quick little flick', () => {
    expect(swipeCommits(-30, 50, -1)).toBe(true)
    // A gentle flick: 45 px in about a tenth of a second.
    expect(swipeCommits(-45, 110, -1)).toBe(true)
  })

  it('ignores a slow short drag and a tiny twitch', () => {
    expect(swipeCommits(40, 600, 1)).toBe(false)
    expect(swipeCommits(10, 5, 1)).toBe(false)
  })
})

describe('rubberBand', () => {
  it('follows the finger up to the limit, then resists', () => {
    expect(rubberBand(50, 100)).toBe(50)
    expect(rubberBand(-140, 100)).toBe(-110)
  })
})
