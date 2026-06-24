# Marketplace

A full-stack peer-to-peer marketplace: a **Laravel 11 API** backed by a **React Native (Expo)** mobile app, with real-time buyer/seller chat, Stripe Connect escrow checkout, and media served from AWS.

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │   React Native (Expo) app     │
                         │  Explore · Messages · Sell ·  │
                         │  Profile · ListingDetail·Chat │
                         └───────────────┬──────────────┘
                                         │  HTTPS  (JWT: Authorization: Bearer)
                                         ▼
        S3 + CloudFront        ┌──────────────────────────────┐        Pusher Channels
        (listing/avatar  ◀────▶│   Nginx  +  Laravel API       │◀──────▶ private-conversation.{id}
         media via CDN)        │   on EC2  (PHP 8.2)           │         event: message.sent
                               └───────┬───────────────┬──────┘
                                       │               │
                Stripe Connect ◀───────┘               ▼
        (manual-capture escrow,                ┌────────────────────┐
         10% platform fee)                     │  RDS PostgreSQL     │
                                               │  (chat_marketplace) │
                                               └────────────────────┘

        ┌───────────────────────────────────────────────┐
        │  Supervisor → php artisan queue:work           │
        │  drains the database queue and broadcasts the  │ ──────▶ Pusher
        │  queued MessageSent (ShouldBroadcast) event    │
        └───────────────────────────────────────────────┘
```

The mobile app talks to the Laravel API over HTTPS. The API persists to **RDS PostgreSQL**, stores uploaded media on **S3** (returned through a **CloudFront** CDN domain), charges through **Stripe Connect**, and emits chat events to **Pusher**. Because `MessageSent` is a queued `ShouldBroadcast` event, a **Supervisor-managed queue worker** must be running for real-time messages to actually reach Pusher.

---

## Tech Stack

**Backend**
- Laravel 11 / PHP 8.2
- JWT auth (`tymon/jwt-auth`, guard `api`, token field `access_token`)
- Roles via `spatie/laravel-permission` (`buyer` | `seller` | `admin`)
- Stripe Connect — manual-capture escrow with a 10% platform fee
- Pusher — private channel `private-conversation.{id}`, event `message.sent` (queued `ShouldBroadcast`)

**Mobile**
- React Native (Expo) — bottom tabs (Explore / Messages / Sell / Profile) plus ListingDetail + Chat
- Orange `#E65100` accent

**Infrastructure**
- AWS EC2 (Nginx + PHP-FPM) · RDS PostgreSQL · S3 · CloudFront

---

## Features

- **Authentication & roles** — JWT login/register; `buyer`, `seller` and `admin` roles via spatie/laravel-permission.
- **Listings with search & filters** — keyword, category, price range, condition and status filters, plus location/radius search; images uploaded to S3 and served via CloudFront.
- **Real-time chat** — per-listing buyer ↔ seller conversations over a Pusher private channel (`private-conversation.{id}`, event `message.sent`).
- **Stripe Connect escrow checkout** — manual-capture PaymentIntents hold funds in escrow; the platform retains a 10% fee and the remainder is routed to the seller.
- **Seller onboarding** — sellers complete Stripe Connect onboarding from the app (Profile → Set up payments) to receive payouts.

---

## Repository layout

```
.                        # Laravel 11 backend (API) lives at the repo root
├── app/                 # Models, controllers, services (e.g. ImageUploadService)
├── database/seeders/    # RoleSeeder, CategorySeeder, DemoSeeder
├── routes/
├── README_PHASE1.md     # Phase 1 notes — listings, search, S3 images
├── README_PHASE2.md     # Phase 2 notes — real-time chat / Pusher
├── README_PHASE3.md     # Phase 3 notes — Stripe Connect payments
└── mobile/              # React Native (Expo) client
    └── README.md        # how to run the mobile app
```

Backend code is at the repository root; the Expo client lives in `mobile/`. Phase-by-phase notes are in `README_PHASE1.md`, `README_PHASE2.md` and `README_PHASE3.md`, and the mobile app has its own `mobile/README.md`.

---

## Local setup

```bash
# 1. Clone and install PHP dependencies
git clone <repo-url> chat-marketplace
cd chat-marketplace
composer install

# 2. Environment
cp .env.example .env
php artisan key:generate     # sets APP_KEY
php artisan jwt:secret        # sets JWT_SECRET

# 3. Choose a database (see caveat below), then migrate + seed
php artisan migrate --seed

# 4. Run the queue worker (REQUIRED for chat broadcasts) — in a separate terminal
php artisan queue:work

# 5. Serve the API
php artisan serve
```

**Database choice.** SQLite works out of the box for most local development, **except** the location/radius search, which relies on SQL math functions SQLite does not provide. For that feature (and to mirror production) use **PostgreSQL or MySQL**. Production runs **PostgreSQL on AWS RDS** — set `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT=5432`, `DB_DATABASE=chat_marketplace`, `DB_USERNAME`, `DB_PASSWORD` (or a single `DB_URL`).

> The queue worker matters: `MessageSent` is dispatched via the queue (`QUEUE_CONNECTION=database`), so without `php artisan queue:work` running, real-time chat never reaches Pusher. For quick local dev you can instead set `QUEUE_CONNECTION=sync` to fire broadcasts inline.

Once the API is up, follow **[`mobile/README.md`](mobile/README.md)** to install dependencies and run the Expo app.

---

## Demo credentials

`php artisan migrate --seed` runs `DemoSeeder`, which creates the accounts below. **All demo accounts share the password `password123`.**

| Role   | Name        | Email             | Password    |
| ------ | ----------- | ----------------- | ----------- |
| Seller | Sarah Chen  | seller1@demo.com  | password123 |
| Seller | Marcus Lee  | seller2@demo.com  | password123 |
| Seller | Elena Rossi | seller3@demo.com  | password123 |
| Buyer  | Bob Buyer   | buyer1@demo.com   | password123 |
| Buyer  | Alice Adams | buyer2@demo.com   | password123 |

The seeder also creates **10 active listings** spread across **Phones**, **Furniture** and **Clothing** (each with 2–3 placeholder images), and **3 completed orders** — one per category — each with a realistic buyer ↔ seller **chat thread**. The seeder is idempotent and safe to re-run.

---

## Pusher setup

1. Create an app at **https://dashboard.pusher.com**.
2. Copy the **App ID**, **Key**, **Secret** and **Cluster** into your `.env`:
   ```ini
   BROADCAST_CONNECTION=pusher
   PUSHER_APP_ID=your-app-id
   PUSHER_APP_KEY=your-app-key
   PUSHER_APP_SECRET=your-app-secret
   PUSHER_APP_CLUSTER=mt1
   ```
   (`PUSHER_HOST` / `PUSHER_PORT` / `PUSHER_SCHEME` are optional — leave them as defaults for hosted Pusher.)
3. Run the queue worker so the queued `MessageSent` event is broadcast:
   ```bash
   php artisan queue:work
   ```
4. In the mobile client, set `PUSHER_KEY` (= `PUSHER_APP_KEY`) and `PUSHER_CLUSTER` (= `PUSHER_APP_CLUSTER`) in **`mobile/src/config/env.js`**.

---

## Stripe setup + test cards

1. Set your TEST keys in `.env`:
   ```ini
   STRIPE_KEY=pk_test_...        # publishable key (used by the mobile app)
   STRIPE_SECRET=sk_test_...     # secret key (backend)
   STRIPE_CURRENCY=usd
   STRIPE_PLATFORM_FEE_PERCENT=10
   ```
2. Get the webhook signing secret by forwarding events locally with the Stripe CLI, then copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`:
   ```bash
   stripe listen --forward-to <host>/api/stripe/webhook
   # → whsec_...  →  STRIPE_WEBHOOK_SECRET
   ```
3. In the mobile client, set `STRIPE_PUBLISHABLE_KEY` (= `STRIPE_KEY`) in **`mobile/src/config/env.js`**.

**Test cards** (use any future expiry e.g. `12/34`, any 3-digit CVC, any postal code):

| Card number           | Behaviour                                  |
| --------------------- | ------------------------------------------ |
| `4242 4242 4242 4242` | Visa — payment succeeds                    |
| `4000 0025 0000 3155` | Requires 3D Secure authentication          |
| `4000 0000 0000 9995` | Card declined (insufficient funds)         |

> **Note on the seeded sellers.** The demo sellers use **placeholder** `stripe_account_id` values (`acct_demo_seller1`, `acct_demo_seller2`, `acct_demo_seller3`) so the UI shows "payments enabled". To actually run a test charge end-to-end, a seller must complete real Stripe **TEST-mode** Connect onboarding from the app (Profile → Set up payments), which creates a genuine `acct_` id.

---

## AWS deployment

See **[`AWS_SETUP.md`](AWS_SETUP.md)** for the full EC2 / RDS / S3 / CloudFront deployment guide.
