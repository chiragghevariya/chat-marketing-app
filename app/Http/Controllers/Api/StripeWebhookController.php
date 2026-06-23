<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Models\Order;
use App\Models\User;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use UnexpectedValueException;

/**
 * Receives Stripe webhooks (PUBLIC route — Stripe calls it server-to-server).
 *
 * Security: the request is trusted ONLY after its signature is verified against
 * STRIPE_WEBHOOK_SECRET. An unsigned/forged call is rejected with 400.
 *
 * Webhooks are the source of truth for payment state because the buyer's app can
 * close mid-flow. Handlers here are idempotent and only move an order forward.
 */
class StripeWebhookController extends Controller
{
    /** Order status rank, used to prevent out-of-order webhooks downgrading state. */
    private const RANK = [
        Order::STATUS_PENDING_PAYMENT => 0,
        Order::STATUS_PAID => 1,
        Order::STATUS_SHIPPED => 2,
        Order::STATUS_COMPLETED => 3,
    ];

    /**
     * POST /api/stripe/webhook
     */
    public function handle(Request $request, StripeService $stripe): JsonResponse
    {
        try {
            $event = $stripe->constructWebhookEvent(
                $request->getContent(),
                $request->header('Stripe-Signature'),
            );
        } catch (UnexpectedValueException | SignatureVerificationException $e) {
            // Bad payload or bad signature -> reject.
            return response()->json(['message' => 'Invalid payload or signature.'], 400);
        }

        $object = $event->data->object;

        switch ($event->type) {
            // Funds authorized (manual capture) — the buyer's card is secured.
            case 'payment_intent.amount_capturable_updated':
                $this->advanceByIntent($object->id, Order::STATUS_PAID, markSold: true);
                break;

            // Funds captured — the seller has been paid out.
            case 'payment_intent.succeeded':
                $this->advanceByIntent($object->id, Order::STATUS_COMPLETED);
                break;

            // Payment failed — leave the order pending so the buyer can retry.
            case 'payment_intent.payment_failed':
                Log::warning('Stripe payment failed', ['payment_intent' => $object->id]);
                break;

            // A refund was issued — mark the order refunded (terminal).
            case 'charge.refunded':
                $this->refundByIntent($object->payment_intent ?? null);
                break;

            // Connected account onboarding status changed — sync the seller.
            case 'account.updated':
                $this->syncAccount($object);
                break;

            default:
                // Unhandled event types are acknowledged so Stripe stops retrying.
                Log::info('Unhandled Stripe webhook', ['type' => $event->type]);
        }

        // 200 tells Stripe we received it; otherwise it keeps retrying.
        return response()->json(['received' => true]);
    }

    /**
     * Move the order tied to a PaymentIntent forward to $status (never backward).
     */
    private function advanceByIntent(string $paymentIntentId, string $status, bool $markSold = false): void
    {
        $order = Order::where('stripe_payment_intent_id', $paymentIntentId)->first();

        if (! $order || $order->status === Order::STATUS_REFUNDED) {
            return;
        }

        // Only advance if the new status is "further along" than the current one.
        if ((self::RANK[$status] ?? 0) > (self::RANK[$order->status] ?? 0)) {
            $order->update(['status' => $status]);
        }

        if ($markSold) {
            Listing::whereKey($order->listing_id)->update(['status' => 'sold']);
        }
    }

    /**
     * Mark the order tied to a PaymentIntent as refunded.
     */
    private function refundByIntent(?string $paymentIntentId): void
    {
        if (blank($paymentIntentId)) {
            return;
        }

        Order::where('stripe_payment_intent_id', $paymentIntentId)
            ->update(['status' => Order::STATUS_REFUNDED]);
    }

    /**
     * Sync a connected account's onboarding state back to the seller.
     */
    private function syncAccount(object $account): void
    {
        $user = User::where('stripe_account_id', $account->id)->first();

        if ($user && ! empty($account->details_submitted) && ! empty($account->charges_enabled)) {
            $user->forceFill(['is_verified' => true])->save();
        }
    }
}
