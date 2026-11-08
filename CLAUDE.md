# Project rules (Stokla)

- Everything in the code is English: file and folder names, route paths, identifiers, comments, commit messages.
  Only user-facing UI text is Turkish.
- Commit messages: English, imperative mood (e.g. "Add ingredient stock count").
- Commits are authored as the repository owner, Furkan Memiş
  (`77626136+furkanmemis@users.noreply.github.com`). Never add Co-Authored-By or any line mentioning Claude/AI.
- Write it like a senior engineer: SOLID, small single-purpose modules, pure domain logic in `lib/domain`
  (no I/O there), data access and side effects in server actions, tests for every domain rule.
- Supabase: the app only ever uses the publishable (anon) key. Never use, request or commit the secret /
  service_role key.
- Stock changes only through the database functions in `supabase/schema.sql` (one transaction, one movement
  per change). Never update stock columns directly from the app.
- Business data is isolated per business with RLS; every new table needs RLS and a test in
  `supabase/tests/rules_test.sql`.
- Before pushing: `npm test`, `npx tsc --noEmit` and `npx next build` must pass, and the SQL tests must pass
  against a local PostgreSQL (see README).
