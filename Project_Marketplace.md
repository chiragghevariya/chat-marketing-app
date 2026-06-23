# Project 5: Real-Time Chat Marketplace App

**Version:** 1.0
**Stack:** React Native (Expo) · Laravel 11 · MySQL · Pusher WebSockets · Stripe Connect · AWS

---

## Overview

A peer-to-peer marketplace application where users can list items for sale, message each other in real time, and complete purchases with escrow payments via Stripe Connect. The backend is deployed on AWS using EC2, RDS, S3, and CloudFront.

---

## System Components

| Component | Technology | Description |
|-----------|-----------|-------------|
| Mobile App | React Native (Expo) | Browse listings, chat, buy, sell |
| Backend API | Laravel 11 | REST API, broadcasting, payment orchestration |
| Database | MySQL on AWS RDS | All application data |
| Real-Time Chat | Laravel Echo + Pusher | Live messaging between users |
| Payments | Stripe Connect | Buyer checkout, platform fee, seller payout |
| Media Storage | AWS S3 + CloudFront | Listing images with CDN delivery |
| Hosting | AWS EC2 | Laravel API server |

---

## Database Schema

| Table | Key Columns |
|-------|------------|
| users | id, name, email, password, phone, avatar, role, stripe_account_id, is_verified |
| categories | id, name, icon, parent_id |
| listings | id, seller_id, category_id, title, description, price, status (active/sold/draft), condition, location, lat, lng |
| listing_images | id, listing_id, url, is_primary, order |
| conversations | id, listing_id, buyer_id, seller_id, last_message_at |
| messages | id, conversation_id, sender_id, content, type (text/image), is_read, created_at |
| orders | id, listing_id, buyer_id, seller_id, amount, platform_fee, seller_amount, status, stripe_payment_intent_id, tracking_number |

---

## Order Status Flow

```
pending_payment → paid → shipped → completed
               ↘ refunded
```

---

## Payment Flow

```
Buyer taps "Buy Now"
    → POST /api/orders
    → Backend creates Stripe PaymentIntent
        application_fee_amount = 10% of price  (platform keeps this)
        transfer_data.destination = seller stripe_account_id
    → Returns client_secret to app
    → App presents Stripe payment sheet
    → Buyer confirms payment
    → POST /api/orders/{id}/confirm-payment
    → Webhook: payment_intent.succeeded → order status = paid
    → Seller ships: POST /api/orders/{id}/ship (adds tracking number)
    → Buyer confirms receipt: POST /api/orders/{id}/complete
    → Stripe automatically transfers seller_amount to seller account
```

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register buyer or seller |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/auth/me | Yes | Authenticated user |

### Listings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/listings | Yes | Search with keyword, category, radius, price range |
| GET | /api/listings/{id} | Yes | Listing detail with images |
| POST | /api/listings | Yes (seller) | Create listing with S3 image upload |
| PUT | /api/listings/{id} | Yes (owner) | Update listing |
| DELETE | /api/listings/{id} | Yes (owner) | Delete listing |
| GET | /api/categories | No | Category tree |

### Conversations & Messages
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/conversations | Yes | Start conversation about a listing |
| GET | /api/conversations | Yes | My conversations with last message |
| GET | /api/conversations/{id}/messages | Yes | Paginated message history |
| POST | /api/conversations/{id}/messages | Yes | Send message (broadcasts via Pusher) |
| POST | /api/conversations/{id}/read | Yes | Mark messages as read |

### Orders & Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/orders | Yes (buyer) | Create order + Stripe PaymentIntent |
| POST | /api/orders/{id}/confirm-payment | Yes (buyer) | Confirm after payment sheet |
| POST | /api/orders/{id}/ship | Yes (seller) | Add tracking number |
| POST | /api/orders/{id}/complete | Yes (buyer) | Confirm receipt |
| POST | /api/seller/stripe/connect-account | Yes (seller) | Generate Stripe Connect onboarding URL |
| GET | /api/seller/stripe/callback | No | Handle Stripe Connect redirect |
| POST | /api/stripe/webhook | No | Stripe event handler |

---

## AWS Infrastructure

```
Internet
    │
    ▼
CloudFront (CDN)
    ├── Static assets from S3
    └── API requests → EC2
            │
            ├── Laravel API (Nginx + PHP-FPM)
            ├── Supervisor → Queue Workers (broadcasting)
            └── RDS (MySQL) — private subnet, EC2 access only
```

---

## Build Phases

### Phase 1 — Laravel Backend: Setup, Auth & Listings

```
I am building a marketplace app backend using Laravel 11.
This is Phase 1: Project setup, authentication, and product listings.

Please create the following step by step:

1. Laravel 11 project with packages:
   - tymon/jwt-auth
   - spatie/laravel-permission (roles: buyer, seller, admin)
   - league/flysystem-aws-s3-v3

2. Database migrations:
   - users (id, name, email, password, phone, avatar, role,
     stripe_account_id, is_verified)
   - categories (id, name, icon, parent_id)
   - listings (id, seller_id, category_id, title, description, price,
     status [active/sold/draft], condition, location, lat, lng)
   - listing_images (id, listing_id, url, is_primary, order)

3. AWS S3 configuration:
   - Configure config/filesystems.php for the s3 disk
   - Create app/Services/ImageUploadService.php:
       Method: upload(UploadedFile $file, string $folder): string
         Upload to S3, return the full public URL
       Method: delete(string $url): void
         Delete from S3 by URL

4. CategorySeeder: at least 5 top-level categories with icons.

5. API endpoints:
   - POST /api/auth/register
   - POST /api/auth/login
   - GET  /api/auth/me
   - GET  /api/listings
       Query params: search (keyword), category_id, lat, lng, radius_km,
       min_price, max_price
   - GET  /api/listings/{id}
   - POST /api/listings (seller role, upload images to S3)
   - PUT  /api/listings/{id} (owner only)
   - DELETE /api/listings/{id} (owner only)
   - GET  /api/categories

6. ListingController with full working code.

Add AWS keys to .env.example. Add comments on every important line.
```

---

### Phase 2 — Laravel Backend: Real-Time Chat

```
This is Phase 2 of the marketplace Laravel backend.
Phase 1 is complete: auth and listings are working.

Now add real-time messaging using Laravel Echo + Pusher:

1. Install: pusher/pusher-php-server

2. New migrations:
   - conversations (id, listing_id, buyer_id, seller_id, last_message_at)
   - messages (id, conversation_id, sender_id, content, type [text/image],
     is_read, created_at)

3. Pusher config:
   In config/broadcasting.php: configure pusher connection
   In .env: set BROADCAST_DRIVER=pusher and all PUSHER_* keys

4. MessageSent event (app/Events/MessageSent.php):
   - Implement ShouldBroadcast
   - Broadcast on private channel: "conversation.{conversationId}"
   - Payload: message id, content, sender_id, sender name, created_at

5. Private channel authorization (routes/channels.php):
   - Channel "conversation.{id}": authorize if the authenticated user
     is either the buyer_id or seller_id on that conversation

6. API endpoints:
   - POST /api/conversations
       Find or create a conversation between buyer and seller for a listing
   - GET  /api/conversations
       Return user's conversations ordered by last_message_at desc
       Include last message preview and unread count
   - GET  /api/conversations/{id}/messages
       Paginated, ordered oldest first
   - POST /api/conversations/{id}/messages
       Save message to DB, fire MessageSent event
   - POST /api/conversations/{id}/read
       Set is_read=true for all messages where sender_id != auth user

7. ConversationController and MessageController with full working code.

Add Pusher keys to .env.example. Add comments on every line.
```

---

### Phase 3 — Laravel Backend: Stripe Connect & Orders

```
This is Phase 3 of the marketplace Laravel backend.
Phases 1 and 2 are complete: listings and chat are working.

Now add Stripe Connect marketplace payments:

1. Install: stripe/stripe-php

2. New migration:
   - orders (id, listing_id, buyer_id, seller_id, amount, platform_fee,
     seller_amount, status [pending_payment/paid/shipped/completed/refunded],
     stripe_payment_intent_id, tracking_number)

3. Stripe Connect seller onboarding:
   POST /api/seller/stripe/connect-account
     - Create a Stripe Express connected account for the seller
     - Generate and return the account onboarding link (account_links URL)
   GET /api/seller/stripe/callback
     - Called when Stripe redirects after onboarding
     - Retrieve the connected account and save stripe_account_id to user

4. Order and payment endpoints:
   POST /api/orders (buyer creates order):
     - Calculate platform_fee = amount * 0.10
     - Calculate seller_amount = amount - platform_fee
     - Create Stripe PaymentIntent with:
         amount: order amount in cents
         application_fee_amount: platform_fee in cents
         transfer_data.destination: seller's stripe_account_id
     - Save order with status=pending_payment
     - Return { order_id, client_secret } to app

   POST /api/orders/{id}/confirm-payment:
     - Update order status to paid (or wait for webhook)

   POST /api/orders/{id}/ship (seller):
     - Accept tracking_number in request body
     - Update order status to shipped

   POST /api/orders/{id}/complete (buyer):
     - Update order status to completed
     - Stripe handles the transfer to seller automatically

   POST /api/stripe/webhook:
     - Handle payment_intent.succeeded: update order to paid
     - Handle charge.refunded: update order to refunded

5. OrderController with full working code.

Add STRIPE_KEY, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET to .env.example.
Add comments on every line.
```

---

### Phase 4 — React Native: Buyer & Seller App

```
This is Phase 4 — the React Native app for the marketplace.
The Laravel backend from Phases 1, 2, and 3 is complete.

Stack: React Native (Expo), React Navigation, Axios, Pusher JS,
Stripe React Native.

Create the full project:

1. Setup:
   - Dependencies: expo, @react-navigation/native, @react-navigation/stack,
     @react-navigation/bottom-tabs, axios, pusher-js,
     @stripe/stripe-react-native, expo-image-picker,
     @react-native-async-storage/async-storage
   - src/config/api.js: Axios instance with JWT Authorization interceptor
   - src/store/AuthContext.js: login, logout, token persistence in AsyncStorage
   - src/hooks/usePusher.js:
       Connect to Pusher using app key from config
       Method: subscribeToConversation(conversationId, onMessage)
         Subscribe to private-conversation.{conversationId}
         Call onMessage callback on new message event

2. Screens (bottom navigation, 4 tabs):

   Tab 1 — Explore:
     Search bar at top
     Category horizontal scroll chips
     2-column grid of listings (image, title, price, location)
     Filter FAB (price range, condition: new/used)

   Tab 2 — Messages:
     FlatList of conversations
     Each row: other user avatar, listing title, last message preview,
               time, unread count badge
     Tap → ChatScreen

   Tab 3 — Sell:
     Create listing form:
       Title, price (number input), description (multiline),
       category picker, condition (new/used toggle)
       Image picker: select up to 5 photos from camera or gallery
       Images are uploaded to S3 via POST /api/listings
     Publish button

   Tab 4 — Profile:
     User name and avatar
     "My Listings" section: FlatList of own listings
     "My Orders" section: bought and sold tabs
     Stripe Connect status: "Connect Stripe Account" button
       if stripe_account_id is null

   ListingDetailScreen:
     Image carousel (swipeable)
     Title, price, condition, location
     Seller info row (avatar, name)
     "Message Seller" button → POST /api/conversations → ChatScreen
     "Buy Now" button → payment flow

   ChatScreen:
     FlatList of messages (own messages right, other left)
     Text input + send button at bottom
     On mount: subscribe to Pusher conversation channel
     On new Pusher event: append message to list without re-fetching

   Payment flow on "Buy Now" tap:
     POST /api/orders → receive client_secret
     Initialize Stripe payment sheet with client_secret
     presentPaymentSheet()
     On success: POST /api/orders/{id}/confirm-payment
     Show success message

3. UI accent color: #E65100.

Add clear comments on every component, hook, and function.
```

---

### Phase 5 — AWS Infrastructure & Documentation

```
This is Phase 5 — AWS deployment setup and documentation for the marketplace.
All application code from Phases 1–4 is complete.

1. AWS Infrastructure Setup Guide (write as numbered step-by-step instructions):

   a. EC2 Instance:
      - Launch Ubuntu 22.04 t3.small instance
      - Security group: allow port 80, 443 from anywhere; port 22 from your IP
      - Install: PHP 8.2, Nginx, Composer, Node.js 20, Supervisor
      - Configure Nginx server block for Laravel (root = /var/www/app/public)
      - Run: composer install --no-dev, php artisan key:generate,
             php artisan migrate, php artisan storage:link

   b. RDS MySQL:
      - Create MySQL 8.0 RDS instance (db.t3.micro for demo)
      - Security group: allow port 3306 from EC2 security group only
      - Update .env: DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD

   c. S3 Bucket:
      - Create bucket, disable "Block all public access"
      - Bucket policy: allow s3:GetObject for * on the /public/* prefix
      - CORS configuration: allow GET and PUT from your app domain
      - Update .env: AWS_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
        AWS_DEFAULT_REGION

   d. CloudFront Distribution:
      - Origin: your S3 bucket
      - Default cache behavior: redirect HTTP to HTTPS
      - Update ASSET_URL in .env to the CloudFront domain

   e. Supervisor for Queue Workers:
      - Create /etc/supervisor/conf.d/laravel-worker.conf
      - Command: php artisan queue:work --sleep=3 --tries=3 --max-time=3600
      - numprocs=2
      - Run: supervisorctl reread && supervisorctl update && supervisorctl start all

2. Laravel Seeders:
   - 3 sellers with Stripe test Express accounts
   - 10 listings across 3 categories, each with 2–3 images
   - 2 buyer accounts: buyer1@demo.com / password123
   - 3 completed orders with tracking numbers
   - 5 conversations with message history

3. README.md for the GitHub repository:
   - Project title and description
   - AWS architecture diagram (text-based)
   - Feature list
   - Tech stack table
   - Local development setup (without AWS — use local storage and sqlite)
   - Production deployment steps (reference the AWS guide above)
   - Demo credentials table
   - Pusher setup steps
   - Stripe test card: 4242 4242 4242 4242

4. 60-second screen recording script:
   - Specify each screen and action in order
   - Flow: login as buyer → browse listings → open listing detail →
     tap Message Seller → send message → switch to seller account →
     see new message in Messages tab → reply in real time →
     switch back to buyer → tap Buy Now → complete Stripe payment →
     switch to seller → mark shipped → switch to buyer → mark completed
```

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Buyer | buyer1@demo.com | password123 |
| Buyer | buyer2@demo.com | password123 |
| Seller | seller1@demo.com | password123 |
| Seller | seller2@demo.com | password123 |
| Seller | seller3@demo.com | password123 |

---

## Environment Variables

```env
APP_NAME=Marketplace
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=your-rds-endpoint.amazonaws.com
DB_DATABASE=marketplace
DB_USERNAME=root
DB_PASSWORD=

QUEUE_CONNECTION=database
BROADCAST_DRIVER=pusher

JWT_SECRET=
JWT_TTL=60

PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=

STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
ASSET_URL=https://your-cloudfront-id.cloudfront.net
```

---

## Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Payment succeeds |
| 4000 0000 0000 9995 | Card declined |
| 4000 0025 0000 3155 | Requires 3D Secure |
