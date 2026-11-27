// Pure rules behind the PR merge checks (.github/workflows/pr-body.yml and
// tests-fail-on-main.yml). The CI scripts beside this file do the I/O.

/** Release type labels: a PR carries exactly one; the Release step reads them. */
export const TYPE_LABELS = ['feature', 'fix', 'internal']

/** Labels whose PRs need no test that fails on main. */
const NO_NEW_TEST_LABELS = {
  'manual-test': 'labelled manual-test: UI only, checked on the phone.',
  internal: 'labelled internal: nothing visible changed.',
}

export function isTestFile(path) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
}

/**
 * Reads the "## Review checklist" section of a PR body. `ok` only when the
 * section exists, has boxes and every one is ticked.
 */
export function checklistVerdict(body) {
  const lines = body.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+Review checklist\s*$/i.test(l))
  if (start === -1) return { ok: false, unticked: [] }
  const items = []
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break
    const m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)\s*$/)
    if (m) items.push({ ticked: m[1] !== ' ', text: m[2] })
  }
  const unticked = items.filter((i) => !i.ticked).map((i) => i.text)
  return { ok: items.length > 0 && unticked.length === 0, unticked }
}

export function labelVerdict(labels) {
  const types = labels.filter((l) => TYPE_LABELS.includes(l))
  if (types.length === 1) return { ok: true, message: `Release label: ${types[0]}.` }
  const list = TYPE_LABELS.join(', ')
  return {
    ok: false,
    message: types.length
      ? `Only one release label allowed, found: ${types.join(', ')}.`
      : `Add exactly one release label: ${list}.`,
  }
}

/** Why the fail-on-main check doesn't apply to this PR, or null when it does. */
export function skipReason(labels) {
  const label = Object.keys(NO_NEW_TEST_LABELS).find((l) => labels.includes(l))
  return label ? NO_NEW_TEST_LABELS[label] : null
}

/**
 * Flattens a Vitest JSON report into `"<file> :: <full name>" → status`, plus
 * the files that failed before running any test (an import or syntax error).
 */
export function collectResults(report, root) {
  const tests = new Map()
  const brokenFiles = new Set()
  const prefix = root.replaceAll('\\', '/').replace(/\/$/, '') + '/'
  for (const file of report.testResults ?? []) {
    const abs = file.name.replaceAll('\\', '/')
    const rel = abs.startsWith(prefix) ? abs.slice(prefix.length) : abs
    const results = file.assertionResults ?? []
    if (file.status === 'failed' && results.length === 0) brokenFiles.add(rel)
    for (const t of results) tests.set(`${rel} :: ${t.fullName}`, t.status)
  }
  return { tests, brokenFiles }
}

/**
 * head: the PR's tests on the PR's code. base: main's versions of those test
 * files on main. onMain: the PR's tests on main's code.
 * `failing` are the PR's tests that fail on main; `hollow` are newly named
 * tests that pass there. ok when something fails and nothing new is hollow.
 */
export function newTestVerdict({ head, base, onMain }) {
  const failsOnMain = (key) =>
    onMain.tests.has(key) ? onMain.tests.get(key) === 'failed' : onMain.brokenFiles.has(key.split(' :: ')[0])
  const keys = [...head.tests.keys()]
  const failing = keys.filter(failsOnMain)
  const hollow = keys.filter((k) => !base.tests.has(k) && !failsOnMain(k))
  return { ok: failing.length > 0 && hollow.length === 0, failing, hollow }
}
