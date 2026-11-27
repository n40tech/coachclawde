// CI: checks the PR carries exactly one release label.
//
//   node scripts/ci/check-pr-body.mjs label   (reads PR_LABELS, a JSON array)
//
// Run by .github/workflows/pr-body.yml; the rule lives in prChecks.mjs.

import { labelVerdict } from './prChecks.mjs'

const mode = process.argv[2]

if (mode === 'label') {
  const v = labelVerdict(JSON.parse(process.env.PR_LABELS || '[]'))
  if (v.ok) console.log(v.message)
  else fail(v.message)
} else {
  fail(`Unknown mode "${mode}": use "label".`)
}

function fail(message) {
  console.log(`::error::${message.replaceAll('\n', '%0A')}`)
  process.exit(1)
}
