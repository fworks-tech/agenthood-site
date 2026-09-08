# Security Policy

## Supported versions

We actively maintain the latest release. Security fixes are applied to `main` and included in the next deployment.

## Reporting a vulnerability

Please report security vulnerabilities by opening a [GitHub Security Advisory](https://github.com/fworks-tech/agenthood-site/security/advisories/new) or by emailing the maintainer directly.

Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 14 days.

## Security measures

- Cloudflare Turnstile CAPTCHA on all Studio API endpoints
- Server-side rate limiting (sliding window, 20 req/min per endpoint)
- SSRF protection on custom provider base URLs
- Security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options)
- Input validation at all API boundaries
- No secrets stored in code or logs
