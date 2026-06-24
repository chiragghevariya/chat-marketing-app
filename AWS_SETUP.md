# AWS Infrastructure Setup — Chat Marketplace (Laravel 11 API)

This is a copy-pasteable, step-by-step guide to deploy the Laravel 11 marketplace
API to AWS. It covers an EC2 application server (Ubuntu 22.04 + Nginx + PHP 8.2-FPM
+ a Supervisor-managed queue worker), an RDS PostgreSQL database, and S3 + CloudFront
for media. The final section is a checklist of every environment variable to set
once the infrastructure exists.

> Stack: Laravel 11 / PHP 8.2, JWT auth (`tymon/jwt-auth`, guard `api`),
> `spatie/laravel-permission` roles (`buyer|seller|admin`), Stripe Connect escrow
> (10% platform fee), Pusher private channels (`private-conversation.{id}`,
> event `message.sent`), media on S3 fronted by CloudFront via `ImageUploadService`.

---

## Architecture

```
                                  ┌─────────────────────────┐
            Mobile app (Expo)     │      Pusher Channels     │
            mobile/src/config     │  private-conversation.{} │
                  │               │   event: message.sent    │
                  │ HTTPS         └────────────▲─────────────┘
                  │  /api                       │ broadcast (from queue worker)
                  ▼                              │
        ┌───────────────────────────────────────┴───────────────┐
        │  EC2  (Ubuntu 22.04)            Security Group: web-sg  │
        │   ┌──────────┐   ┌───────────────┐   ┌──────────────┐  │
        │   │  Nginx   │──▶│ PHP 8.2-FPM    │   │  Supervisor  │  │
        │   │  :80/443 │   │ Laravel /public│   │ queue:work x2│  │
        │   └──────────┘   └───────┬────────┘   └──────┬───────┘  │
        └────────────────┬─────────┼───────────────────┼─────────┘
                         │         │                   │ database queue
              S3 PutObject│        │ TCP 5432          │ (jobs table)
                         │         ▼                   │
              ┌──────────▼──┐  ┌───────────────────────▼──────────┐
              │  S3 bucket  │  │  RDS PostgreSQL 16   db-sg        │
              │  (media)    │  │  DB_DATABASE=chat_marketplace    │
              └──────┬──────┘  │  inbound 5432 ONLY from web-sg   │
                     │         └──────────────────────────────────┘
            origin   │
              ┌──────▼───────┐
              │  CloudFront  │ ◀── AWS_URL points here → CDN media URLs
              │ (CDN media)  │
              └──────────────┘
```

The mobile client talks to the EC2 API over HTTPS. Chat messages are persisted by
the API and broadcast to Pusher **by the queue worker** (see why below). Uploaded
images go to S3 and are served through CloudFront. The database lives on a private
RDS instance reachable only from the EC2 security group.

---

## 1) EC2 Application Server (Ubuntu 22.04)

### 1.1 Launch the instance

Use the AWS Console (EC2 → Launch instance) or the CLI. Example with the CLI:

```bash
# Pick an Ubuntu 22.04 LTS AMI for your region, then launch.
aws ec2 run-instances \
  --image-id ami-xxxxxxxxxxxxxxxxx \        # Ubuntu 22.04 LTS (amd64) for your region
  --instance-type t3.small \
  --key-name my-keypair \
  --security-group-ids sg-WEBxxxxxxxxxxxxx \ # the web-sg created below
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=marketplace-api}]'
```

### 1.2 Security group rules (`web-sg`)

Create a security group for the web server and add **only** these inbound rules:

```bash
# Create the web security group (returns a GroupId like sg-WEBxxxx — keep it).
aws ec2 create-security-group \
  --group-name web-sg \
  --description "Marketplace API web server" \
  --vpc-id vpc-xxxxxxxx

# SSH (22) — restrict to YOUR public IP only, never 0.0.0.0/0.
aws ec2 authorize-security-group-ingress \
  --group-id sg-WEBxxxxxxxxxxxxx \
  --protocol tcp --port 22 --cidr 203.0.113.10/32   # <-- your IP/32

# HTTP (80) — open to the world (needed for HTTP->HTTPS redirect + ACME challenge).
aws ec2 authorize-security-group-ingress \
  --group-id sg-WEBxxxxxxxxxxxxx \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# HTTPS (443) — open to the world (the mobile app connects here).
aws ec2 authorize-security-group-ingress \
  --group-id sg-WEBxxxxxxxxxxxxx \
  --protocol tcp --port 443 --cidr 0.0.0.0/0
```

| Port | Protocol | Source             | Purpose                    |
|------|----------|--------------------|----------------------------|
| 22   | TCP      | `YOUR.IP.ADDR/32`  | SSH admin access           |
| 80   | TCP      | `0.0.0.0/0`        | HTTP (redirect + certbot)  |
| 443  | TCP      | `0.0.0.0/0`        | HTTPS API traffic          |

### 1.3 SSH in and update the OS

```bash
ssh -i my-keypair.pem ubuntu@<EC2_PUBLIC_IP>

sudo apt update && sudo apt -y upgrade
```

### 1.4 Install PHP 8.2 (ondrej PPA), Nginx, Composer, Node 20, tooling

```bash
# --- PHP 8.2 from the ondrej PPA -------------------------------------------
sudo apt -y install software-properties-common
sudo add-apt-repository -y ppa:ondrej/php
sudo apt update

sudo apt -y install \
  php8.2-fpm php8.2-cli \
  php8.2-pgsql php8.2-mbstring php8.2-xml php8.2-curl \
  php8.2-zip php8.2-bcmath php8.2-gd php8.2-intl

# --- Nginx, git, unzip, supervisor -----------------------------------------
sudo apt -y install nginx git unzip supervisor

# --- Composer (global) ------------------------------------------------------
cd /tmp
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
composer --version

# --- Node.js 20 (NodeSource) ------------------------------------------------
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node --version   # should print v20.x

# Confirm the PHP-FPM socket name matches the Nginx config below.
ls /run/php/php8.2-fpm.sock
```

### 1.5 Clone the repo and install dependencies

```bash
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/<your-org>/<your-repo>.git marketplace
cd /var/www/marketplace

# Production install: no dev deps, optimized autoloader.
composer install --no-dev --optimize-autoloader
```

### 1.6 Configure the environment file

```bash
cp .env.example .env
nano .env          # fill in the values — see the full checklist in section 4

# Generate the Laravel app key and the JWT signing secret.
php artisan key:generate     # sets APP_KEY
php artisan jwt:secret        # sets JWT_SECRET
```

Set at minimum (full list in section 4):

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com
AUTH_GUARD=api
```

> You can run `php artisan migrate --force` here using a local/placeholder DB, but
> the real migration happens after RDS is up — see section 2.5. (`--force` is
> required because `APP_ENV=production` otherwise refuses to run migrations.)

### 1.7 Storage link and permissions

```bash
php artisan storage:link

# Nginx/PHP-FPM run as www-data, so the writable dirs must be owned by it.
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R ug+rwx storage bootstrap/cache
```

### 1.8 Nginx server block

Create `/etc/nginx/sites-available/marketplace`:

```bash
sudo nano /etc/nginx/sites-available/marketplace
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;

    root /var/www/marketplace/public;
    index index.php;

    charset utf-8;
    client_max_body_size 20M;   # allow image uploads

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Enable the site, drop the default, validate, and reload:

```bash
sudo ln -s /etc/nginx/sites-available/marketplace /etc/nginx/sites-enabled/marketplace
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 1.9 HTTPS with Certbot

Point your DNS `A` record (e.g. `api.yourdomain.com`) at the EC2 public IP, then:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
# Certbot rewrites the server block to listen on 443, installs the cert,
# and adds an 80 -> 443 redirect. Auto-renewal is installed as a systemd timer.
sudo certbot renew --dry-run
```

After HTTPS is live, set `APP_URL=https://api.yourdomain.com` in `.env`.

### 1.10 Supervisor — queue worker (REQUIRED for real-time chat)

**Why this is mandatory:** the `MessageSent` event implements `ShouldBroadcast` and
the app runs with `QUEUE_CONNECTION=database`. That means when a chat message is
sent, the broadcast to Pusher is **queued as a job in the `jobs` table** rather than
fired inline. If no worker is draining that queue, the job never runs and the
real-time message **never reaches Pusher** — recipients only see it after a manual
refresh. A long-running `php artisan queue:work` process (kept alive by Supervisor)
processes those jobs and delivers the broadcasts. (For local dev only, you could set
`QUEUE_CONNECTION=sync` to fire inline and skip the worker; do **not** do that in
production.)

Create `/etc/supervisor/conf.d/marketplace-worker.conf`:

```bash
sudo nano /etc/supervisor/conf.d/marketplace-worker.conf
```

```ini
[program:marketplace-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/marketplace/artisan queue:work --sleep=3 --tries=3 --timeout=90
directory=/var/www/marketplace
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/marketplace/storage/logs/worker.log
stopwaitsecs=3600
```

Tell Supervisor to load and start it:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start marketplace-worker:*
sudo supervisorctl status            # should show two RUNNING processes
```

> After any deploy that changes job/event code, restart the workers so they pick up
> the new code: `php artisan queue:restart` (workers gracefully exit and Supervisor
> respawns them).

---

## 2) RDS PostgreSQL

### 2.1 Create a DB security group (`db-sg`)

The database must accept connections **only** from the EC2 web server's security
group — reference the SG id, never `0.0.0.0/0`.

```bash
# Create the DB security group.
aws ec2 create-security-group \
  --group-name db-sg \
  --description "Marketplace RDS PostgreSQL" \
  --vpc-id vpc-xxxxxxxx
# -> returns sg-DBxxxxxxxxxxxxx

# Allow TCP 5432 ONLY from the web server's security group (web-sg).
aws ec2 authorize-security-group-ingress \
  --group-id sg-DBxxxxxxxxxxxxx \
  --protocol tcp --port 5432 \
  --source-group sg-WEBxxxxxxxxxxxxx
```

| Port | Protocol | Source                       | Purpose             |
|------|----------|------------------------------|---------------------|
| 5432 | TCP      | `sg-WEBxxxxxxxxxxxxx` (web-sg) | Postgres from EC2 only |

### 2.2 Create the PostgreSQL instance

```bash
aws rds create-db-instance \
  --db-instance-identifier marketplace-db \
  --engine postgres \
  --engine-version 16 \
  --db-instance-class db.t3.micro \
  --allocated-storage 20 \
  --master-username marketplace_admin \
  --master-user-password 'CHANGE_ME_strong_password' \
  --db-name chat_marketplace \
  --vpc-security-group-ids sg-DBxxxxxxxxxxxxx \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --storage-encrypted
```

Notes:
- `--db-name chat_marketplace` creates the initial database (matches `DB_DATABASE`).
- `--no-publicly-accessible` keeps the instance off the public internet.
- `db.t3.micro` / PostgreSQL 16 is a fine starting point; scale up as needed.

### 2.3 Get the endpoint

```bash
aws rds describe-db-instances \
  --db-instance-identifier marketplace-db \
  --query 'DBInstances[0].Endpoint.Address' --output text
# e.g. marketplace-db.abc123xyz.us-east-1.rds.amazonaws.com
```

### 2.4 Update `.env` database vars (on EC2)

```dotenv
DB_CONNECTION=pgsql
DB_HOST=marketplace-db.abc123xyz.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_DATABASE=chat_marketplace
DB_USERNAME=marketplace_admin
DB_PASSWORD=CHANGE_ME_strong_password
```

> **Single-string alternative:** instead of the five `DB_*` vars you can set one
> `DB_URL` connection string:
> ```dotenv
> DB_URL=pgsql://marketplace_admin:CHANGE_ME_strong_password@marketplace-db.abc123xyz.us-east-1.rds.amazonaws.com:5432/chat_marketplace
> ```

### 2.5 Run migrations and seed the demo data

```bash
cd /var/www/marketplace
php artisan config:clear        # ensure the new .env values are read
php artisan migrate --force --seed
```

`--seed` runs `DatabaseSeeder`, which calls `RoleSeeder` (roles on guard `api`),
`CategorySeeder`, and `DemoSeeder` (the demo sellers/buyers, 10 listings, 3 completed
orders + chat threads). The seeder is idempotent — safe to re-run.

> **Reminder:** the location/radius search relies on SQL math functions PostgreSQL
> provides; SQLite does not. Production uses PostgreSQL, so radius search works.

---

## 3) S3 + CloudFront (media)

`ImageUploadService` always uploads to the dedicated **`s3`** disk (configured by the
`AWS_*` vars), regardless of `FILESYSTEM_DISK`.

### 3.1 Create the bucket

```bash
aws s3api create-bucket \
  --bucket marketplace-media-prod \
  --region us-east-1
# For regions other than us-east-1, add:
#   --create-bucket-configuration LocationConstraint=<region>
```

If you want a **public-read** bucket (simplest), disable the block-public-access
settings that block bucket policies, then attach the policy below:

```bash
aws s3api put-public-access-block \
  --bucket marketplace-media-prod \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

### 3.2 Bucket policy — public read of media

`bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::marketplace-media-prod/*"
    }
  ]
}
```

```bash
aws s3api put-bucket-policy \
  --bucket marketplace-media-prod \
  --policy file://bucket-policy.json
```

> **More secure alternative:** keep the bucket fully **private** (leave all
> block-public-access settings `true`, skip the policy above) and serve objects
> **only through CloudFront using an Origin Access Control (OAC)**. With OAC,
> CloudFront signs requests to S3 and the bucket policy grants `s3:GetObject` to the
> CloudFront service principal (`cloudfront.amazonaws.com`) restricted to your
> distribution ARN — the bucket stays closed to the public internet. Either way,
> `AWS_URL` points at the CloudFront domain so URLs go through the CDN.

### 3.3 CORS configuration

`cors.json` — allow the app origins to GET/PUT/POST:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://api.yourdomain.com",
        "https://app.yourdomain.com"
      ],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

```bash
aws s3api put-bucket-cors \
  --bucket marketplace-media-prod \
  --cors-configuration file://cors.json
```

### 3.4 IAM user with a least-privilege policy

Create a programmatic IAM user whose policy only allows put/get/delete on the bucket.

`s3-upload-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MarketplaceMediaRW",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::marketplace-media-prod/*"
    }
  ]
}
```

```bash
# Create the user.
aws iam create-user --user-name marketplace-s3-uploader

# Attach the least-privilege inline policy.
aws iam put-user-policy \
  --user-name marketplace-s3-uploader \
  --policy-name marketplace-media-rw \
  --policy-document file://s3-upload-policy.json

# Create access keys — capture AccessKeyId and SecretAccessKey from the output.
aws iam create-access-key --user-name marketplace-s3-uploader
```

Put the returned keys in the EC2 `.env`:

```dotenv
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=marketplace-media-prod
AWS_ENDPOINT=
AWS_USE_PATH_STYLE_ENDPOINT=false
```

### 3.5 CloudFront distribution (S3 origin)

Create a distribution with the bucket as the origin (Console: CloudFront → Create
distribution → Origin domain = your S3 bucket; for the private/OAC approach, create
an Origin Access Control and let CloudFront update the bucket policy). With the CLI:

```bash
aws cloudfront create-distribution \
  --origin-domain-name marketplace-media-prod.s3.us-east-1.amazonaws.com \
  --default-root-object index.html
# Grab the distribution Domain Name, e.g. d1234abcd.cloudfront.net
```

### 3.6 Point `AWS_URL` at CloudFront

Set `AWS_URL` to the CloudFront domain so `ImageUploadService` returns CDN URLs
instead of raw S3 URLs:

```dotenv
AWS_URL=https://d1234abcd.cloudfront.net
```

Uploaded media is then served as `https://d1234abcd.cloudfront.net/<path>`.

After changing AWS vars:

```bash
php artisan config:clear
```

---

## 4) Environment variables to set after AWS is ready

### 4.1 Backend `.env` (on EC2, `/var/www/marketplace/.env`)

```dotenv
# --- App ---
APP_URL=https://api.yourdomain.com
APP_KEY=                       # php artisan key:generate
AUTH_GUARD=api
JWT_SECRET=                    # php artisan jwt:secret

# --- Database (RDS PostgreSQL) ---
DB_CONNECTION=pgsql
DB_HOST=marketplace-db.abc123xyz.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_DATABASE=chat_marketplace
DB_USERNAME=marketplace_admin
DB_PASSWORD=CHANGE_ME_strong_password
# (Alternative single string instead of the five DB_* vars above:)
# DB_URL=pgsql://user:pass@host:5432/chat_marketplace

# --- S3 + CloudFront (media via ImageUploadService -> "s3" disk) ---
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=marketplace-media-prod
AWS_URL=https://d1234abcd.cloudfront.net   # CloudFront domain -> CDN media URLs
AWS_ENDPOINT=                              # blank for real AWS S3
AWS_USE_PATH_STYLE_ENDPOINT=false

# --- Broadcasting (Pusher) ---
BROADCAST_CONNECTION=pusher                # Laravel 11 var (NOT BROADCAST_DRIVER)
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=mt1
# Optional self-hosted / Pusher-compatible server (leave blank for hosted Pusher):
PUSHER_HOST=
PUSHER_PORT=443
PUSHER_SCHEME=https

# --- Queue (database-backed; the Supervisor worker drains it) ---
QUEUE_CONNECTION=database

# --- Stripe Connect ---
STRIPE_KEY=pk_test_...          # publishable key (used by the mobile app)
STRIPE_SECRET=sk_test_...       # secret key (backend)
STRIPE_WEBHOOK_SECRET=whsec_... # signing secret for POST /api/stripe/webhook
STRIPE_CURRENCY=usd
STRIPE_PLATFORM_FEE_PERCENT=10
```

After editing `.env`, rebuild the caches and restart the worker:

```bash
cd /var/www/marketplace
php artisan config:cache
php artisan route:cache
php artisan queue:restart
sudo systemctl reload nginx
```

### 4.2 Mobile app (`mobile/src/config/env.js`)

```js
APP_BASE_URL          // the API server root, NO /api  -> e.g. https://api.yourdomain.com
PUSHER_KEY            // = PUSHER_APP_KEY from the backend
PUSHER_CLUSTER        // = PUSHER_APP_CLUSTER (e.g. mt1)
STRIPE_PUBLISHABLE_KEY// = STRIPE_KEY (pk_test_...)
```

| Mobile key (`mobile/src/config/env.js`) | Source (backend `.env`)             |
|------------------------------------------|-------------------------------------|
| `APP_BASE_URL`                           | `APP_URL` (server root, no `/api`)  |
| `PUSHER_KEY`                             | `PUSHER_APP_KEY`                    |
| `PUSHER_CLUSTER`                         | `PUSHER_APP_CLUSTER`                |
| `STRIPE_PUBLISHABLE_KEY`                 | `STRIPE_KEY` (`pk_test_...`)        |

---

## Demo accounts (seeded by `DemoSeeder`)

Password for **all** demo accounts: `password123`

| Name        | Email             | Role   | Notes                              |
|-------------|-------------------|--------|------------------------------------|
| Sarah Chen  | seller1@demo.com  | seller | `stripe_account_id acct_demo_seller1` |
| Marcus Lee  | seller2@demo.com  | seller | `stripe_account_id acct_demo_seller2` |
| Elena Rossi | seller3@demo.com  | seller | `stripe_account_id acct_demo_seller3` |
| Bob Buyer   | buyer1@demo.com   | buyer  | buys two completed orders          |
| Alice Adams | buyer2@demo.com   | buyer  | buys one completed order           |

10 active listings across **Phones**, **Furniture**, **Clothing**; 3 completed orders
(one per category) with chat threads.

> **Honesty note:** the seeded sellers use placeholder `stripe_account_id` values
> (`acct_demo_*`) so the UI shows "payments enabled". To actually run a test charge
> end-to-end, a seller must complete real Stripe **TEST-mode** Connect onboarding
> from the app (Profile → Set up payments), which creates a genuine `acct_` id.

## Stripe test cards

| Card number           | Behaviour                                  |
|-----------------------|--------------------------------------------|
| `4242 4242 4242 4242` | Visa — payment succeeds                    |
| `4000 0025 0000 3155` | Requires 3D Secure authentication          |
| `4000 0000 0000 9995` | Card declined (insufficient funds)         |

Use any future expiry (e.g. `12/34`), any 3-digit CVC, and any postal code.
