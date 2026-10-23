# Integration checkpoint — 2026-10-23

## Branches

- `main` contains the production app, content/media backend and database migrations.
- `demo-ui` is an orphan branch containing the standalone demo at its repository root. It has no shared commit ancestry with `main`; do not merge it into `main`. Port selected components deliberately during integration.
- The local `demo-ui/` folder remains ignored on `main`. Local `demo-ui-worktree/` is an older upgrade worktree, not the new demo branch.
- No remote push is part of this checkpoint. Orphan ancestry prevents an ordinary merge, but is not an absolute prohibition against an explicit unrelated-history merge.

## Backend ready for integration

- Authentication: registration, login, database sessions, current user and logout.
- Recipe/blog drafts: create, author-only read/edit, validation and transactional saves.
- Publication: content validation, revision snapshot and publication timestamp.
- Public post list/detail with pagination, search, type and tag filters.
- Uploaded media and supported video URLs; authenticated/private or published/public file access, including byte ranges.
- Content migration `0003_add_content_tables` was applied and manually verified during development.

## Demo baseline

- Community home, saved/following views, full reader and recipe/blog block editor.
- Local fixtures: 36 posts, 10 per page; saved/followed state is browser-local.
- Desktop sidebar and mobile bottom navigation share navigation state.
- Editor supports ingredients, tags, media, drag sorting, draft storage and animated reading preview.
- Custom app logo/favicon; original cloche illustration retained on authentication forms.

## Validation at checkpoint

- `app`: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` passed.
- `demo-ui`: `pnpm exec tsc --noEmit` and `pnpm build` passed. The demo build configuration skips type checking, so the separate TypeScript check is required.
- Previous manual API checks covered draft permissions, rejected-write rollback, publication snapshots, upload type/size limits and byte-range responses. These were not rerun against the database for this commit.

## Open items

- Before Docker packaging, resolve both Turbopack dynamic filesystem tracing warnings in `app/src/lib/media/storage.ts` (`getUploadDirectory` and `getStoredFilePath`). Verify that uploads and the entire workspace are not unintentionally bundled; store uploaded files in a separate mounted volume.
- Retest authentication and interaction on the user's iPhone Safari 16.7.16 after restarting dev servers. LAN dev origins and touch-field font sizes were adjusted; device-level success is not yet confirmed.
- Pointer dragging, motion timing and mobile safe areas still need direct browser/device verification.
- Saved/following and other social interactions still need production APIs; demo controls must not be mistaken for completed backend integration.

## First integration target

Keep one complete path working: login → create recipe → upload media → save draft → publish → browse the public feed and reader. Use real sessions and API data while preserving the demo design baseline.
