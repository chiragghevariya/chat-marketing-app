# Marketplace Platform — Portfolio, Job Titles & Demo Script

## Portfolio Description

I designed and built a full-featured, two-sided mobile marketplace from the ground up — a polished React Native (Expo) app backed by a robust Laravel 11 / PHP 8.2 API. Buyers browse and search listings with radius-based location filtering, message sellers in real time, and check out securely; sellers list items, manage inventory, and get paid directly to their own accounts.

Real-time chat is powered by Pusher private channels, delivering instant, two-way messaging with read receipts over a queued broadcasting pipeline. Payments run on Stripe Connect, with a manual-capture escrow flow and an automatic 10% platform fee — funds are held until delivery, then released to the seller, so both sides transact with confidence. The entire system is deployed on AWS: EC2 for the API and queue workers, RDS (PostgreSQL) for data, and S3 fronted by CloudFront for fast, globally cached media.

JWT authentication, role-based access (buyer/seller/admin), and Stripe-backed identity keep the platform secure and trustworthy. The result is a production-grade marketplace that processed $50K+ in transactions in its first month. If you need an end-to-end marketplace — mobile app, scalable API, payments, and chat — I can deliver it.

## 10 Upwork Job Titles

1. Full-Stack Marketplace Developer | Laravel API + React Native (Expo) Mobile App
2. Stripe Connect Expert — Escrow Payments & Platform Fees for Marketplaces
3. Build Your Two-Sided Marketplace App: Laravel 11, React Native & AWS
4. Real-Time Chat Integration with Pusher (Private Channels, Read Receipts)
5. React Native (Expo) Mobile App Developer with Laravel Backend
6. Senior Laravel 11 / PHP 8.2 Backend Engineer — JWT, REST API & Queues
7. AWS Deployment Specialist — EC2, RDS (PostgreSQL), S3 & CloudFront
8. Stripe Marketplace Payments: Connect Onboarding, Escrow & Payouts
9. Marketplace MVP to Launch — Listings, Chat, Payments & Reviews
10. End-to-End Marketplace Build: Mobile App, Scalable API & Cloud Infra

## 60-Second Demo Video Script

**0:00–0:05 — Hook**
- On-screen: App launches, logo animates, hero shot of the Explore tab filling with listing cards (orange #E65100 accent).
- Voiceover: "This is a complete two-sided marketplace — mobile app, real-time chat, and secure payments — built end to end."

**0:05–0:13 — Browse & Search Listings**
- On-screen: Scroll the Explore grid; tap the search bar, type a query, apply a category filter (Phones), results refresh; show location/radius filter.
- Voiceover: "Buyers browse and search thousands of listings, filtered by category and location radius — all served by a fast Laravel API."

**0:13–0:22 — Listing Detail**
- On-screen: Tap a listing; image carousel swipes through photos; show title, price, condition, seller info with a verified payments badge, and the Message and Buy Now buttons.
- Voiceover: "Each listing shows rich detail — photos delivered from S3 via CloudFront, pricing, condition, and a verified seller ready to chat or sell."

**0:22–0:33 — Real-Time Chat (Two Devices)**
- On-screen: Split screen — buyer's phone (left) and seller's phone (right). Buyer sends "Is this still available?"; it appears instantly on the seller's device; seller replies; read receipts tick.
- Voiceover: "Tap Message to chat in real time. Powered by Pusher private channels and a queued broadcast pipeline, messages arrive instantly — with read receipts on both sides."

**0:33–0:43 — Stripe Buy Now Payment Sheet**
- On-screen: Buyer taps Buy Now; native Stripe payment sheet slides up; enter test card 4242 4242 4242 4242, expiry 12/34, CVC; tap Pay; success animation; order marked paid.
- Voiceover: "Checkout runs on Stripe. Payment is captured into escrow and held safely — with a 10% platform fee handled automatically."

**0:43–0:51 — Seller Stripe Connect Onboarding**
- On-screen: Switch to seller's Profile tab; tap "Set up payments"; Stripe Connect onboarding flow opens; return to app showing "Payments enabled."
- Voiceover: "Sellers onboard through Stripe Connect in minutes, then get paid directly to their own accounts when an order completes."

**0:51–0:56 — AWS Architecture**
- On-screen: Clean architecture diagram — React Native app → EC2 (Laravel API + queue worker) → RDS PostgreSQL, with S3/CloudFront for media and Pusher for real-time.
- Voiceover: "Everything runs on AWS — EC2, RDS PostgreSQL, and S3 behind CloudFront — built to scale."

**0:56–1:00 — Closing Call-to-Action**
- On-screen: App returns to the Explore screen; tagline and contact handle fade in over the orange accent.
- Voiceover: "A production-grade marketplace, built end to end. Let's build yours — get in touch."

---

*Note to owner: Replace the "$50K+ in transactions in its first month" figure with a real, verifiable metric before publishing.*
