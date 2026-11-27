// CI: proves a PR's tests test something new.
//
// Runs the tests the PR adds or changes against main's code (without the PR's
// source changes). A behaviour PR passes when at least one of them fails there
// and none of its newly named tests already pass there: a new test that passes
// on main can't be checking this PR's change.
//
// Expects the checkout GitHub makes for pull_request events: HEAD is the PR
// merged into main, so HEAD^1 is main. Reads PR_LABELS (a JSON array).
// Run by .github/workflows/tests-fail-on-main.yml; the rules live in prChecks.mjs.

import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { collectResults, isTestFile, newTestVerdict, skipReason } from './prChecks.mjs'

const MAIN = 'HEAD^1'
const repo = resolve('.')
const labels = JSON.parse(process.env.PR_LABELS || '[]')

const skip = skipReason(labels)
if (skip) {
  console.log(`Skipped: ${skip}`)
  process.exit(0)
}

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
const changed = git('diff', '--name-only', '--diff-filter=AMR', MAIN, 'HEAD').split('\n').filter(Boolean)
const testFiles = changed.filter(isTestFile)
const snapshots = changed.filter((f) => f.includes('__snapshots__/'))

if (testFiles.length === 0) {
  fail(
    'This PR changes behaviour (no manual-test or internal label) but adds or changes no tests. ' +
      'Add a test that fails on main, or label the PR manual-test (UI only) or internal (nothing visible changed).',
  )
}

const tmp = mkdtempSync(join(tmpdir(), 'fail-on-main-'))
const mainDir = join(tmp, 'main')
git('worktree', 'add', '--detach', mainDir, MAIN)

// Reuse the installed packages unless the PR changes them.
const depsChanged = changed.includes('package-lock.json')
if (depsChanged) run('npm', ['ci', '--no-audit', '--no-fund'], mainDir)
else symlinkSync(join(repo, 'node_modules'), join(mainDir, 'node_modules'), 'junction') // junction: ignored off Windows

// 1. The PR's tests on the PR's code: every test the PR has.
const head = vitest(repo, testFiles, 'head')

// 2. Main's own versions of those test files: the names that already existed.
const existingOnMain = testFiles.filter((f) => existsSync(join(mainDir, f)))
const base = existingOnMain.length ? vitest(mainDir, existingOnMain, 'base') : collectResults({ testResults: [] }, mainDir)

// 3. The PR's tests (and snapshots) on main's code.
for (const f of [...testFiles, ...snapshots]) cpSync(join(repo, f), join(mainDir, f), { recursive: true })
const onMain = vitest(mainDir, testFiles, 'on-main')

const v = newTestVerdict({ head, base, onMain })
const report = [
  '### New tests fail on main',
  '',
  v.failing.length ? `Fail on main (good):\n${v.failing.map((t) => `- ${t}`).join('\n')}` : 'No test fails on main.',
  v.hollow.length ? `\nNew tests that already pass on main (they don't test this change):\n${v.hollow.map((t) => `- ${t}`).join('\n')}` : '',
].join('\n')
console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)

if (!v.ok) {
  fail(
    v.failing.length === 0
      ? "None of this PR's tests fail on main, so none of them shows the change works. Add one that fails without the change."
      : 'Some new tests already pass on main (listed above). Make each one check this change, or remove it.',
  )
}

function vitest(cwd, files, label) {
  const out = join(tmp, `${label}.json`)
  // Exit code ignored: failing tests are the point. The JSON report is what counts.
  spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${out}`, ...files], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (!existsSync(out)) fail(`Vitest produced no report for the ${label} run; see the log above.`)
  return collectResults(JSON.parse(readFileSync(out, 'utf8')), cwd)
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} failed in ${dirname(cwd)}.`)
}

function fail(message) {
  console.log(`::error::${message}`)
  process.exit(1)
}
