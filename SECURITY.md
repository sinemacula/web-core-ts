# Security Policy

## Reporting a vulnerability

Do not open a public issue for security problems. Report suspected vulnerabilities privately to
<bdmc@sinemacula.co.uk> with a description of the issue, reproduction steps, and the affected commit or release.
You will receive an acknowledgement within two business days.

Please allow a reasonable disclosure window before sharing details publicly; we will keep you informed of the
remediation progress.

## Scope

This repository contains a frontend framework kernel and its reference application. Reports of most value
here include: cross-site scripting, token or session handling flaws, dependency vulnerabilities not yet
flagged by automated scanning, build or supply-chain weaknesses, and information disclosure through the
built artifact (source maps, environment leakage).

## Supported versions

Only the latest release is supported with security fixes.

## Security headers baseline

Applications built on this kernel are served statically from S3 behind CloudFront, so response headers must
be attached by a CloudFront response-headers policy (implemented in the platform infrastructure repository).
Deployments of a consuming application are expected to ship the following baseline:

| Header                      | Value                                                                   |
|-----------------------------|-------------------------------------------------------------------------|
| `Content-Security-Policy`   | See below                                                               |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`                          |
| `X-Content-Type-Options`    | `nosniff`                                                               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                       |
| `Permissions-Policy`        | `camera=(), geolocation=(), microphone=()` (extend as features require) |

Baseline content-security policy, adjusted per environment for the API and realtime origins:

```text
default-src 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' <api-origin> <stream-origin>;
frame-ancestors 'none';
base-uri 'none';
form-action 'self'
```

Notes: `style-src 'unsafe-inline'` accommodates Vue's injected component styles; `connect-src` must list
the runtime `API_URL` and `STREAM_URL` origins; `frame-ancestors 'none'` supersedes `X-Frame-Options`.
Tokens are held in `localStorage`, which makes a strict CSP the primary XSS mitigation - treat any
relaxation of `script-src` as a security review trigger.
