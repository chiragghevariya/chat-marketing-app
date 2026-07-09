<?php

namespace App\Services;

use App\Models\User;
use Stripe\Account;
use Stripe\Event;
use Stripe\PaymentIntent;
use Stripe\StripeClient;
use Stripe\Webhook;

/**
 * Thin wrapper around the Stripe SDK. All Stripe API calls live here so the
 * controllers stay clean and the integration is easy to find and test.
 *
 * Uses Stripe Connect "destination charges": the platform charges the buyer,
 * keeps an application fee, and routes the rest to the seller's connected account.
 */
class StripeService
{
    private StripeClient $stripe;

    public function __construct()
    {
        // Secret key: sk_test_... (test mode) or sk_live_... (live). Set STRIPE_SECRET in .env.
        // Pass an array config with a (possibly null) api_key. A null key is accepted
        // at construction but surfaces a catchable AuthenticationException at request
        // time — which controllers turn into a clean 502 — whereas an empty string or
        // a bare null argument would throw InvalidArgumentException up front.
        $this->stripe = new StripeClient([
            'api_key' => config('services.stripe.secret') ?: null,
        ]);
    }

    /**
     * Run a Stripe SDK call with Stripe's advisory notices suppressed.
     *
     * Stripe's PHP SDK emits an E_USER_WARNING (via trigger_error) whenever an API
     * response carries a "stripe-notice" header — e.g. "We recommend building your
     * integration using Accounts v2." Laravel promotes PHP warnings to fatal
     * ErrorExceptions in every environment (it reports E_ALL), so this harmless
     * advisory would otherwise abort an ALREADY-SUCCESSFUL API call and surface as
     * a 500. We swallow only E_USER_WARNING for the duration of the call; any other
     * error still falls through to Laravel's handler, and real Stripe API failures
     * still throw \Stripe\Exception\ApiErrorException as normal.
     *
     * @template T
     *
     * @param  callable(): T  $call
     * @return T
     */
    private function withoutStripeNotices(callable $call)
    {
        set_error_handler(static fn (): bool => true, \E_USER_WARNING);

        try {
            return $call();
        } finally {
            restore_error_handler();
        }
    }

    /* ===================== Connect: seller onboarding ===================== */

    /**
     * Create a Stripe Connect **Express** account for a seller. Express accounts
     * use Stripe's hosted onboarding and dashboard, so we don't collect/store
     * sensitive bank details ourselves.
     */
    public function createExpressAccount(User $seller): Account
    {
        return $this->withoutStripeNotices(fn () => $this->stripe->accounts->create([
            'type' => 'express',
            'email' => $seller->email,
            'capabilities' => [
                'card_payments' => ['requested' => true],
                'transfers' => ['requested' => true],
            ],
            'business_type' => 'individual',
            'metadata' => ['user_id' => (string) $seller->id],
        ]));
    }

    /**
     * Create a one-time hosted onboarding link the seller is redirected to.
     *
     * @return string The Stripe-hosted onboarding URL.
     */
    public function createOnboardingLink(string $accountId, string $returnUrl, string $refreshUrl): string
    {
        $link = $this->withoutStripeNotices(fn () => $this->stripe->accountLinks->create([
            'account' => $accountId,
            'return_url' => $returnUrl,   // where Stripe sends the user when finished
            'refresh_url' => $refreshUrl, // where Stripe sends them if the link expires
            'type' => 'account_onboarding',
        ]));

        return $link->url;
    }

    /**
     * Create a single-use Express Dashboard login link for the connected account.
     *
     * @return string The Stripe-hosted dashboard URL.
     */
    public function createLoginLink(string $accountId): string
    {
        $link = $this->withoutStripeNotices(fn () => $this->stripe->accounts->createLoginLink($accountId));

        return $link->url;
    }

    public function retrieveAccount(string $accountId): Account
    {
        return $this->withoutStripeNotices(fn () => $this->stripe->accounts->retrieve($accountId));
    }

    /* ========================= Payments / orders ========================= */

    /**
     * Create a PaymentIntent for a destination charge.
     *
     * @param  int     $amountCents             Total the buyer pays, in cents.
     * @param  int     $feeCents                Our platform fee, in cents (application_fee_amount).
     * @param  string  $destinationAccountId    Seller's connected account (acct_...).
     * @param  array   $metadata                Extra data to store on the intent.
     *
     * capture_method = 'manual' makes this an authorize-now / capture-later flow:
     * the buyer's card is held when they confirm, and the money is only moved to
     * the seller when we capture (on order completion). That gives simple escrow.
     */
    public function createPaymentIntent(int $amountCents, int $feeCents, string $destinationAccountId, array $metadata = []): PaymentIntent
    {
        return $this->withoutStripeNotices(fn () => $this->stripe->paymentIntents->create([
            'amount' => $amountCents,
            'currency' => config('services.stripe.currency', 'usd'),
            'application_fee_amount' => $feeCents,
            'transfer_data' => ['destination' => $destinationAccountId],
            'capture_method' => 'manual',
            // Enable Stripe's automatic payment methods, but disallow redirect-based
            // methods: many of them can't be authorized-and-held (requires_capture),
            // which would break the manual-capture escrow this flow depends on.
            'automatic_payment_methods' => ['enabled' => true, 'allow_redirects' => 'never'],
            'metadata' => $metadata,
        ]));
    }

    public function retrievePaymentIntent(string $paymentIntentId): PaymentIntent
    {
        return $this->withoutStripeNotices(fn () => $this->stripe->paymentIntents->retrieve($paymentIntentId));
    }

    /**
     * Capture a previously authorized PaymentIntent — this releases the funds to
     * the seller (minus our application fee). Called when the buyer confirms receipt.
     */
    public function capturePaymentIntent(string $paymentIntentId): PaymentIntent
    {
        return $this->withoutStripeNotices(fn () => $this->stripe->paymentIntents->capture($paymentIntentId));
    }

    /* ============================== Webhooks ============================= */

    /**
     * Verify a webhook's signature and return the parsed event. Throws
     * \Stripe\Exception\SignatureVerificationException if the signature is invalid,
     * which is how we reject forged webhook calls.
     */
    public function constructWebhookEvent(string $payload, ?string $signature): Event
    {
        return Webhook::constructEvent(
            $payload,
            (string) $signature,
            config('services.stripe.webhook_secret'),
        );
    }
}
