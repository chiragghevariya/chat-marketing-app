<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Order\ShipOrderRequest;
use App\Http\Requests\Order\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Listing;
use App\Models\Order;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;

/**
 * Order + payment lifecycle (Stripe Connect destination charges).
 *
 *   store           buyer places order  -> creates PaymentIntent (manual capture),
 *                                           returns client_secret for the app.
 *   confirmPayment  buyer's card authorized -> mark order paid, listing sold.
 *   ship            seller adds tracking -> mark shipped.
 *   complete        buyer confirms receipt -> capture payment (pay out seller).
 *
 * All routes are behind auth:api; per-order access is checked below.
 */
class OrderController extends Controller
{
    /**
     * GET /api/orders — orders where I'm the buyer or the seller.
     */
    public function index(): AnonymousResourceCollection
    {
        $userId = auth('api')->id();

        $orders = Order::query()
            ->where(fn ($q) => $q->where('buyer_id', $userId)->orWhere('seller_id', $userId))
            ->with(['listing', 'buyer', 'seller'])
            ->latest()
            ->paginate(20);

        return OrderResource::collection($orders);
    }

    /**
     * GET /api/orders/{order} — a single order (buyer or seller only).
     */
    public function show(Order $order): OrderResource
    {
        $this->authorizeParticipant($order);
        $order->load(['listing', 'buyer', 'seller']);

        return new OrderResource($order);
    }

    /**
     * POST /api/orders — buyer places an order.
     */
    public function store(StoreOrderRequest $request, StripeService $stripe): JsonResponse
    {
        $buyer = auth('api')->user();
        $listing = Listing::findOrFail($request->integer('listing_id'));

        // --- Business rules ------------------------------------------------
        if ($listing->seller_id === $buyer->id) {
            return response()->json(['message' => 'You cannot buy your own listing.'], 422);
        }

        if ($listing->status !== 'active') {
            return response()->json(['message' => 'This listing is not available for purchase.'], 422);
        }

        $seller = $listing->seller;

        // The seller must have finished Stripe Connect onboarding to receive money.
        if (blank($seller->stripe_account_id)) {
            return response()->json(['message' => 'This seller cannot accept payments yet.'], 422);
        }

        // --- Reserve the listing ATOMICALLY (prevents double-selling) ------
        // Flip active -> sold in a single conditional UPDATE. Only ONE concurrent
        // request can match (affected rows = 1); any other buyer racing for the same
        // one-of-a-kind item gets 0 rows and is rejected here. This is the single
        // atomic point that stops the same listing being sold to two buyers.
        // (If the buyer abandons checkout, a scheduled job should release listings
        // whose order is still pending_payment after a timeout — see README_PHASE3.)
        $reserved = Listing::whereKey($listing->id)
            ->where('status', 'active')
            ->update(['status' => 'sold']);

        if ($reserved === 0) {
            return response()->json(['message' => 'This listing is no longer available.'], 422);
        }

        // --- Money split (computed server-side, never from the client) -----
        $feePercent = (float) config('services.stripe.platform_fee_percent', 10);
        $amount = round((float) $listing->price, 2);
        $platformFee = round($amount * $feePercent / 100, 2);
        $sellerAmount = round($amount - $platformFee, 2);

        $order = Order::create([
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount' => $amount,
            'platform_fee' => $platformFee,
            'seller_amount' => $sellerAmount,
            'status' => Order::STATUS_PENDING_PAYMENT,
        ]);

        try {
            $intent = $stripe->createPaymentIntent(
                (int) round($amount * 100),        // total, in cents
                (int) round($platformFee * 100),   // our fee, in cents
                $seller->stripe_account_id,
                ['order_id' => (string) $order->id, 'listing_id' => (string) $listing->id],
            );
        } catch (ApiErrorException $e) {
            // Roll back BOTH sides: delete the order and release the listing.
            $order->delete();
            Listing::whereKey($listing->id)->update(['status' => 'active']);

            Log::error('Stripe createPaymentIntent failed', ['listing_id' => $listing->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Payment setup failed. Please try again.'], 502);
        }

        $order->update(['stripe_payment_intent_id' => $intent->id]);
        $order->load(['listing', 'buyer', 'seller']);

        return response()->json([
            'order' => new OrderResource($order),
            // The app uses this with Stripe.js / the mobile SDK to confirm the card.
            'client_secret' => $intent->client_secret,
        ], 201);
    }

    /**
     * POST /api/orders/{order}/confirm-payment — buyer confirms the card was
     * authorized (the actual card confirmation happens client-side with the
     * client_secret; this syncs our order status from Stripe).
     */
    public function confirmPayment(Order $order, StripeService $stripe): JsonResponse
    {
        $this->authorizeBuyer($order);

        if (blank($order->stripe_payment_intent_id)) {
            return response()->json(['message' => 'This order has no payment to confirm.'], 422);
        }

        try {
            $intent = $stripe->retrievePaymentIntent($order->stripe_payment_intent_id);
        } catch (ApiErrorException $e) {
            Log::error('Stripe retrievePaymentIntent failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not verify the payment. Please try again.'], 502);
        }

        // requires_capture = card authorized and funds held (the normal manual-capture
        // path). succeeded = already captured (e.g. the webhook got there first).
        // Either way the buyer has committed, so mark the order paid. The listing was
        // already reserved (set to sold) when the order was created.
        if (in_array($intent->status, ['requires_capture', 'succeeded'], true)
            && $order->status === Order::STATUS_PENDING_PAYMENT) {
            $order->update(['status' => Order::STATUS_PAID]);
        }

        $order->load(['listing', 'buyer', 'seller']);

        return response()->json([
            'order' => new OrderResource($order),
            'payment_status' => $intent->status,
        ]);
    }

    /**
     * POST /api/orders/{order}/ship — seller marks the order shipped with tracking.
     */
    public function ship(ShipOrderRequest $request, Order $order): JsonResponse
    {
        $this->authorizeSeller($order);

        if ($order->status !== Order::STATUS_PAID) {
            return response()->json(['message' => 'Order must be paid before it can be shipped.'], 422);
        }

        $order->update([
            'tracking_number' => $request->string('tracking_number'),
            'status' => Order::STATUS_SHIPPED,
        ]);

        $order->load(['listing', 'buyer', 'seller']);

        return response()->json(['order' => new OrderResource($order)]);
    }

    /**
     * POST /api/orders/{order}/complete — buyer confirms receipt. We capture the
     * payment, which releases the funds to the seller (minus our platform fee).
     */
    public function complete(Order $order, StripeService $stripe): JsonResponse
    {
        $this->authorizeBuyer($order);

        // Allow completing a shipped order (normal flow) or a paid one (e.g. digital).
        if (! in_array($order->status, [Order::STATUS_SHIPPED, Order::STATUS_PAID], true)) {
            return response()->json(['message' => 'This order cannot be completed yet.'], 422);
        }

        try {
            $stripe->capturePaymentIntent($order->stripe_payment_intent_id);
        } catch (ApiErrorException $e) {
            Log::error('Stripe capture failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Payment capture failed. Please try again.'], 502);
        }

        $order->update(['status' => Order::STATUS_COMPLETED]);
        $order->load(['listing', 'buyer', 'seller']);

        return response()->json(['order' => new OrderResource($order)]);
    }

    /* -----------------------------------------------------------------
     | Authorization helpers
     | ----------------------------------------------------------------- */

    private function authorizeBuyer(Order $order): void
    {
        abort_unless($order->buyer_id === auth('api')->id(), 403, 'This is not your order.');
    }

    private function authorizeSeller(Order $order): void
    {
        abort_unless($order->seller_id === auth('api')->id(), 403, 'This is not your order.');
    }

    private function authorizeParticipant(Order $order): void
    {
        abort_unless(
            in_array(auth('api')->id(), [$order->buyer_id, $order->seller_id], true),
            403,
            'This is not your order.',
        );
    }
}
