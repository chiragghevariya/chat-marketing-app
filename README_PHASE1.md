# Real-Time Marketplace — Backend (Phase 1)

Laravel 11 REST API for a buyer/seller marketplace.
**Phase 1 covers:** project setup, JWT authentication, roles (buyer/seller/admin),
product **listings** with image upload to AWS S3, and a search endpoint
(keyword + category + price range + location radius).

> Later phases add: real-time chat (Laravel Echo + Pusher), Stripe Connect escrow
> payments, and AWS deployment (EC2 / CloudFront / RDS).

---

## 1. Tech stack & packages

| Concern | Package |
|---|---|
| JWT auth | `tymon/jwt-auth` (v2.3) |
| Roles & permissions | `spatie/laravel-permission` (v6) |
| S3 uploads | `league/flysystem-aws-s3-v3` (v3) + `aws/aws-sdk-php` |

Requirements: **PHP 8.2+** and **Composer 2**. (Built and tested on PHP 8.3.)

---

## 2. Quick start

```bash
# 1. Install PHP dependencies
composer install

# 2. Create your environment file
cp .env.example .env

# 3. App key + JWT signing secret
php artisan key:generate
php artisan jwt:secret

# 4. Pick a database (see section 3). For the SQLite default, create the file
#    first (it is git-ignored, so it won't exist after a fresh clone):
#      Linux/macOS:  touch database/database.sqlite
#      Windows PS:   New-Item database/database.sqlite -ItemType File

# 5. Create the schema + demo data
php artisan migrate --seed

# 6. Run it
php artisan serve
# API base URL:  http://127.0.0.1:8000/api
```

If you cloned a fresh copy and the Spatie/JWT config files are missing, publish them:

```bash
php artisan vendor:publish --provider="Tymon\JWTAuth\Providers\LaravelServiceProvider"
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

---

## 3. Database

The default is **SQLite** (zero config — a file at `database/database.sqlite`).

> ⚠️ **Location radius search is NOT supported on SQLite.** It relies on SQL math
> functions (`acos`, `cos`, `sin`, `radians`) that SQLite does not ship. Every
> other endpoint works fine on SQLite. For radius search, use **MySQL** or
> **PostgreSQL** (production runs PostgreSQL on AWS RDS). Verified working on
> PostgreSQL 18 and ready for MySQL.

To switch, edit `.env` (examples are in `.env.example`):

```env
# PostgreSQL
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=chat_marketplace
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

Create the database first (Postgres/MySQL don't auto-create), then
`php artisan migrate:fresh --seed`.

### Demo accounts (created by the seeder)

| Role | Email | Password |
|---|---|---|
| admin | `admin@example.com` | `password` |
| seller | `seller@example.com` | `password` |
| buyer | `buyer@example.com` | `password` |

The seeder also creates a category tree and two sample listings.

---

## 4. AWS S3 setup (image uploads)

Listing images and avatars are uploaded to S3 by `App\Services\ImageUploadService`.
Fill these in `.env`:

`ImageUploadService` always writes to the dedicated **`s3`** disk, so you only
need to fill in the AWS credentials — you do **not** need to set `FILESYSTEM_DISK`
(that var only controls Laravel's *default* disk for other `Storage::*` calls).

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=your-bucket-name
AWS_URL=https://your-cloudfront-domain   # optional CDN; omit to use raw S3 URLs
```

The bucket must allow public reads for uploaded objects (or be fronted by
CloudFront). The S3 disk is defined in `config/filesystems.php`.

> You can develop everything except image upload without AWS credentials —
> just don't attach `images` to requests.

---

## 5. Authentication flow

This is a **JWT** API (the default guard is `api`). After register/login you get
an `access_token`; send it on every protected request:

```
Authorization: Bearer <access_token>
```

```bash
# Register (returns a token immediately)
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"name":"Jane","email":"jane@example.com","password":"secret123","password_confirmation":"secret123","role":"seller"}'

# Login
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"email":"seller@example.com","password":"password"}'

# Current user
curl http://127.0.0.1:8000/api/auth/me \
  -H "Accept: application/json" -H "Authorization: Bearer <TOKEN>"
```

---

## 6. API reference

Base path: `/api`. Send `Accept: application/json` on every request.

### Auth
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/register` | – | name, email, password, password_confirmation, phone?, role?(buyer\|seller), avatar?(file) |
| POST | `/auth/login` | – | email, password |
| GET | `/auth/me` | JWT | – |
| POST | `/auth/logout` | JWT | – |
| POST | `/auth/refresh` | JWT | – |

### Categories
| Method | Path | Auth |
|---|---|---|
| GET | `/categories` | – | Returns top-level categories with nested `children`. |

### Listings
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings` | – | Search/filter (see params below). Paginated. |
| GET | `/listings/{id}` | – | Single listing with category, seller, images. |
| POST | `/listings` | seller/admin | Create. `multipart/form-data` if sending images. |
| PUT/PATCH | `/listings/{id}` | owner/admin | Update fields, add/remove images. |
| DELETE | `/listings/{id}` | owner/admin | Deletes listing + its S3 images. |

> Note: `price` is returned as a JSON **string** (e.g. `"799.00"`) — `decimal:2`
> preserves money precision. Parse it client-side before doing arithmetic. The
> embedded `seller` is a public view (id, name, avatar, role, is_verified) — never
> email/phone/stripe_account_id.

**Search parameters for `GET /listings`** (all optional):

| Param | Example | Meaning |
|---|---|---|
| `q` | `iphone` | keyword in title/description |
| `category_id` | `2` | category (also matches its children) |
| `min_price` / `max_price` | `100` / `500` | price range |
| `lat`, `lng`, `radius` | `40.7,-73.9,20` | within `radius` **km** of the point (MySQL/Postgres only) |
| `status` | `active` | defaults to `active` |
| `sort` | `price_asc` | `newest`(default) \| `oldest` \| `price_asc` \| `price_desc` |
| `per_page` | `15` | 1–50, default 15 |

```bash
# Create a listing (seller token required)
curl -X POST http://127.0.0.1:8000/api/listings \
  -H "Accept: application/json" -H "Authorization: Bearer <SELLER_TOKEN>" \
  -F "title=DJI Mini Drone" -F "description=4K camera drone" \
  -F "price=299.99" -F "category_id=2" -F "status=active" \
  -F "location=Queens, NY" -F "lat=40.7282" -F "lng=-73.7949" \
  -F "images[]=@/path/photo1.jpg" -F "images[]=@/path/photo2.jpg" \
  -F "primary_image=0"
```

> **Uploading images on update:** browsers/mobile clients can't attach files to a
> real `PUT`. Send a `POST` with a `_method=PUT` field (Laravel method spoofing)
> using `multipart/form-data`. To remove images, pass `removed_image_ids[]=<id>`.

---

## 7. Where things live

```
app/
├─ Http/
│  ├─ Controllers/Api/   AuthController, ListingController, CategoryController
│  ├─ Requests/          Auth/* and Listing/* (validation)
│  └─ Resources/         JSON shaping (UserResource, ListingResource, ...)
├─ Models/               User, Category, Listing, ListingImage
└─ Services/             ImageUploadService (S3 upload/delete)

database/
├─ migrations/           users (+marketplace cols), categories, listings, listing_images, permissions
└─ seeders/              RoleSeeder, CategorySeeder, DatabaseSeeder

routes/api.php           all API routes
config/                  auth.php (api guard), filesystems.php (s3), jwt.php, permission.php
bootstrap/app.php        registers api routes + spatie role middleware aliases
```

Roles are enforced with the `role:seller|admin` middleware; per-listing ownership
is checked in `ListingController` (owner or admin only for update/delete).
