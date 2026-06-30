# Quick Grade Security - Interview Demo Guide

## What to Say in Interview

"I added a security layer to my Quick Grade website. It runs on every request
and protects against common web attacks. Here's how it works:"

## Live Demo Steps (2 minutes)

### Step 1: Show Real Site
- Open `qg-1.vercel.app` → Upload a normal marksheet → "Works perfectly"

### Step 2: Show Attack Blocking
Try these in browser URL bar (replace `qg-1.vercel.app` with your URL):

```
qg-1.vercel.app?search=test'%20OR%201=1--
qg-1.vercel.app?<script>alert('xss')</script>
qg-1.vercel.app/../../etc/passwd
```

**Result:** JSON response with "Request blocked" + threat type

### Step 3: Show Security Dashboard
- Open `qg-1.vercel.app/security`
- Shows real-time attack count, blocked IPs, threat types

### Step 4: Show Code (GitHub)
- Open your GitHub repo
- Point to `src/middleware.ts` → "This runs on every request"
- Point to `src/lib/security.ts` → "Attack detection patterns"

## Key Interview Answers

**Q: What security did you add?**
"A middleware that runs on every HTTP request. It detects SQL injection,
XSS, path traversal, and command injection patterns. Malicious requests
are blocked before reaching the application."

**Q: How does it work?**
"Pattern matching on request URLs. If a suspicious pattern is found,
the request is rejected with a 403 response. All events are logged."

**Q: What about false positives?**
"The patterns are specific enough to avoid blocking normal requests.
For example, we only block SQL keywords when they appear in query
parameters, not in normal text."

**Q: Did you use any security library?**
"No, I implemented the detection logic myself. This shows I understand
the underlying attack patterns, not just how to use a library."

## Files to Reference

| File | What It Does |
|------|--------------|
| `src/middleware.ts` | Entry point - runs on every request |
| `src/lib/security.ts` | Attack detection patterns |
| `src/lib/rate-limiter.ts` | Rate limiting (100 req/min) |
| `src/app/api/security/logs/route.ts` | Security logs API |
| `src/components/security-dashboard.tsx` | Dashboard UI |
| `src/app/security/page.tsx` | Security page |
| `next.config.ts` | Security headers |

## Attack Patterns Detected

```
SQL Injection:  ' OR '1'='1, UNION SELECT, DROP TABLE, --
XSS:            <script>, javascript:, onerror=
Path Traversal: ../, ..\, /etc/passwd, /etc/shadow
Command Injection: ; ls, | cat, $(whoami), `id`
```

## What Impresses Interviewers

1. **Real-time protection** - Attacks blocked instantly
2. **Security dashboard** - Visual proof it works
3. **Self-implemented** - Shows deep understanding
4. **Production-ready** - Rate limiting, headers, logging
5. **Clean code** - Modular, typed, well-structured
