# Changelog

All notable changes to the Alogram PayRisk TypeScript SDK will be documented in this file.

## [0.1.6-rc.3] - 2026-02-10

### Added
- Standardized "Smart" client architecture with hand-written façade.
- Dual-module support (ESM and CommonJS) via explicit `exports` map.
- Resilient retry logic (429 & 5xx) with jittered backoff.
- Native OpenTelemetry support for all risk operations.

### Changed
- Optimized `typescript-fetch` generator configuration for broader browser/Node compatibility.
- Synchronized with Payments Risk API v0.1.6-rc.3.

## [0.1.6-rc.1] - 2026-02-10

### Added
- Support for OpenTelemetry tracing in CheckRisk and Signal Ingestion.
- Improved error mapping for API status codes.

### Changed
- Synchronized with Payments Risk API v0.1.6.