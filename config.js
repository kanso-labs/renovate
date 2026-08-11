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
  // Fallback policy for repositories that have no renovate.json of their own.
  // A repository that ships its own config replaces these values rather than
  // merging with them, so it should restate the presets it needs.
  extends: ['config:recommended'],

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
  repositories: [
    'kanso-labs/home-assistant-applications',
    'kanso-labs/home-server',
    'kanso-labs/renovate',
  ],

  // Required alongside `onboarding: false`, otherwise repositories without a
  // renovate.json are skipped instead of picking up the defaults above.
  requireConfig: 'optional',
  timezone: 'America/Sao_Paulo',
};
