---
title: "Agenthood Academy Outage Post-Mortem"
date: 2026-04-28
author: Agenthood Team
---

# Agenthood Academy Outage Post-Mortem

**Date:** April 28, 2026  
**Severity:** Partial — Academy docs unavailable for ~4 hours  
**Root cause:** Chain of misconfigurations across DNS, SSL, reverse proxy routing, and stale build artifacts.

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 08:14 | GitHub Pages custom domain certificate expired, breaking HTTPS for `academy.agenthood.ai` |
| 08:17 | Monitoring alert fired: Academy returning 502 |
| 08:43 | On-call begins investigation |
| 09:05 | Identified expired SSL cert; re-issued via Let's Encrypt |
| 09:22 | SSL restored, but docs content fails to render — blank pages |
| 09:50 | Discovered broken ADR links in docs navigation; all relative links pointing to wrong paths |
| 10:35 | ADR link generation fixed in `sync-docs.mjs` — path resolution was using incorrect base |
| 11:02 | GitHub Actions workflow re-triggered; site rebuilt with corrected paths |
| 11:18 | Academy fully restored |
| 12:00 | Post-mortem meeting; health-check workflow drafted |

## Root Causes

### 1. Expired SSL Certificate

The GitHub Pages custom domain (`academy.agenthood.ai`) had a Let's Encrypt certificate that was not set up for auto-renewal. GitHub Pages normally handles this automatically for `USERNAME.github.io` domains, but custom domain certificates require periodic renewal.

### 2. DNS Misconfiguration

The `CNAME` record for `academy.agenthood.ai` was pointing to an outdated GitHub Pages endpoint (`fworks-tech.github.io` → should have been `fworks-tech.github.io` with the correct apex domain handling). During the SSL outage investigation, the DNS was changed, which further delayed recovery.

### 3. Broken ADR Links

The docs build script (`scripts/sync-docs.mjs`) was resolving relative paths incorrectly for ADR (Architecture Decision Record) files. When the site was rebuilt after the SSL fix, the broken ADR links caused navigation errors throughout the Academy.

## Fixes Applied

| Fix | Description |
|-----|-------------|
| SSL auto-renewal | Configured Let's Encrypt with `acme.sh` cron job for automatic renewal |
| DNS cleanup | Simplified `CNAME` records; consolidated all subdomain routing through Cloudflare |
| ADR link fix | Corrected path resolution in `sync-docs.mjs` — changed from relative to absolute path resolution |
| Build pipeline hardening | Added `--fail-fast` flag to build workflow; added link-checking step |

## Preventive Measures

1. **Health-check workflow** — A scheduled GitHub Actions workflow now runs every 6 hours, hitting all Academy endpoints and verifying they return 200. Failures page the on-call engineer.

2. **SSL monitoring** — Added `expiry_date` tracking for all custom domain certificates in the infrastructure dashboard.

3. **Stale content detection** — Build pipeline now warns when ADR or docs links reference non-existent files.

4. **Playwright smoke tests** — Post-deployment E2E tests verify Academy docs rendering, navigation, and link integrity.

## Lessons Learned

- Custom domain SSL on GitHub Pages is not fully automatic — monitor expiry dates.
- A single misconfiguration (DNS) can cascade into multiple unrelated symptoms (SSL + routing), making root cause identification slower.
- Build-time link checking should have been part of the initial Academy setup. It's now standard for all content pipelines.

## Related

- fworks-tech/agenthood#192
- fworks-tech/agenthood#193
- fworks-tech/agenthood#194
