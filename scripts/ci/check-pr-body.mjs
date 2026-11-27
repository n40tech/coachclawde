// CI: checks the PR's review checklist or its release label.
//
//   node scripts/ci/check-pr-body.mjs checklist   (reads PR_BODY)
//   node scripts/ci/check-pr-body.mjs label       (reads PR_LABELS, a JSON array)
//
// Run by .github/workflows/pr-body.yml; the rules live in prChecks.mjs.

import { checklistVerdict, labelVerdict } from './prChecks.mjs'

const mode = process.argv[2]

if (mode === 'checklist') {
  const v = checklistVerdict(process.env.PR_BODY ?? '')
  if (v.ok) {
    console.log('Every box in the review checklist is ticked.')
  } else if (v.unticked.length === 0) {
    fail('The PR body has no "## Review checklist" section. Use .github/pull_request_template.md.')
  } else {
    fail(`Still to tick in the review checklist:\n${v.unticked.map((t) => `  - ${t}`).join('\n')}`)
  }
} else if (mode === 'label') {
  const v = labelVerdict(JSON.parse(process.env.PR_LABELS || '[]'))
  if (v.ok) console.log(v.message)
  else fail(v.message)
} else {
  fail(`Unknown mode "${mode}": use "checklist" or "label".`)
}

function fail(message) {
  console.log(`::error::${message.replaceAll('\n', '%0A')}`)
  process.exit(1)
}
