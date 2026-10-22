# Personal IT Assistant: Product Spec (v1)

Working name: **Fixwise** (placeholder)

## 1. Summary

A web app that acts as a plain-English IT helper for people who don't have an IT department. It does three things:

1. **Ask:** a chat assistant that walks users through tech problems step by step ("my Wi-Fi keeps dropping").
2. **Check:** a health check that scans accounts, email and devices for common problems and gives a simple report card.
3. **Protect:** scam and risk checks (suspicious links, texts, breached accounts) with plain warnings.

One core product serves three audiences through different plans:

| Plan | Who | Main job |
|---|---|---|
| **Personal** | Any individual | Fix my tech problems; keep my accounts safe |
| **Family** | Adult children helping parents | Help my relatives remotely; stop scams |
| **Business** | 1–10 person businesses | Be our IT person: security basics, onboarding, compliance |

The engine is the same for all three: assistant, checks, fixes and alerts. Plans only change who is managed, which checks run and the price.

## 2. Problem

- Most people have no one to call when tech breaks. Search results are scattered, outdated or full of ads.
- Older adults are the main target of scams, and their families can't easily help from a distance.
- Small businesses can't afford an MSP ($100–200 per user per month) but still need MFA, backups, email security and cyber-insurance answers.

## 3. Target users

- **Pat (Personal):** 35, not technical, has 3 devices and 40 accounts, gets confused by settings menus.
- **Sam (Family):** 45, the "tech person" for their parents, tired of 30-minute phone calls about the printer.
- **Riley (Business):** owns a 6-person firm, just got a cyber-insurance questionnaire asking about MFA and backups.

## 4. What a web app can and can't do

This decides the v1 scope.

**Can do in v1**
- AI chat troubleshooting with guided steps and screenshots or links.
- Domain and email checks from public DNS (SPF, DKIM, DMARC, MX, TLS on website).
- Breach checks for email addresses (Have I Been Pwned API, with user consent).
- Account-level checks through OAuth to Google Workspace and Microsoft 365 (MFA status, admin count, forwarding rules, sharing settings).
- Link and text scam checks (user pastes it in; URL reputation APIs + AI analysis).
- Guided device checklists the user confirms ("Is FileVault on? Here's how to check").
- Browser-based network speed and latency test.
- Family/team dashboard, alerts by email and SMS.

**Can't do in v1 (needs a native app or agent later)**
- Read device settings directly (disk encryption, OS version, antivirus).
- Remote screen control.
- Automatically screen incoming texts or calls.

These move to the roadmap (section 10) as a lightweight desktop agent and mobile companion app.

## 5. MVP features

### 5.1 Assistant (all plans)
- Chat that asks clarifying questions, then gives numbered steps for the user's specific device and OS.
- "Did that work?" loop; escalates to a different fix or a human-help suggestion.
- Common topics prebuilt as guided flows: Wi-Fi, slow computer, phone storage, printer, email setup, password reset, 2FA setup, new phone transfer, Bluetooth.
- Saves device profile (e.g., "iPhone 15, iOS 26; Windows 11 laptop") so answers are specific.
- Safety rules: never ask for passwords; warns before any step that could lose data; refuses to help bypass security on accounts the user doesn't own.

### 5.2 Health check (all plans, different checks per plan)

| Check | Personal | Family | Business |
|---|---|---|---|
| Breached email addresses | ✓ | ✓ (each member) | ✓ (each user) |
| Password manager in use | ✓ (guided) | ✓ | ✓ |
| 2FA on key accounts (email, bank, Apple/Google) | ✓ (guided) | ✓ | ✓ |
| Device updates and encryption | ✓ (guided) | ✓ | ✓ |
| Backups set up and tested | ✓ (guided) | ✓ | ✓ |
| Domain email security (SPF, DKIM, DMARC) | — | — | ✓ (automatic) |
| Google/M365 MFA for all users | — | — | ✓ (OAuth) |
| Too many admins, risky forwarding rules | — | — | ✓ (OAuth) |
| Public file sharing links | — | — | ✓ (OAuth) |

Output: a score (A–F), a list of issues ranked by risk, and a "Fix it" button on each that opens a guided fix.

### 5.3 Scam checker (all plans)
- Paste a link, text, email or phone number and get a verdict: Safe / Suspicious / Scam, with the reason in one sentence.
- Family plan: relatives can forward suspicious texts/emails to a dedicated address or number; the family admin gets a copy of high-risk verdicts.

### 5.4 Family dashboard (Family plan)
- Add up to 5 relatives. Each gets a simple view: big "Help me" button, scam checker, guides.
- "Help me" sends the family admin a request with device info and what the relative was trying to do.
- Admin sees each relative's health check and recent scam alerts.

### 5.5 Business dashboard (Business plan)
- Connect Google Workspace or Microsoft 365.
- Users list with status per user (MFA, breached, device checklist done).
- Onboarding and offboarding checklists (create accounts, revoke access, transfer files).
- **Cyber-insurance helper:** pre-fills common questionnaire answers from scan results.
- Monthly re-scan with a summary email.

## 6. Out of scope for v1
- Native mobile or desktop apps.
- Remote control.
- Managing devices (MDM).
- The AI data-leak browser extension (planned paid add-on, see roadmap).
- Live human support.

## 7. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React, TypeScript), Tailwind | Fast to build, works on phone and desktop |
| Backend | Next.js API routes + background worker | One codebase for v1 |
| Database | PostgreSQL (with row-level security) | Multi-tenant (families, businesses) |
| Auth | Passkeys + email magic link; optional Google/Microsoft sign-in | No passwords to leak |
| AI | Claude API for the assistant and scam analysis | Strong reasoning, tool use |
| Jobs | Queue (e.g., BullMQ/Redis) for scans and monthly re-scans | Scans can be slow |
| Integrations | Google Workspace Admin SDK, Microsoft Graph, HIBP, URL reputation (Google Safe Browsing), DNS lookups | Data for checks |
| Payments | Stripe (subscriptions, per-seat billing) | Standard |
| Email/SMS | Postmark or Resend; Twilio | Alerts and forward-to-check |
| Hosting | Vercel or Fly.io + managed Postgres | Low ops |

## 8. Security and privacy (selling point)

Being a security product, this has to be trustworthy by design:

- **Least privilege OAuth:** read-only scopes for scans; write scopes only when the user clicks a specific fix.
- **No passwords ever** collected or typed into the app.
- **Encryption:** OAuth tokens encrypted at rest with per-tenant keys (KMS); TLS everywhere.
- **Data minimization:** store scan results, not raw mailbox or file contents. Scam-check submissions deleted after 30 days.
- **AI privacy:** strip personal data from chats where possible; no training on customer data; clear notice of what's sent to the AI provider.
- **Consent for Family plan:** relatives must accept the invite and can see exactly what the admin sees. No hidden monitoring.
- **Tenant isolation:** row-level security in Postgres, tested in CI.
- **Audit log** of every admin action and every fix applied.
- **Own hygiene:** dependency and secret scanning in CI, regular pen test before launch, security.txt and a disclosure policy.
- **Compliance path:** SOC 2 Type I after first paying business customers.

## 9. Pricing (to validate)

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | One health check, 10 assistant chats/month, 5 scam checks/month |
| Personal | $6/month or $60/year | Unlimited assistant and scam checks, monthly re-check, breach alerts |
| Family | $12/month or $120/year | Admin + up to 5 relatives, "Help me" requests, scam alerts to admin |
| Business | $8/user/month (min $40/month) | Google/M365 scans, email security, onboarding/offboarding, insurance helper, monthly report |

The free health check is the main way new customers find the product.

## 10. Roadmap

| Phase | Timing | Scope |
|---|---|---|
| **v1 MVP** | Weeks 1–8 | Assistant, health check, scam checker, Personal + Family plans |
| **v1.1** | Weeks 9–12 | Business plan: Google Workspace first, then M365; insurance helper |
| **v2** | Months 4–6 | Desktop agent (reads device settings, one-click fixes); AI data-leak browser extension (Business add-on) |
| **v3** | Months 6–9 | Mobile companion app (scam text screening on Android, help button); remote assist |

## 11. Competitors

| Competitor | What they do | Our angle |
|---|---|---|
| Aura, Norton 360 | Identity and device protection bundles | We fix problems and explain them, not just alert |
| GrandPad | Senior tablet + service | No special hardware; works on devices they already own |
| Carefull | Financial monitoring for seniors | We cover all tech help, not just money |
| ChatGPT / general AI | Free answers | Ours knows your devices, checks your accounts and tracks fixes |
| MSPs | Full managed IT | 10× cheaper for tiny businesses |
| JumpCloud, Kandji, Electric | IT management platforms | Built for owners, not IT admins |

## 12. Success metrics
- Free health check → signup rate: target 25%.
- Free → paid conversion: target 5% at 60 days.
- Issues fixed per user in first week: target 3+.
- Family plan: "Help me" requests resolved without a phone call: target 60%.
- Monthly churn: under 4%.

## 13. Risks

| Risk | Mitigation |
|---|---|
| AI gives a wrong or harmful fix | Prebuilt flows for top topics; warnings before risky steps; feedback loop and review of bad answers |
| Trying to serve three audiences at once | Shared engine; launch Personal + Family first, Business in v1.1 |
| Google/Microsoft OAuth app verification takes time | Start verification in week 1; use restricted scopes |
| Liability if a scam is missed | Clear "advice, not guarantee" terms; show confidence level |
| Low willingness to pay for consumer plans | Annual pricing; sell Family plan to adult children as peace of mind |

## 14. Open questions
1. Final product name and domain.
2. Launch with Personal + Family first, or Business first? (Business pays more; consumer is easier to market.)
3. Offer an optional paid "talk to a human" tier?
4. Which region first (US only for v1 because of SMS and privacy laws)?
