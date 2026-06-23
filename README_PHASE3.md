# Marketplace Backend — Phase 3: Stripe Connect Payments

Adds marketplace payments with **Stripe Connect** (Express accounts) on top of
Phases 1–2. The platform charges the buyer, keeps a **10% fee**, and routes the
rest to the seller's connected account.

> Builds on Phase 1 (auth + listings) and Phase 2 (chat).

---

## 1. Payment model — destination charge + manual capture (escrow)

```
Seller onboarding (once):
  POST /seller/stripe/connect-account  -> Express account + hosted onboarding URL
  (seller finishes on Stripe) -> GET /seller/stripe/callback  -> account ready

Per purchase:
  POST /orders                  buyer places order
        -> PaymentIntent { amount, application_fee_amount = 10%,
                           transfer_data.destination = seller acct,
                           capture_method = 'manual' }   (funds AUTHORIZED, not moved)
        -> returns client_secret
  (buyer confirms card in the app with client_secret)
  POST /orders/{id}/confirm-payment   -> order = paid, listing = sold
  POST /orders/{id}/ship              seller adds tracking -> order = shipped
  POST /orders/{id}/complete          buyer confirms receipt
        -> CAPTURE the PaymentIntent  -> funds released to seller (minus fee) -> order = completed
```

**Why manual capture?** It gives simple escrow: the buyer's card is only
*authorized* at order time, and the money is *captured* (released to the seller)
when the buyer confirms receipt. The 10% platform fee is taken automatically.

> ⚠️ **7-day limit:** a manual-capture authorization expires after ~7 days. If
> delivery+confirmation can take longer, switch to **separate charges & transfers**
> (charge at order time, create a `Transfer` to the seller on completion). The code
> isolates all Stripe calls in `app/Services/StripeService.php`, so this is a
> localized change.

---

## 2. Install & configure

```bash
composer require stripe/stripe-php
php artisan migrate            # creates the orders table
```

`.env` (use **test** keys from https://dashboard.stripe.com/test/apikeys):

```env
STRIPE_KEY=pk_test_xxx                 # publishable key (frontend)
STRIPE_SECRET=sk_test_xxx              # secret key (backend)
STRIPE_WEBHOOK_SECRET=whsec_xxx        # from `stripe listen` / dashboard
STRIPE_CURRENCY=usd
STRIPE_PLATFORM_FEE_PERCENT=10
```

In the Stripe Dashboard you must **enable Connect** and use **Express** accounts.

---

## 3. Webhooks

Stripe is the source of truth for payment state (the buyer's app can close
mid-flow). Run the Stripe CLI in dev:

```bash
stripe listen --forward-to http://127.0.0.1:8000/api/stripe/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET
```

> **Connected-account events:** `account.updated` fires on the seller's *connected*
> Express account, not your platform account. The plain `stripe listen` above will
> **not** deliver it. Add a connect listener (or, in the Dashboard, enable
> "Listen to events on Connected accounts" for your webhook endpoint):
>
> ```bash
> stripe listen --forward-connect-to http://127.0.0.1:8000/api/stripe/webhook
> ```
>
> Until then, seller verification still works via the onboarding callback; the
> webhook is just the more robust source of truth.

Handled events (each handler is idempotent and only moves an order forward):

| Event | Effect |
|---|---|
| `payment_intent.amount_capturable_updated` | funds authorized → order `paid`, listing `sold` |
| `payment_intent.succeeded` | captured → order `completed` |
| `charge.refunded` | order `refunded` (terminal) |
| `account.updated` | seller onboarding finished → mark seller verified |

Forged/unsigned calls are rejected with `400` (verified against
`STRIPE_WEBHOOK_SECRET`).

---

## 4. API reference

### Seller onboarding (role: seller/admin)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/seller/stripe/connect-account` | Returns `{ onboarding_url }`. Open it in a browser/web view. |
| GET | `/api/seller/stripe/callback` | **Public.** Stripe redirects here when onboarding finishes. |

### Orders (auth:api; per-order access enforced)
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/orders` | buyer | Body `listing_id`. Returns `order` + `client_secret`. |
| GET | `/api/orders` | buyer/seller | My orders. |
| GET | `/api/orders/{id}` | buyer/seller | One order. |
| POST | `/api/orders/{id}/confirm-payment` | buyer | Sync after the card is confirmed. |
| POST | `/api/orders/{id}/ship` | seller | Body `tracking_number`. |
| POST | `/api/orders/{id}/complete` | buyer | Captures payment → pays the seller. |
| POST | `/api/stripe/webhook` | Stripe | **Public**, signature-verified. |

```bash
# 1) Seller onboards (open the returned URL in a browser)
curl -X POST http://127.0.0.1:8000/api/seller/stripe/connect-account \
  -H "Accept: application/json" -H "Authorization: Bearer $SELLER_TOKEN"

# 2) Buyer places an order -> use client_secret with Stripe.js/mobile SDK
curl -X POST http://127.0.0.1:8000/api/orders \
  -H "Accept: application/json" -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" -d '{"listing_id":1}'

# 3) Buyer confirms, 4) seller ships, 5) buyer completes
curl -X POST http://127.0.0.1:8000/api/orders/1/confirm-payment -H "Authorization: Bearer $BUYER_TOKEN" -H "Accept: application/json"
curl -X POST http://127.0.0.1:8000/api/orders/1/ship -H "Authorization: Bearer $SELLER_TOKEN" -H "Accept: application/json" -H "Content-Type: application/json" -d '{"tracking_number":"1Z999..."}'
curl -X POST http://127.0.0.1:8000/api/orders/1/complete -H "Authorization: Bearer $BUYER_TOKEN" -H "Accept: application/json"
```

---

## 5. The money split (computed server-side — never trusted from the client)

For a `$100.00` listing with `STRIPE_PLATFORM_FEE_PERCENT=10`:

| Field (stored on the order) | Value | Stripe |
|---|---|---|
| `amount` | 100.00 | PaymentIntent `amount` = 10000 (cents) |
| `platform_fee` | 10.00 | `application_fee_amount` = 1000 (cents) |
| `seller_amount` | 90.00 | net transferred to the seller's account |

Amounts are `DECIMAL` in the DB and converted to integer cents for Stripe.

---

## 6. Order status lifecycle

```
pending_payment ──confirm-payment──▶ paid ──ship──▶ shipped ──complete(capture)──▶ completed
                                       │                                  │
                                       └──────────── refund ──────────────┴──▶ refunded
```

The `orders` table: `id, listing_id, buyer_id, seller_id, amount, platform_fee,
seller_amount, status, stripe_payment_intent_id, tracking_number, timestamps`.
Buyer/seller/listing use `restrictOnDelete` so financial records can't be
silently destroyed.

**Inventory reservation:** placing an order **atomically** flips the listing
`active → sold` (a single conditional `UPDATE`), so two buyers can never order the
same one-of-a-kind item — the second gets `422`. If the Stripe call fails, the
listing is released back to `active`. Because this reserves on order *creation*, an
abandoned checkout leaves the listing `sold`; in production add a scheduled command
to release listings whose order is still `pending_payment` after, say, 30 minutes
(and cancel the PaymentIntent).

---

## 7. Local testing without real money

- Use Stripe **test mode** keys; cards like `4242 4242 4242 4242` succeed.
- For Connect Express test onboarding, Stripe provides a test flow you can click
  through.
- The Stripe CLI (`stripe listen` / `stripe trigger payment_intent.succeeded`)
  lets you exercise webhooks locally.
