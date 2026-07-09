<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DeviceTokenController;
use App\Http\Controllers\Api\ListingController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\SellerStripeController;
use App\Http\Controllers\Api\StripeWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| These routes are loaded by bootstrap/app.php and are automatically given
| the "/api" prefix, so e.g. Route::post('auth/login') => POST /api/auth/login.
|
| Guards used:
|   - public routes        : no auth
|   - auth:api             : a valid JWT is required
|   - role:seller|admin    : the authenticated user must be a seller OR an admin
*/

/* ----------------------------- Authentication ---------------------------- */
Route::prefix('auth')->group(function () {
    // Public
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);

    // Requires a valid token
    Route::middleware('auth:api')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
    });
});

/* ------------------------------- Categories ------------------------------ */
Route::get('categories', [CategoryController::class, 'index']);

/* -------------------------------- Listings ------------------------------- */
// Public reads (search + view).
Route::get('listings', [ListingController::class, 'index']);
Route::get('listings/{listing}', [ListingController::class, 'show']);

// Seller/admin writes. The role middleware is backed by spatie/laravel-permission.
Route::middleware(['auth:api', 'role:seller|admin'])->group(function () {
    Route::post('listings', [ListingController::class, 'store']);
    Route::put('listings/{listing}', [ListingController::class, 'update']);
    Route::patch('listings/{listing}', [ListingController::class, 'update']);
    Route::delete('listings/{listing}', [ListingController::class, 'destroy']);
});

/* --------------------------- Chat (Phase 2) ------------------------------ */
// Any authenticated user (buyer or seller) can chat. Per-conversation access is
// enforced in the controllers via Conversation::isParticipant().
// throttle:60,1 = max 60 chat requests per minute per user (anti-spam / S3 abuse).
Route::middleware(['auth:api', 'throttle:60,1'])->group(function () {
    // Inbox + starting threads.
    Route::post('conversations', [ConversationController::class, 'store']);
    Route::get('conversations', [ConversationController::class, 'index']);

    // Messages within a conversation.
    Route::get('conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('conversations/{conversation}/messages', [MessageController::class, 'store']);
    Route::post('conversations/{conversation}/read', [MessageController::class, 'read']);
});

/* ------------------- Stripe Connect: seller onboarding (Phase 3) --------- */
// Sellers create a connected account + get a hosted onboarding link.
Route::middleware(['auth:api', 'role:seller|admin'])->group(function () {
    Route::post('seller/stripe/connect-account', [SellerStripeController::class, 'connectAccount']);
});
// PUBLIC: Stripe redirects the seller's browser here after onboarding (no JWT).
// Throttled because it is unauthenticated and triggers a Stripe API call.
Route::middleware('throttle:30,1')->get('seller/stripe/callback', [SellerStripeController::class, 'callback']);

/* ----------------------------- Orders / payments (Phase 3) --------------- */
Route::middleware('auth:api')->group(function () {
    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store']);
    Route::get('orders/{order}', [OrderController::class, 'show']);
    Route::post('orders/{order}/confirm-payment', [OrderController::class, 'confirmPayment']);
    Route::post('orders/{order}/ship', [OrderController::class, 'ship']);
    Route::post('orders/{order}/complete', [OrderController::class, 'complete']);
});

/* --------------------- Push notifications: device tokens ----------------- */
// Register/unregister a device's FCM token for the authenticated user. Storage
// only — no notifications are sent from here.
Route::middleware('auth:api')->group(function () {
    Route::post('device-tokens', [DeviceTokenController::class, 'store']);
    Route::delete('device-tokens', [DeviceTokenController::class, 'destroy']);
});

/* ----------------------------- Stripe webhook (Phase 3) ------------------ */
// PUBLIC: called server-to-server by Stripe; verified via the signing secret.
Route::post('stripe/webhook', [StripeWebhookController::class, 'handle']);
