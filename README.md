# renovate

Self-hosted [Renovate](https://docs.renovatebot.com) runner for the `kanso-labs`
organization. One scheduled workflow in this repository keeps dependencies up to
date across every repository listed in [`config.js`](config.js) — there is no
Renovate GitHub App installation and no per-repository bot to configure.

## How it works

[`.github/workflows/renovate.yaml`](.github/workflows/renovate.yaml) runs every
three hours. It checks this repository out (only to read `config.js`), then runs
Renovate against each managed repository using `RENOVATE_TOKEN` for
authentication. Everything Renovate does — branches, PRs, the Dependency
Dashboard issue — happens in the managed repositories, not here.

The three-hour cadence matters for more than freshness: ticking a checkbox on a
Dependency Dashboard only takes effect on the next run, so a daily schedule
would mean waiting up to a day for a manual retry or rebase.

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

Currently managed:

- `kanso-labs/github-actions` — the shared workflows and actions; listing it is
  also what keeps its own self-reference current
- `kanso-labs/home-assistant-applications`
- `kanso-labs/home-server` — empty repository, so Renovate skips it until it has
  a first commit
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

## Required secret

| Name | Purpose |
| --- | --- |
| `RENOVATE_TOKEN` | Repository secret. Needs `repo` scope (classic PAT) or equivalent fine-grained Contents + Pull requests + Issues write access on every managed repository. |

The workflow's own `GITHUB_TOKEN` is deliberately limited to `contents: read`;
Renovate never uses it.

> [!IMPORTANT]
> If `RENOVATE_TOKEN` is a personal access token with an expiry, dependency
> updates stop silently across all managed repositories when it lapses — the
> workflow fails, but nothing else signals it. A GitHub App token minted per run
> via [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)
> avoids the expiry cliff and scopes access to the installed repositories.

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
