# RecipeShare Club — UI demo

This standalone demo is preserved on the orphan `demo-ui` branch. Its source lives at the root of that branch; in the main development workspace it lives in the ignored `demo-ui/` directory.

Do not merge this branch into `main`. Use it as a visual reference and port selected components during production integration. Its commit history intentionally has no common ancestor with `main`.

## Run

```powershell
pnpm.cmd install
pnpm.cmd dev --port 3001
```

## Check

```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd build
```

The build currently skips type checking; always run the separate TypeScript check.

The demo uses 36 local post fixtures and browser-local draft, saved and following state. Authentication and publishing are demonstrations, not production API integrations. Uploaded files use temporary browser URLs and must be selected again after reloading a saved draft.

The checkpoint includes desktop and mobile navigation, a block editor, media previews, drag sorting and an in-page reading preview. iPhone Safari interaction and animation behavior still need direct device verification. No dependency directories, build output, uploaded media or environment secrets belong in this branch.
