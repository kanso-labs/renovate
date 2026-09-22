// Global configuration for the kanso-labs self-hosted Renovate runner.
//
// This file is the single source of truth for which repositories Renovate
// manages and for the policy shared between them. Repository-level settings
// are merged on top of this, so anything specific to one repository belongs in
// that repository's own renovate.json instead.
//
// Validate changes before pushing:
//   npx --yes --package renovate -- renovate-config-validator --strict config.js
module.exports = {
  // Fallback policy for repositories that have no config of their own. A
  // repository that ships one replaces these values rather than merging with
  // them, so it should restate the presets it needs.
  //
  // `local>kanso-labs/.github:renovate-config` is the organization's shared
  // Renovate preset, and it comes after `config:recommended` because a later
  // preset wins a conflict with an earlier one. Listed first it would be
  // overridden by the very preset it exists to correct.
  //
  // Settings shared across the organization belong in that preset rather than
  // in this file, and `dependencyDashboard: false` is the one that proved why.
  // A key written here reaches `kanso-labs/daily` alone: the other five
  // managed repositories ship their own config, that config is merged over
  // this file, and every one of them re-extends `config:recommended` — which
  // reinstates whatever was disabled here. Those five extend the shared preset
  // too, which is the other half of the arrangement.
  //
  // A `force` block would override them from this file instead, and is
  // deliberately not used: it is applied after a repository's own config, so
  // it would also take away that repository's ability to differ when it has a
  // reason to.
  extends: [
    'config:recommended',
    'local>kanso-labs/.github:renovate-config',
  ],

  // Deliberately no gitAuthor or username. Renovate discovers both from an
  // application token by asking GitHub which app the token belongs to, and
  // `platformCommit` — which defaults to enabling itself for application
  // tokens — makes GitHub set the commit author regardless of what is
  // configured here. Setting either one hides that rather than changing it.

  // Refreshing every lock file on a fixed cadence catches what a dependency
  // bump never reaches. A lock file pins the whole resolved tree, so a
  // transitive dependency can sit stale indefinitely while every direct
  // dependency in the manifest is current.
  //
  // Daily, in the three hours after midnight, rather than the default
  // `before 4am on monday`. A stale transitive pin survives a day at worst
  // instead of a week, and a refresh that breaks a build surfaces the next
  // morning rather than the following Monday.
  //
  // The minutes field has to be `*`. Renovate schedules are windows with
  // one-hour granularity rather than points in time, so `0 0 * * *` is
  // rejected outright and `* 0-2 * * *` is the whole 00:00-02:59 window, read
  // in the `timezone` set below rather than in UTC.
  //
  // The width is delay tolerance, not extra chances to run. The window lands
  // at 03:00-05:59 UTC, where the `0 */3 * * *` cron in renovate.yaml fires
  // once, at 03:00. GitHub delays scheduled workflows under load and load
  // peaks at the top of the hour, so the two extra hours are what absorb that
  // delay: just under three hours of it, against the 59 minutes a
  // single-hour window would allow. A delay past the window skips the day.
  //
  // This is one pull request, not one a day. Renovate keeps a single
  // `lock-file-maintenance` branch and refreshes it in place. `recreateWhen`
  // is `always` below, so closing it unmerged brings it back tomorrow rather
  // than next week.
  lockFileMaintenance: {
    enabled: true,
    schedule: ['* 0-2 * * *'],
  },

  // Repositories opt in by being listed here, not by merging an onboarding PR.
  onboarding: false,
  packageRules: [
    {
      automerge: true,
      matchUpdateTypes: ['patch'],
    },
  ],
  platform: 'github',

  // Homelab repositories: no reason to spread updates over time.
  prConcurrentLimit: 0,
  prHourlyLimit: 0,
  rebaseWhen: 'behind-base-branch',
  recreateWhen: 'always',

  // Adding or removing a repository is a reviewable change to this list.
  //
  // Every entry has to exist. A name Renovate cannot resolve fails the whole
  // run with `platform-unknown-error` — not just that repository — so deleting
  // a repository without deleting it here stops updates everywhere. Renaming
  // one does the same thing.
  repositories: [
    'kanso-labs/actions',
    'kanso-labs/daily',
    'kanso-labs/home-assistant-applications',
    'kanso-labs/kanso-ui',
    'kanso-labs/renovate',
    'kanso-labs/unplugin-style-dictionary',
  ],

  // Required alongside `onboarding: false`, otherwise repositories without a
  // renovate.json are skipped instead of picking up the defaults above.
  requireConfig: 'optional',
  timezone: 'America/Sao_Paulo',
};
