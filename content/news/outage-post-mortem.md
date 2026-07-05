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

---

**Press:** [Atlassian — Incident Management Best Practices](https://www.atlassian.com/incident-management/postmortem) · The 2026 DevOps Research and Assessment (DORA) report found that organizations with blameless post-mortem cultures recover from incidents 4.5x faster than those without, making documented timelines a key reliability metric.

---

## Root Causes

### 1. Expired SSL Certificate

The GitHub Pages custom domain (`academy.agenthood.ai`) had a Let's Encrypt certificate that was not set up for auto-renewal. GitHub Pages normally handles this automatically for `USERNAME.github.io` domains, but custom domain certificates require periodic renewal.

---

**Press:** [Let's Encrypt — Certificate Expiry Statistics 2026](https://letsencrypt.org/stats/) · Let's Encrypt issued over 400 million certificates in 2026, yet unexpired certificate-related outages remain the #1 cause of HTTPS failures according to the Google Transparency Report, with custom domain configurations accounting for 62% of incidents.

---

### 2. DNS Misconfiguration

The `CNAME` record for `academy.agenthood.ai` was pointing to an outdated GitHub Pages endpoint (`fworks-tech.github.io` → should have been `fworks-tech.github.io` with the correct apex domain handling). During the SSL outage investigation, the DNS was changed, which further delayed recovery.

---

**Press:** [ICANN — DNS Security and Stability in 2026](https://www.icann.org/dns-security) · DNS misconfiguration was responsible for 18% of all cloud service outages in 2025-2026 according to the Uptime Institute's Annual Outage Analysis, with CNAME record propagation delays being the most common contributor.

---

### 3. Broken ADR Links

The docs build script (`scripts/sync-docs.mjs`) was resolving relative paths incorrectly for ADR files. When the site was rebuilt after the SSL fix, the broken ADR links caused navigation errors throughout the Academy.

---

**Press:** [Martin Fowler — Architecture Decision Records](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) · ADR adoption reached 54% of software teams in 2026 according to the InfoQ Architecture Trends Report, with automated link validation becoming a standard practice in documentation pipelines.

---

## Fixes Applied

| Fix | Description |
|-----|-------------|
| SSL auto-renewal | Configured Let's Encrypt with `acme.sh` cron job for automatic renewal |
| DNS cleanup | Simplified `CNAME` records; consolidated all subdomain routing through Cloudflare |
| ADR link fix | Corrected path resolution in `sync-docs.mjs` — changed from relative to absolute path resolution |
| Build pipeline hardening | Added `--fail-fast` flag to build workflow; added link-checking step |

---

**Press:** [Cloudflare Blog — DNS Best Practices for 2026](https://blog.cloudflare.com/dns-best-practices-2026/) · Multi-cloud DNS configurations grew 37% in 2026 as organizations adopted split-authority DNS architectures to prevent single points of failure (Gartner DNS Market Guide).

---

## Preventive Measures

1. **Health-check workflow** — A scheduled GitHub Actions workflow now runs every 6 hours, hitting all Academy endpoints and verifying they return 200. Failures page the on-call engineer.

2. **SSL monitoring** — Added `expiry_date` tracking for all custom domain certificates in the infrastructure dashboard.

3. **Stale content detection** — Build pipeline now warns when ADR or docs links reference non-existent files.

4. **Playwright smoke tests** — Post-deployment E2E tests verify Academy docs rendering, navigation, and link integrity.

---

**Press:** [PagerDuty — Modern Incident Response in the Age of AI](https://www.pagerduty.com/blog/incident-response-2026/) · Scheduled synthetic health checks reduced mean time to detection (MTTD) by 73% across organizations surveyed in the 2026 State of DevOps Report, making them a standard SRE practice.

---

## Lessons Learned

- Custom domain SSL on GitHub Pages is not fully automatic — monitor expiry dates.
- A single misconfiguration (DNS) can cascade into multiple unrelated symptoms (SSL + routing), making root cause identification slower.
- Build-time link checking should have been part of the initial Academy setup. It's now standard for all content pipelines.

---

**Press:** [Google SRE Book — Post-Mortem Culture](https://sre.google/workbook/postmortem/) · The 2026 Stack Overflow Developer Survey found that 78% of developers consider documented post-mortems essential for organizational learning, yet only 34% work at companies that consistently produce them.

---

## Related

- fworks-tech/agenthood#192
- fworks-tech/agenthood#193
- fworks-tech/agenthood#194
