# Commit and pull request guidelines

## Commit titles

Use a short type prefix and describe the actual change.

- `feat:` new behavior
- `fix:` bug fix
- `docs:` documentation only
- `test:` test coverage or test maintenance
- `refactor:` structure change without behavior change
- `chore:` repository or build maintenance

Examples:

- `feat: migrate runtime health API to Java`
- `fix: keep AI runtime available without provider configuration`
- `docs: record Java migration status`
- `chore: normalize repository ignore rules`

Avoid reusing broad scaffold messages such as `Create ArchiveOS MVP dashboard` for later work.

## Why one message can appear many times in the GitHub root

The repository file list shows the latest commit that changed each file. When many files were created in one initial commit, the same message appears next to many paths. This does not mean the repository contains many duplicate commits.

Do not rewrite history only to change those labels. Update files when there is a real maintenance reason and keep future commits focused.

## Pull request scope

- Keep branding, migration, runtime fixes, and build maintenance in separate reviewable changes.
- Include completed checks and any remaining blocker.
- Do not describe an unverified integration as complete.
- Note when related commits still exist only on a local machine.
