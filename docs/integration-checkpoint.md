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


## Integration progress after checkpoint

Phase 1 ports the community frame, public feed and reader into `app`. These use real sessions and public post APIs; list responses include tags. Home supports 10-item pagination, title search and type/tag filters. Saved/following show unavailable states until their production APIs are implemented.


Phase 2 ports the protected `/editor/[id]` and enables draft creation from the community header. Recipe/blog drafts, image/video uploads, supported video URLs, manual saves, reload restoration and publication now use the production APIs. Editor/preview keep the demo motion and use the signed-in identity. Post type is selected at creation and remains fixed, matching the backend draft contract. Editor reads now include referenced media metadata behind the existing owner check.

Successful login waits for the existing closing/burst animation before navigation; reduced motion navigates immediately. Empty search/filter results enter with the feed fade/slide animation after loading finishes.

Validation: TypeScript, ESLint and production build passed. `node scripts/test-editor-integration.mjs` exercised real authentication, image upload, URL video registration, both draft types, save/reload media restoration, publish, public list/detail and unauthorized/incomplete/published-write guards. Its isolated account, posts, tags and files were removed afterward. Browser surfaces are unavailable in this session; visual motion and iPhone Safari behavior still need direct verification. The two previously recorded media tracing warnings remain.

The profile now provides the account draft list/resume entry point. Next: implement saved/following APIs before enabling those controls.


List-block integration now supports eight unordered/ordered marker styles across editor, persistence, preview and public reader. Existing schema/validation additions were preserved; missing UI serialization and rendering branches were completed. Integration tests cover all styles, list-only publication and rejected empty/invalid list content.


Selected parity updates: demo editor now includes list blocks, grouped adjacent images and shared exclusive video playback while retaining its local storage and fixtures. Demo creation opens the editor directly and empty results animate. Production pagination now follows the demo's scroll and outgoing/incoming card transitions with real API pagination. Both app builds and separate TypeScript checks passed; seeded demo reader/social fixtures were intentionally preserved.

Profile integration: aligned demo profile typography and ported the profile layout/navigation into production. Added migration 0004_user_profiles (applied locally), authenticated profile updates, owned image validation/public profile media, author post pagination/search and private draft listing/resume. Production has no simulated followers or local profile persistence. Both TypeScript checks, production build and real API lifecycle/security tests passed. Headless Chrome verified demo edit/upload/crop/resume and production public profile at 390px with no horizontal overflow or JavaScript/hydration errors. Direct iPhone Safari verification remains manual. Existing two media tracing warnings remain.

Sidebar navigation fix: home/profile now share the persistent (community) layout. Page-level CommunityFrame supplies shell settings without remounting the header/sidebar; loading stays within the content area. Production build, TypeScript/ESLint and headless production navigation checks passed for home/saved/following. Browser checks confirm the same header/nav DOM nodes and document survive transitions, with no console/hydration errors.

Dev instant validation follow-up: moved CommunityShellContext into its own client module. This removed the reproducible SSR undefined Provider error and the resulting instant UI validation failures in Turbopack dev. Headless Chrome on the existing dev server passed home/saved/following transitions with unchanged header/nav DOM and zero console errors; validation remains enabled.

Compact block dragging: all five editor block types now drag as their header, with a matching compact placeholder. Dropping animates expansion and shifts following cards/the add panel; returning to the original slot also expands. Applied the same sortable hook to production and demo. TypeScript/ESLint passed for production; browser pointer tests on demo covered all five block kinds, reordered expansion, no overlapping cards and cleared temporary heights, with no console errors.

Profile tab stability: preserve the results region height before changing tabs, keep the search section mounted, disable profile scroll anchoring and reserve a viewport-sized minimum with scroll-position allowance. The replacement results and region height animate when loading completes, respecting reduced motion. A delayed browser-only API fixture verified stable scrollTop and search coordinates on every animation frame when switching from ten posts to fewer drafts; no real records changed.

Loading/motion update: shared ChefLoader replaces visible loading text in streamed route fallbacks and community fetch states. Content progressively fades/slides in; the initial sidebar marker enters from the screen edge with overshoot, and AccountArea animates the guest login out while create/account controls enter when the real session arrives. Reduced motion is respected. Explicit sidebar/main/right-panel grid slots prevent the right panel filling the feed while streamed content is absent. Browser checks verified centered loader, real isolated login/session transition (account removed afterward), mobile width and reduced motion, plus four repeated refreshes with frame-by-frame column bounds and no console errors. TypeScript/ESLint and build passed; the two existing media tracing warnings remain.

Popup/editor loading follow-up: popup now starts and closes at the source button's exact width/height using independent transform scales. Replaced full-screen blur/filter animation with opacity-only dimming; in a three-cycle headless trace RasterTask count dropped from 4326 to 72, with the final run's median/p95 frame interval about 16.7 ms (environment-specific, not a device guarantee). Added generation/cancellation guards against an older close animation closing a newly reopened dialog. Browser checks passed exact popup/source geometry on desktop and 390px mobile, input limits, interrupted open/Escape, reduced motion and no console errors. Editor client data loading now uses the same centered ChefLoader as the server suspense boundary, and reveals the editor only after draft hydration. Delayed real-draft tests confirmed center coordinates and restoration at both viewport sizes; isolated accounts/drafts were removed.

Commit validation: full production ESLint and real editor/profile integration tests passed; deterministic image grouping/playback checks passed. Production build passed after the final editor loader and popup changes. Demo received a separate TypeScript check and production build before its independent snapshot. Local env files, uploads, build output and browser QA scratch files remain excluded.
