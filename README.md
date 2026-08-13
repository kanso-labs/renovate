# renovate

Self-hosted [Renovate](https://docs.renovatebot.com) runner for the `kanso-labs`
organization. One scheduled workflow in this repository keeps dependencies up to
date across every repository listed in [`config.js`](config.js) — there is no
Mend Renovate App installation and no per-repository bot to configure. (The
organization's own GitHub App does appear below, but only as the credential the
runner authenticates with — it does not run Renovate.)

## How it works

[`.github/workflows/renovate.yaml`](.github/workflows/renovate.yaml) runs every
three hours. It checks this repository out (only to read `config.js`), mints a
GitHub App installation token, then runs Renovate against each managed
repository with it. Everything Renovate does — branches, PRs, the Dependency
Dashboard issue — happens in the managed repositories, not here.

The three-hour cadence matters for more than freshness: ticking a checkbox on a
Dependency Dashboard only takes effect on the next run, so a daily schedule
would mean waiting up to a day for a manual retry or rebase.

## Comment commands

Renovate has none of its own, so
[`.github/workflows/renovate-command.yaml`](.github/workflows/renovate-command.yaml)
adds them for this repository, giving `@renovate rebase` the behaviour
`@dependabot rebase` has:

| Comment | Effect |
| --- | --- |
| `@renovate rebase`, `@renovate retry`, `@renovate recreate` | Ticks this PR's rebase checkbox, then starts a run |
| `@renovate run` | Starts a run without touching the PR |

Nothing here reimplements rebasing. The workflow makes the same edit to the PR
body that clicking Renovate's own rebase checkbox makes, then dispatches the
scheduled workflow so the tick is read within about a minute instead of at the
next three-hourly run — which is the whole reason to bother, since ticking the
box by hand already worked.

The mention has to open a line, and the author needs write access. The logic
lives in
[`kanso-labs/github-actions`](https://github.com/kanso-labs/github-actions#_renovate-commandyaml)
so the other managed repositories can adopt it with a caller of their own; this
repository is the first, and for now the only one.

> [!NOTE]
> Only the copy of that workflow on `main` runs, because `issue_comment` is a
> repository-level event. Editing it on a branch and commenting on that
> branch's own PR tests nothing.

## Configuration layout

Renovate reads configuration from two places, and the distinction is easy to get
wrong:

| File | Scope | Holds |
| --- | --- | --- |
| [`config.js`](config.js) | The runner (global) | Which repositories to manage, and the policy shared across all of them |
| [`renovate.json`](renovate.json) | This repository only | How this repository's own workflows get updated |

A managed repository may also ship its own `renovate.json`. That file is merged
over the defaults in `config.js`, and for list-valued settings such as `extends`
it **replaces** rather than appends — so a repository with its own config should
restate the presets it needs (`config:recommended` in particular) instead of
assuming it inherits them.

Because `config.js` sets `onboarding: false` with `requireConfig: 'optional'`, a
repository does not need any config file of its own and will never receive an
onboarding PR. Listing it in `config.js` is the whole opt-in.

## Adding or removing a managed repository

Edit the `repositories` array in [`config.js`](config.js) and open a PR. The list
lives in git precisely so that granting Renovate write access to a new
repository is reviewable and shows up in `git log`.

Removing one is not optional housekeeping. Renovate fails the entire run with
`platform-unknown-error` when it cannot resolve a name in that list, so a
repository deleted or renamed on GitHub and left here stops dependency updates
in every other repository too.

Currently managed:

- `kanso-labs/github-actions` — the shared workflows and actions; listing it is
  also what keeps its own self-reference current
- `kanso-labs/home-assistant-applications`
- `kanso-labs/kanso-ui`
- `kanso-labs/renovate` — this repository, so the workflow's own action pins stay
  current
- `kanso-labs/unplugin-style-dictionary`

The two Node repositories moved here from Dependabot, so that dependency policy
is written once rather than in each of them. Both carry their own
`renovate.json` holding the package grouping that was in their `dependabot.yml`.
Neither should get a `.github/dependabot.yml` back: the two bots would open
competing pull requests for the same upgrades.

Every repository that pins
[`kanso-labs/github-actions`](https://github.com/kanso-labs/github-actions) has
to be listed here as well. Those pins are exact tags, and Renovate is the only
thing that bumps them — an unlisted consumer silently stays on whatever version
it was written with.

## Authentication

Renovate authenticates as the organization's
[`kanso-labs` GitHub App](https://github.com/organizations/kanso-labs/settings/apps/kanso-labs),
which is installed on every repository in the organization. The workflow mints
an installation token per run via
[`actions/create-github-app-token`](https://github.com/actions/create-github-app-token);
that token expires after an hour and is revoked when the job ends, so no
long-lived credential with write access to every managed repository is stored
anywhere.

| Secret | Purpose |
| --- | --- |
| `RENOVATE_APP_ID` | The app's numeric ID |
| `RENOVATE_APP_PRIVATE_KEY` | A private key generated for the app |

The workflow's own `GITHUB_TOKEN` is deliberately limited to `contents: read`;
Renovate never uses it.

The app needs these permissions, and each one is load-bearing:

| Permission | Needed for |
| --- | --- |
| Contents: write | Pushing update branches |
| Pull requests: write | Opening and updating the PRs |
| Issues: write | The Dependency Dashboard issue |
| Workflows: write | Editing files under `.github/workflows/` |
| Metadata: read | Mandatory for every app |

> [!IMPORTANT]
> Workflows: write is the one that is easy to miss and the one this repository
> most depends on. Without it GitHub rejects any push touching
> `.github/workflows/`, so the action-pin bumps in this repository and in
> `kanso-labs/github-actions` fail while every other update keeps working — a
> partial outage rather than an obvious one.

Authenticating as an app also changes how commits are made, which is worth
knowing before anyone tries to configure it. Renovate's `platformCommit` turns
itself on for application tokens, so commits are created through GitHub's API
rather than by `git`. Two consequences follow: they arrive **signed**, showing
as Verified, and **GitHub decides the author** — `kanso-labs[bot]`, at the
`users.noreply.github.com` address that links the commit back to the app.

That is why `config.js` sets neither `gitAuthor` nor `username`. Renovate asks
GitHub which app the token belongs to and derives both, and a `gitAuthor` set
here would be silently ignored by the commit path anyway. Pointing it at an
address on an owned domain costs the signature and the attribution, and buys
nothing.

## Running it manually

Use the **Renovate** workflow's *Run workflow* button, or:

```bash
gh workflow run renovate.yaml --repo kanso-labs/renovate
```

Two inputs are available. `logLevel` raises verbosity to `debug` when a lookup
misbehaves, and `dryRun` runs without writing anything:

```bash
gh workflow run renovate.yaml --repo kanso-labs/renovate -f dryRun=full -f logLevel=debug
```

`extract` only scans for dependencies, `lookup` also resolves available updates,
and `full` goes all the way through PR planning while logging instead of
writing. Use `full` when changing `config.js`, so the effect on all managed
repositories is visible before it is real.

## Validating changes locally

CI runs both of these on every PR via
[`.github/workflows/validate.yaml`](.github/workflows/validate.yaml), because a
malformed config file stops updates everywhere without an obvious error:

```bash
npx --yes --package renovate -- renovate-config-validator --strict config.js renovate.json
```

```bash
actionlint
```

## Action pinning

Actions here are pinned to release tags, `actions/checkout@v7.0.1`, which is the
convention across every `kanso-labs` repository.

This repository used to pin commit SHAs instead, via
`helpers:pinGitHubActionDigests`. That was dropped deliberately, to have one
convention rather than two, and it is worth being clear about what it cost:
a tag can be moved by whoever controls the action, and this repository's
`RENOVATE_TOKEN` can write to every managed repository — so a hijacked tag on a
third-party action is more expensive here than anywhere else in the
organization. `renovatebot/github-action` is the one that matters.

Restoring digests here alone is a two-line change: add
`helpers:pinGitHubActionDigests` back to [`renovate.json`](renovate.json) and
let Renovate rewrite the pins.
