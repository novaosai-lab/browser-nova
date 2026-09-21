# Browser Nova — project working rules

These rules apply to this repository. They record the user's instruction on 2026-09-21: after making changes, update the Markdown documentation and sync the work to GitHub.

## Complete each change

1. Inspect the working tree before editing and preserve unrelated or uncommitted work.
2. Update `IMPROVEMENTS.md` with what changed, why, validation results, and remaining limitations. Keep `SUMMARY_ANTIGRAVITY.md` aligned with the current project status. Update `README.md`, `RELEASE.md`, and `REVIEW.md` when the change affects their content.
3. Run checks appropriate to the change. For documentation-only changes, inspect the diff and check links/formatting; do not claim that tests were rerun. Distinguish unit/mock checks, manual app checks, and actual signed-update testing.
4. Commit the completed changes and documentation, then push the working branch to `origin` (`https://github.com/novaosai-lab/browser-nova.git`). The user has authorized this as the default workflow; do not ask again for routine commits and pushes. Do not force-push, rewrite history, or include unrelated changes.
5. Verify that the pushed commit is present on GitHub. If CI runs, inspect its result and address failures introduced by the change. Report the commit/link and any actual blocker; never claim GitHub is updated if the push failed.

## Release and credential boundaries

- Source/documentation sync does not mean publishing a new application release after every edit. Follow `RELEASE.md` when the task calls for a build or release.
- Keep secrets, API keys, signing certificates, user profiles, `node_modules`, and generated build directories out of git. Distribute installers through GitHub Releases or workflow artifacts.
- The current preview has auto-update installation disabled. Do not describe production auto-update as verified until Developer ID signing, notarization, and an update between two signed versions have been tested.
- If GitHub authentication, permissions, or signing credentials are missing, complete the available local work, document the blocker, and tell the user what is needed.
