---
name: build-issue
description: Build one GitHub issue test-first and open it as a PR that merges itself once its checks pass.
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
7. **Open the PR as a draft with its labels**: commit, push, then
   `gh pr create --draft --label <type>` with the body from
   `.github/pull_request_template.md`, every section filled: `Closes #<number>`,
   phone steps that start from the screen the app opens on and say what the
   user should see, and each test with the assertion it failed on. The type
   is exactly one of `feature`, `fix` or `internal`; add `--label manual-test`
   too if there are no new tests.
8. **Ready and auto-merge**: `gh pr ready <pr>`, then
   `gh pr merge <pr> --auto --merge`, unless the user asked to hold it or it
   adds a database migration. If a check fails, fix it with a new commit on
   the branch. Never cancel a check run: a cancelled required check blocks
   the merge.
9. **Report**: once it merges, tell the user in plain words what changed and
   how to try it on `main`'s preview,
   `https://coach-claude-git-main-natecode.vercel.app` (demo data). Say if it
   can only be tried in production (sign-in, sync).

Done when the PR has merged (or is held, with the reason) and the user has
the plain summary and phone steps.
