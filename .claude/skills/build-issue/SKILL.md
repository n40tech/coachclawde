---
name: build-issue
description: Build one GitHub issue test-first and open it as a draft PR for review.
disable-model-invocation: true
---

Build issue `$ARGUMENTS` following `docs/DEVELOPING.md` → Workflow, whose rules
(thin components, tests first, labels, PR size) apply throughout. Read that
file before starting.

1. **Read the issue**: `gh issue view $ARGUMENTS --json number,title,body,labels,comments`.
   If an acceptance criterion can't be checked as written, ask the user before
   writing code. If the change would pass ~300 lines of non-test code, propose
   how to split the issue and stop.
2. **Branch** from an up-to-date `main`: `git fetch origin && git switch -c claude/<number>-<short-slug> origin/main`.
3. **Sort the criteria**: behaviour gets a test in `src/lib` (or
   `supabase/functions`); look and feel gets a phone step for the PR body.
4. **Red**: write the tests, stub any new function so the file imports, and
   run `npx vitest run <test file>`. Every new test fails on its assertion.
   Keep the failing output for the PR body.
5. **Green**: write the code, keeping behaviour in `src/lib` and components
   thin. Run the tests again until they pass.
6. **Check**: `npm run lint`, `npm run build` and `npm test` all green. Follow
   the current release rules in `docs/DEVELOPING.md` for the version and
   release notes.
7. **Open a draft PR**: commit, push, then `gh pr create --draft` with the body
   from `.github/pull_request_template.md`, every section filled: `Closes #<number>`,
   phone steps that start from the screen the app opens on and say what the
   user should see, and each test with the assertion it failed on. Add exactly
   one of `feature`, `fix` or `internal`, plus `manual-test` if there are no
   new tests. Leave the review checklist unticked: it is the user's.
8. **Add the preview link**: once `gh pr checks <pr>` shows Vercel passing,
   read the bot's comment
   (`gh pr view <pr> --json comments --jq '.comments[] | select(.author.login=="vercel") | .body'`)
   and take its **Preview** link, the `coach-claude-git-<branch>-…vercel.app`
   alias that follows every push to the branch. Put it in the PR body under
   "Try it on your phone". Edit the body with
   `gh api -X PATCH repos/{owner}/{repo}/pulls/<pr> -F body=@<file>`
   (`gh pr edit` fails on this repo over the retired Projects classic API).

Done when the draft PR is open with every check green except the review
checklist (the user's to tick), every template section filled,
and the preview link in place. End with the PR link, the preview link and the
phone steps, so the user can test from their phone straight away.
