# AGENTS.md

Guidance for coding agents working in this repository.

## What this is

The self-hosted Renovate runner for the `kanso-labs` organization. One scheduled
workflow here keeps dependencies current across every repository listed in
`config.js`, and everything it produces — branches, pull requests, the
occasional config-warning issue — lands in those repositories rather than this
one. There is no Dependency Dashboard: the organization's shared preset turns
off what `config:recommended` turns on, and the preset says why.

[`README.md`](README.md) documents the moving parts: the three configuration
files and which scope each has, the application permissions and why each is
load-bearing, how to run the workflow by hand. Read it first, and keep it
correct when you change behaviour, because it is what a person reaches for.

This file covers what the README does not: the conventions shared with the
sibling repositories, how to verify a change, and the traps.

## Commands

Validate the configuration, which is what CI runs:

```bash
npx --yes --package renovate -- renovate-config-validator --strict
```

Lint the workflows:

```bash
actionlint
```

Run it by hand, adding `-f dryRun=full` to log what would change instead of
writing anything, and `-f logLevel=debug` when a lookup misbehaves:

```bash
gh workflow run renovate.yaml --repo kanso-labs/renovate
```

**Pass the validator no file arguments.** It discovers `config.js` and
`renovate.json` itself and checks each against the right schema, global against
repository. Naming them explicitly validates both as global, which is why
`validate.yaml` calls it bare.

There is no package manifest, no formatter and no linter for the Markdown or
JSON here. `Validate` is the whole check surface.

## Conventions

Shared with the other `kanso-labs` repositories. The canonical text is
[`CONVENTIONS.md`](https://github.com/kanso-labs/.github/blob/main/CONVENTIONS.md)
in `kanso-labs/.github`; this is a copy, kept in step by hand. Change that
file first, then every copy.

- **Keys in JSON and YAML are ordered by name.** Files whose order carries
  meaning are exempt: workflows, where step order is execution order;
  changelogs, which are chronological; and `package.json`, where the npm
  ecosystem expects `name` and `version` first.
- **A workflow's filename is the kebab-case of its `name:` field.** Reusable
  workflows, meaning those triggered only by `workflow_call`, take a leading
  underscore.
- **Job names and step names are imperative verb phrases.** Job ids, step ids,
  and matrix keys are exempt.
- **Actions are pinned to exact release tags**, `actions/checkout@v7.0.1`, never
  `@main` and never a tag the publisher moves — `@v7` and `@v7.0` both move.
  Renovate opens the bump pull requests, and it has nothing to open when the pin
  never changes: `frenck/action-app-linter@v2.21` sat still through a repository
  rename and a release that fixed something a consumer was working around,
  because the tag it named was moved onto both.
- **Dependency versions are pinned exactly.** Every `dependencies`,
  `devDependencies`, and `optionalDependencies` entry is a bare version,
  `1.2.3`, never `^1.2.3`, `~1.2.3`, `>=1.2.3`, `*`, `1.x`, or an `||` union.
  Renovate opens those bumps too. `peerDependencies` are the deliberate
  exception: they state what the consumer's own installed copy must satisfy, so
  ranges are correct there and stay.
- **`.tool-versions` pins a fully-specified version on every line**,
  `nodejs <major>.<minor>.<patch>`, never `nodejs 24` or `nodejs lts`.

Two of those bullets are inert here: this repository has no `package.json` and
no `.tool-versions`. They stay in the copy anyway, because the block states the
organization's set rather than the subset that bites in one repository, and a
check that asserts the copies match cannot allow one to be a subset.

Unlike its siblings, this repository has no Prettier or oxfmt setup, so nothing
reformats what you write here. Match the surrounding style by hand.

Specific to this repository: **the configuration files carry their reasoning in
comments.** `config.js`, `renovate.json` and all three workflows explain why
each setting is what it is, at length. That is the house style here — a change
that removes the explanation is a regression even when the behaviour is
unchanged.

## Verifying a change

`Validate` runs on every pull request and covers three things: the config
against its schema, the workflows through `actionlint`, and a `Dry run Renovate`
job that executes the pinned `renovatebot/github-action` against this repository
alone.

That third job is what makes a bump to the action itself safe, and it has one
gap by design: it authenticates with `GITHUB_TOKEN`, not the application token
`renovate.yaml` mints. **A change to the mint step is therefore never exercised
by CI** and has to be dispatched by hand to be tested.

When changing `config.js`, dispatch a `full` dry run before merging. The effect
is org-wide and the file is the one place a mistake reaches every managed
repository at once.

## Commits and pull requests

Pull requests are squash-merged, with the pull request title as the commit
subject and an empty body. That title becomes the only commit on `main`, and
branch commit messages are discarded by the squash and never reach history.

Write that title as a Conventional Commit. Nothing here is released or
versioned, so no type triggers anything — the type is for the reader.

Write branch commits conventionally anyway. They are what a reviewer reads while
the pull request is open, even though only the title survives the merge.

## Traps

**An unresolvable name in `repositories` fails the entire run, not just that
repository.** Renovate exits with `platform-unknown-error`, so a repository
deleted or renamed on GitHub and left in `config.js` stops dependency updates
in every other managed repository too. Removing an entry is not housekeeping
that can wait.

**The `renovatebot/github-action` pin in `validate.yaml` has to stay identical
to the one in `renovate.yaml`.** A Renovate bump edits both, and the dry run
exists precisely to exercise the new version before the scheduled job runs it
against every managed repository. Letting them drift silently removes that
guarantee while leaving the job green.

`renovate-command.yaml` is the one thing here that comes from
`kanso-labs/actions`: it calls `_renovate-command.yaml` at an exact
release tag, never a moving major, and Renovate opens the bump pull requests. It
is what makes `@renovate rebase` work on a dependency pull request in this
repository.

**Only the copy of `renovate-command.yaml` on `main` ever runs.**
`issue_comment` is a repository-level event, so editing the workflow on a
branch and commenting on that branch's own pull request tests nothing. It has
to be merged first.

**The application token needs `owner` set with no `repositories`.** Left at its
default, `actions/create-github-app-token` scopes the token to this repository
alone and every other managed repository comes back 404 — a run that looks
configured and reaches nothing.

**`RENOVATE_DRY_RUN` resolving to an empty string is what makes a scheduled run
real.** On a schedule there are no inputs at all, and on a dispatch with
`dryRun` left at `disabled` the expression yields `''`. Renovate skips empty
environment variables, so the emptiness is load-bearing — an expression that
yields `disabled` instead would turn every scheduled run into a no-op.

**A managed repository's own `renovate.json` replaces list-valued settings
rather than appending to them.** `extends` in particular: a repository shipping
its own config does not inherit `config:recommended` from `config.js` and has to
restate it. That is why every managed repository names `config:recommended`
itself rather than inheriting it, and it is the reason the shared preset exists
— see the trap below.

**Turning something off in `config.js` does not turn it off anywhere that
extends a preset turning it on.** Five of the six managed repositories ship
their own config, at `.github/renovate.json` rather than the root, and every
one of them extends `config:recommended` — which is merged over the global file
and reinstates whatever it disabled. So a key in `config.js` reaches
`kanso-labs/daily` and nothing else, while reading like org-wide policy.

`dependencyDashboard` is the setting this bit. **Anything that has to hold
everywhere goes in `local>kanso-labs/.github:renovate-config`**, the shared
preset in `kanso-labs/.github`, which `config.js` and each repository's own
config both extend — and always after `config:recommended`, because a later preset wins.
Putting it in `config.js` instead is the mistake, and it is a quiet one.

A dry run is what catches it: `Would ensure Dependency Dashboard` naming a
repository is the signal that the repository is not picking up what the config
claims.

The preset now holds every setting that was restated in all five — the pull
request limits, `rebaseWhen`, `recreateWhen`, the semantic-commit settings,
`mise`, and the two package rules. **A setting only some repositories want does
not belong there**, because a consumer cannot opt out of a preset it extends
except by restating the opposite. `minimumReleaseAge` is the live example:
`unplugin-style-dictionary` deliberately takes it from
`security:minimumReleaseAgeNpm` instead, and a top-level value in the preset
would override that, since the preset is extended last.

**A preset reference is checked by `Dry run Renovate`, and not by the
validator.** `renovate-config-validator` does not resolve remote presets at
all, so a mistyped or not-yet-merged preset passes it and passes the `Validate`
job. Renovate itself resolves every preset at startup and exits
`config-presets-invalid`, so the dry run fails the pull request here — which
also means **a pull request adding a preset reference stays red until the
preset is on the source repository's default branch**, and that is correct
rather than something to work around.

The managed repositories have no equivalent job. The same mistake in one of
them passes every check and surfaces on the next scheduled run, as a config
error raised on that repository rather than as a red run here.

`force` in `config.js` overrides the repositories from here instead, because
`mergeChildConfig` spreads it last. It is deliberately unused: it would take
away a repository's ability to differ when it has a reason to.

**`requireConfig: 'optional'` is required alongside `onboarding: false`.**
Without it, repositories that ship no `renovate.json` are skipped rather than
picking up the defaults in `config.js` — which is most of the managed set.

**Losing the app's Workflows: write permission is a partial outage, not an
obvious one.** GitHub rejects any push touching `.github/workflows/`, so
action-pin bumps in this repository and in `kanso-labs/actions` fail
while every other update keeps working.
