// Configuration for the dry run that `Validate` performs on every pull request.
//
// That dry run exists to cover `renovatebot/github-action`, which is the one
// dependency Renovate bumps here that nothing else exercises — the real run
// only happens on the schedule in `renovate.yaml`, so before this, a bump to it
// reached main untested. It is also the worst one to have uncovered: it is what
// runs Renovate against every managed repository, and README.md records that
// when this breaks, it breaks silently.
//
// Derived from `config.js` rather than written out, so the dry run exercises
// the real global config and proves it loads under the Renovate runtime instead
// of only passing schema validation.
//
// The narrowing to this repository is what lets the job authenticate with its
// own GITHUB_TOKEN instead of RENOVATE_TOKEN, which keeps a token that can write
// to every managed repository out of pull-request-triggered CI on a public
// repository. It is done here rather than through RENOVATE_REPOSITORIES because
// Renovate does not document whether an environment variable outranks
// `repositories` from a configuration file, and guessing wrong would silently
// widen the dry run to repositories GITHUB_TOKEN cannot read.
//
// The filename is deliberately not one Renovate auto-discovers, so this is
// never mistaken for the repository's own configuration.
module.exports = {
  ...require('./config.js'),
  repositories: ['kanso-labs/renovate'],
};
