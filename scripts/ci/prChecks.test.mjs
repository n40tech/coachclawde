import { describe, expect, it } from 'vitest'
import {
  checklistVerdict,
  collectResults,
  isTestFile,
  labelVerdict,
  newTestVerdict,
  skipReason,
} from './prChecks.mjs'

const body = (checklist) => `Closes #12

## Try it on your phone

1. Open a workout

## Review checklist

${checklist}
`

describe('checklistVerdict', () => {
  it('passes when every review box is ticked', () => {
    const v = checklistVerdict(body('- [x] I read the whole diff\n- [X] I tried it on my phone'))
    expect(v.ok).toBe(true)
  })

  it('fails and names each unticked box', () => {
    const v = checklistVerdict(body('- [x] I read the whole diff\n- [ ] I tried it on my phone'))
    expect(v.ok).toBe(false)
    expect(v.unticked).toEqual(['I tried it on my phone'])
  })

  it('fails when the PR body has no review checklist', () => {
    expect(checklistVerdict('Just a description').ok).toBe(false)
  })

  it('ignores ticked boxes outside the review checklist section', () => {
    const v = checklistVerdict(`## Steps\n\n- [x] something\n\n## Review checklist\n\n- [ ] I read the whole diff\n`)
    expect(v.ok).toBe(false)
    expect(v.unticked).toEqual(['I read the whole diff'])
  })

  it('stops reading the checklist at the next heading', () => {
    const v = checklistVerdict(body('- [x] I read the whole diff') + '\n## Notes\n\n- [ ] a later todo\n')
    expect(v.ok).toBe(true)
  })
})

describe('labelVerdict', () => {
  it('passes with exactly one release type label', () => {
    expect(labelVerdict(['feature', 'manual-test']).ok).toBe(true)
  })

  it('fails with no release type label', () => {
    expect(labelVerdict(['manual-test']).ok).toBe(false)
  })

  it('fails with two release type labels', () => {
    expect(labelVerdict(['feature', 'fix']).ok).toBe(false)
  })
})

describe('skipReason', () => {
  it('skips UI-only PRs labelled manual-test', () => {
    expect(skipReason(['feature', 'manual-test'])).toMatch(/manual-test/)
  })

  it('skips internal PRs', () => {
    expect(skipReason(['internal'])).toMatch(/internal/)
  })

  it('runs for features and fixes', () => {
    expect(skipReason(['fix'])).toBeNull()
  })
})

describe('isTestFile', () => {
  it('recognises test files in any of the repo’s languages', () => {
    expect(isTestFile('src/lib/units.test.ts')).toBe(true)
    expect(isTestFile('src/components/Row.test.tsx')).toBe(true)
    expect(isTestFile('scripts/ci/prChecks.test.mjs')).toBe(true)
  })

  it('does not treat modules or snapshots as test files', () => {
    expect(isTestFile('src/lib/units.ts')).toBe(false)
    expect(isTestFile('src/lib/__snapshots__/goalFlow.test.ts.snap')).toBe(false)
  })
})

const ROOT = '/repo'
const vitestJson = (files) => ({
  testResults: files.map(({ file, status = 'passed', tests = [] }) => ({
    name: `${ROOT}/${file}`,
    status,
    assertionResults: tests.map(([fullName, s]) => ({ fullName, status: s })),
  })),
})

describe('collectResults', () => {
  it('keys each test by its file and full name', () => {
    const r = collectResults(
      vitestJson([{ file: 'src/lib/units.test.ts', tests: [['units converts kg', 'passed']] }]),
      ROOT,
    )
    expect(r.tests.get('src/lib/units.test.ts :: units converts kg')).toBe('passed')
  })

  it('records a file that failed to load as broken', () => {
    const r = collectResults(vitestJson([{ file: 'src/lib/new.test.ts', status: 'failed' }]), ROOT)
    expect(r.brokenFiles.has('src/lib/new.test.ts')).toBe(true)
  })
})

describe('newTestVerdict', () => {
  const results = (files) => collectResults(vitestJson(files), ROOT)
  const file = 'src/lib/units.test.ts'

  it('passes when the new test fails on main', () => {
    const v = newTestVerdict({
      head: results([{ file, tests: [['old', 'passed'], ['rounds lb', 'passed']] }]),
      base: results([{ file, tests: [['old', 'passed']] }]),
      onMain: results([{ file, tests: [['old', 'passed'], ['rounds lb', 'failed']] }]),
    })
    expect(v.ok).toBe(true)
    expect(v.failing).toEqual([`${file} :: rounds lb`])
  })

  it('fails and names a new test that already passes on main', () => {
    const v = newTestVerdict({
      head: results([{ file, tests: [['rounds lb', 'passed'], ['tick box', 'passed']] }]),
      base: results([]),
      onMain: results([{ file, tests: [['rounds lb', 'failed'], ['tick box', 'passed']] }]),
    })
    expect(v.ok).toBe(false)
    expect(v.hollow).toEqual([`${file} :: tick box`])
  })

  it('fails when no test fails on main', () => {
    const v = newTestVerdict({
      head: results([{ file, tests: [['old', 'passed']] }]),
      base: results([{ file, tests: [['old', 'passed']] }]),
      onMain: results([{ file, tests: [['old', 'passed']] }]),
    })
    expect(v.ok).toBe(false)
    expect(v.failing).toEqual([])
  })

  it('counts a changed existing test that now fails on main', () => {
    const v = newTestVerdict({
      head: results([{ file, tests: [['old', 'passed']] }]),
      base: results([{ file, tests: [['old', 'passed']] }]),
      onMain: results([{ file, tests: [['old', 'failed']] }]),
    })
    expect(v.ok).toBe(true)
  })

  it('counts every test in a file that cannot load on main as failing there', () => {
    const newFile = 'src/lib/plates.test.ts'
    const v = newTestVerdict({
      head: results([{ file: newFile, tests: [['loads the bar', 'passed']] }]),
      base: results([]),
      onMain: results([{ file: newFile, status: 'failed' }]),
    })
    expect(v.ok).toBe(true)
    expect(v.failing).toEqual([`${newFile} :: loads the bar`])
  })
})
