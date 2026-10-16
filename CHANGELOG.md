# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `CODEOWNERS` file for mandatory review on money-path files (#623)
- `CHANGELOG.md` for tracking notable changes (#624)
- `aria-expanded`/`aria-haspopup` and Escape-to-close on Navbar Dashboards trigger (#625)
- `DataSourceNotice` on issue detail and reputation pages when serving mock data (#626)

### Changed
- Stat grid on issue detail reflows to 2x2 when milestone is present (#443)
- `aria-current="page"` on DashboardShell nav and role-switcher links (#444)
- Account sequence number caching in SDK `BaseClient` (#71)
- Configurable poll interval and attempt count for transaction confirmation (#72)
- `simulateWithResources()` on `PreparedCall` for fee estimation (#73)
- `AbortSignal` support on `simulate()` and `signAndSend()` (#74)

### Fixed
- Dashboard error boundary shared across all three dashboard sub-routes (#441)
- Keyboard navigation tests for Tabs component (#442)
- Sensitive query parameters masked in logging interceptor (#596)
- Conditional policy revert to prevent concurrent status overwrites (#597)
- Friendbot retry logging with attempt counts and delays (#1338)
- `.dev-seed` file permission warnings (#1339)
- CoinGecko client cache invalidation on API key change (#331)
- IPv6 private range coverage in SSRF validation (#332)

## [0.1.0] - 2026-10-01

### Added
- Initial release with bounty, milestone, and reputation features
- Stellar/Soroban smart contract integration
- Responsive dark/light theme
- WCAG 2.1 AA accessibility baseline
