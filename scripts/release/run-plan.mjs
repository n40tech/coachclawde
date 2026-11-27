// Release button, step 1: what would ship.
//
// Each release is one commit on the `production` branch, "Release vX.Y.Z",
// made on top of the `main` commit it ships and tagged vX.Y.Z. So the last
// release shipped main up to `v<last>^`, and this one ships everything on
// main's first-parent history since then.
//
// Writes `version`, `migrations` and `functions` to $GITHUB_OUTPUT (version
// is empty when there's nothing to release) and a summary to the job page.
// Needs GH_TOKEN for the GitHub API. The rules live in plan.mjs.

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { changedAreas, latestRelease, nextVersion } from './plan.mjs'

const sh = (cmd, ...args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()
const lines = (s) => s.split('\n').filter(Boolean)

const last = latestRelease(lines(sh('git', 'tag', '--list', 'v*')))
if (!last) fail('No vX.Y.Z tag found: the first release (v0.2.4) is tagged by hand. See docs/DEVELOPING.md → Releasing.')
const shipped = `v${last}^`

const commits = lines(sh('git', 'rev-list', '--first-parent', `${shipped}..HEAD`))
const prs = new Map()
for (const sha of commits) {
  const found = JSON.parse(sh('gh', 'api', `repos/{owner}/{repo}/commits/${sha}/pulls`))
  for (const p of found) {
    if (p.merged_at) prs.set(p.number, { number: p.number, title: p.title, labels: p.labels.map((l) => l.name) })
  }
}

const areas = changedAreas(lines(sh('git', 'diff', '--name-only', shipped, 'HEAD')))
const merged = [...prs.values()].sort((a, b) => a.number - b.number)
const version = nextVersion(last, merged, areas.migrations)

const summary = [
  version ? `## Release v${version}` : '## Nothing to release',
  '',
  `Last release: v${last}. ${merged.length} PR(s) merged since:`,
  ...merged.map((p) => `- #${p.number} ${p.title} (${p.labels.join(', ') || 'no labels'})`),
  '',
  `Database migrations: ${areas.migrations ? 'yes, applied before deploying' : 'none'}`,
  `Edge Function changes: ${areas.functions ? 'yes, redeployed' : 'none'}`,
].join('\n')
console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${version ?? ''}\nmigrations=${areas.migrations}\nfunctions=${areas.functions}\n`,
  )
}

function fail(message) {
  console.log(`::error::${message}`)
  process.exit(1)
}
