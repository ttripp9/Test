# Plinth

A link-in-bio store for creators. Sell digital downloads, courses, 1:1 calls, memberships, bundles and tips from one link — with email automation, tracking pixels, coupons, order bumps, upsells and affiliates included.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run db:seed     # demo creator: demo@example.com / demo-password-123
npm run dev         # http://localhost:3000  →  demo store at /maya
```

Without Stripe keys, checkout runs in **demo mode** (no real charges). Demo mode is off in production unless `ALLOW_DEMO_PAYMENTS=true`.

## Plans (edit in `src/lib/plans.ts`)

| | Free | Pro $19/mo | Business $49/mo |
|---|---|---|---|
| Transaction fee | 5% | 0% | 0% |
| Products | 3 | 50 | 500 |
| Email automation & pixels | ✓ | ✓ | ✓ |
| Courses, memberships, bundles | – | ✓ | ✓ |
| Affiliates | – | ✓ | ✓ |
| Custom CSS, remove branding | – | – | ✓ |

## Going live

1. Set `APP_URL` to your https domain.
2. Stripe: set `STRIPE_SECRET_KEY`, create Pro/Business prices (`STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`), enable Connect (Express), and add a webhook to `/api/stripe/webhook` for both your account (`STRIPE_WEBHOOK_SECRET`) and connected accounts (`STRIPE_CONNECT_WEBHOOK_SECRET`). Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`, `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`.
3. Email: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`.
4. Set random values for `CRON_SECRET` and `ANALYTICS_SALT`.
5. `npm run build && npm start`. The email queue runs inside the server every minute; for several servers set `RUN_INLINE_WORKER=false` and run `npm run worker` once.

Data lives in SQLite (`DATABASE_PATH`) and uploads in `STORAGE_DIR` — back both up.

## Security notes

- scrypt password hashing, hashed session tokens, login/signup/checkout rate limits
- All prices computed server-side; coupons, bumps and booking slots re-validated at checkout
- Creator content rendered through an escaping Markdown renderer; custom CSS sanitised; pixel IDs validated
- Stripe webhooks signature-checked, de-duplicated, and matched to the owning connected account
- Download links are secret tokens with download limits; image uploads are type-sniffed
- Strict security headers and CSP (`next.config.ts`)

## Tests

```bash
npm test        # unit + integration tests (pricing, bookings, checkout, email automation, XSS)
npm run lint    # type check
```
