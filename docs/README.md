# Docs

All written material for Wishlist+ for PriceCharting, split the same way as [design/](../design/README.md): what's public now, what's being prepared, and what's for developers only. The user guide is the top-level [README](../README.md), and the user-facing release notes are [CHANGELOG.md](../CHANGELOG.md). Both stay at the top level, because CI and the release script read the changelog from there.

## public/ — live now

Text that users or Google's reviewers can see today. Change these only when the change is published at the same time.

| File | What it is | Where it's published |
|---|---|---|
| `privacy-policy.md` | The privacy policy | Public gist [0dbdab84…](https://gist.github.com/anmokhta/0dbdab84b479a030717f3584833156b9), linked from the store listing. After editing, run `gh gist edit 0dbdab84b479a030717f3584833156b9 docs/public/privacy-policy.md`. |
| `store-listing.md` | Everything pasted into the Chrome Web Store dashboard: summary, description, category, privacy-practices answers, test instructions (without the login) | [Chrome Web Store item](https://chromewebstore.google.com/detail/opfopmnimlhgjgnoegkghpdpdgabjhcf). The dashboard is the source of truth; keep this copy matching it. |

## drafts/ — next version

Text written for an upcoming release, not published yet. When that version is submitted, the draft replaces the matching file in `public/` and the draft is deleted.

| File | What it is |
|---|---|
| *(none right now)* | The 1.4.8 store listing was entered in the dashboard on 2026-11-23 and is now `public/store-listing.md`. |

## internal/ — developers only

| File | What it is |
|---|---|
| `roadmap.md` | Planned work, backlog, and completed work with code and test detail |
| `releasing.md` | How to ship a version: release notes, CI, GitHub Releases, submitting to the Chrome Web Store |
| `technical-summary.md` | Deep dive: PriceCharting's page structure, how the extension works, testing, history |
| `debug-session-summary.md` | Root-cause write-up of the duplicate "bare rows" bug fixed in 1.4.1 |
