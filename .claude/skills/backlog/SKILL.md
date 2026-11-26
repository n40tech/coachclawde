---
name: backlog
description: Turn a brain-dump of app ideas into GitHub issues with acceptance criteria.
disable-model-invocation: true
---

The brain-dump is the user's message (or `$ARGUMENTS`). Issue conventions are in
`docs/agents/issue-tracker.md`; the workflow they feed is in `docs/DEVELOPING.md`
→ Workflow.

1. **Read the current backlog**: `gh issue list --state open --limit 100 --json number,title,labels`.
2. **Split the dump** into one item per distinct change. Merge items that
   describe the same change, and mark items that duplicate an open issue with
   that issue's number.
3. **Draft each item** in the shape of `.github/ISSUE_TEMPLATE/change.md`:
   a short title, what and why in the athlete's words, and acceptance criteria
   that can each be checked (behaviour → a test, look and feel → a phone step).
   Read the code an item touches so the criteria match how the app works today.
   When an item is too vague to write criteria for, keep it with
   `needs-info` and the question that would settle it.
4. **Show the drafts** as a numbered list: title, criteria, label
   (`needs-triage`, or `needs-info` with its question), and which items touch
   the same code and so should be built one after the other. Wait for the user
   to approve or edit them.
5. **Create the approved issues** with `gh issue create`, adding to existing
   issues instead where step 2 found a duplicate.

Done when every line of the dump is accounted for: an issue, an addition to an
existing issue, or dropped with the user's agreement. Finish with the issue
numbers in a suggested build order.
