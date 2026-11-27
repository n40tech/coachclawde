// Pure rules behind the Release button (.github/workflows/release.yml).
// run-plan.mjs beside this file does the git and GitHub I/O.

const parse = (v) => v.split('.').map(Number)

/**
 * The next version after `last`, from the PRs merged since it: minor when any
 * is a `feature` or the release carries a database migration, else patch.
 * null when nothing was merged.
 */
export function nextVersion(last, prs, migrations) {
  if (prs.length === 0 && !migrations) return null
  const [major, minor, patch] = parse(last)
  const isMinor = migrations || prs.some((p) => p.labels.includes('feature'))
  return isMinor ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
}

/** Whether a release's changed files include migrations or Edge Function code. */
export function changedAreas(files) {
  return {
    migrations: files.some((f) => f.startsWith('supabase/migrations/')),
    functions: files.some((f) => f.startsWith('supabase/functions/')),
  }
}

/** The highest `vX.Y.Z` tag as "X.Y.Z", or null before the first release. */
export function latestRelease(tags) {
  const versions = tags.filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).map((t) => t.slice(1))
  versions.sort((a, b) => {
    const [pa, pb] = [parse(a), parse(b)]
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]
  })
  return versions.at(-1) ?? null
}
