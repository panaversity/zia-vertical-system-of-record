# Security

## Reporting

Report privately, never as a public issue: open a [GitHub security
advisory](https://github.com/panaversity/zia-vertical-system-of-record/security/advisories/new)
on this repository. If that is not available to you, email the address on the organisation's GitHub
profile with `vsor security` in the subject.

Include what you ran, what you expected, what happened, and the version (`vsor --version` and, if a
site is involved, the `build.lock.json` the build wrote). We acknowledge within five working days
and tell you plainly whether we consider it in scope — including when the answer is no.

**Please do not** run automated scanners against anything you did not deploy yourself. This project
hosts nothing; every deployment belongs to the person who ran `vsor build`.

## Versions

0.x. Only the latest minor is supported. A fix ships in a new patch or minor release; there are no
backports before 1.0.

## In scope

- The `vsor` CLI: argument handling, the scaffold writer, the atomic build swap, `build.lock.json`.
- What `vsor init` writes — the scaffold is a public surface, and a defect there is reproduced in
  every project made from it.
- The site runtime shipped inside the wheel (`vsor/_site_runtime/`) and the static site it builds,
  including the claim that a built site initiates **no off-origin request**. A build that phones
  anywhere is a bug in this list, not a preference.
- The MCP surface (`vsor serve`) and its fail-closed auth, **when it ships**. It is not in this
  release: the verb exits 2.

## Out of scope

- **A user's own corpus.** What `knowledge/` contains, whether it should be public, and who may read
  the site it compiles to are the project owner's decisions. vsor compiles what it is given.
- **A user's host account, DNS or CDN** — Vercel, Netlify, Cloudflare, GitHub Pages, a bucket. The
  scaffold writes a build command; it holds no credentials and performs no deploy.
- **`.env` contents.** It is git-ignored by the scaffold and read by no verb in this release.
- Findings that require an attacker to already have write access to the project directory, or to
  the machine running the build.
- Vulnerabilities in third-party dependencies with no path to exploitation through this code. Report
  them upstream; tell us if the fix needs a version bump here.
- Reports produced only by a scanner, with no demonstrated impact.

## Two things a reader will notice, pre-answered

Both are deliberate, both are documented where they happen, and both are the kind of thing an
automated review flags. Neither needs a report; a better answer to either is very welcome.

**1. `vercel.json` and `netlify.toml` run `curl … | sh`.**

```
curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL=/tmp/uv sh && /tmp/uv/uvx vsor build
```

The host image ships Node and not necessarily Python; uv brings its own Python, so this is what
makes one build command work on both hosts. The install path is pinned rather than added to `PATH`
because an installer cannot change the `PATH` of the shell already running it. The alternative — a
host-native Python runtime — is documented in `.agents/skills/deploy/SKILL.md`, and path 2 of that
document (build locally, upload the directory) avoids the question entirely, which is also the path
for a corpus under a confidentiality obligation: the host receives rendered HTML and nothing else.

A user who does not want it deletes the file. Both host configs are the project's own, in the
project's own repository, and nothing regenerates them.

**2. `uvx vsor build` floats to the newest release.**

On a host-run build there is no lockfile for the CLI itself. What makes this recoverable rather
than silent: `build.lock.json` records the vsor version that actually ran, alongside the Node and
Docusaurus versions and whether the run satisfied `instance.md`'s `vsor.requires` pin. To pin the
host as well, write `uvx vsor@<version> build`.

## The npm audit summary on first run

The first `vsor dev` or `vsor build` installs the site runtime under `.vsor/`, and npm's output
passes through unmodified — including its audit summary, which currently reads **25 vulnerabilities
(6 moderate, 19 high)**. `vsor` prints one line of its own underneath, because an unanswered alarm
is worse than either suppressing it or fixing it.

Reviewed 2026-08-14 against the shipped shell lockfile (`npm audit --json` in
`packages/vsor/src/vsor/_site_runtime`). All 25 are transitive, from exactly three roots:

| Root | Reached through | Why it is accepted |
| :--- | :--- | :--- |
| `serialize-javascript` (high) | `copy-webpack-plugin`, `css-minimizer-webpack-plugin` — Docusaurus's bundler | Runs during the build, on this project's own content. No fixed version is reachable without moving the Docusaurus pin |
| `image-size` (high) | Docusaurus's image handling | Same: build-time, on files the project owns |
| `uuid` (moderate) | `sockjs` → `webpack-dev-server` | Dev server only. Never runs in `vsor build`, and `vsor dev` binds to `127.0.0.1` |

**None of them ships in `build/`.** The output is static HTML, CSS, JS and a search index; no npm
package executes at serve time, and nothing in the built site fetches off-origin. The exposure is
to the machine running the build, from content that machine already has.

This is re-checked whenever the Docusaurus pin moves. If you find a path from any of these to a
built site or to a user's machine that we have not, that is exactly the report we want.

## What this project does not do

No telemetry, no analytics, no crash reporting, no update check. The CLI's only network activity is
the one-time site-runtime install under `.vsor/` (npm, against the shipped lockfile). The built site
self-hosts its fonts and its search index and requests nothing off-origin — asserted in CI, in the
built bundles and in a real browser, not promised.
