<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;

/**
 * Stripe Connect seller onboarding.
 *
 * Flow:
 *   1. Seller calls connect-account -> we create/reuse an Express account and
 *      return a Stripe-hosted onboarding URL.
 *   2. Seller completes onboarding on Stripe, then Stripe redirects their browser
 *      to our public callback, where we confirm the account is ready.
 */
class SellerStripeController extends Controller
{
    /**
     * POST /api/seller/stripe/connect-account   (seller/admin, auth:api)
     *
     * Returns { onboarding_url } for the app to open in a browser/web view.
     */
    public function connectAccount(StripeService $stripe): JsonResponse
    {
        $seller = auth('api')->user();

        try {
            // Reuse the seller's existing connected account if they started before;
            // otherwise create a new Express account and save its id immediately.
            $accountId = $seller->stripe_account_id;

            if (blank($accountId)) {
                $account = $stripe->createExpressAccount($seller);
                $accountId = $account->id;

                // stripe_account_id is guarded from mass-assignment, so set it directly.
                $seller->forceFill(['stripe_account_id' => $accountId])->save();
            }

            $base = rtrim(config('app.url'), '/');

            $onboardingUrl = $stripe->createOnboardingLink(
                $accountId,
                // return_url: Stripe sends the user here when onboarding finishes.
                $base . '/api/seller/stripe/callback?account_id=' . $accountId,
                // refresh_url: Stripe sends the user here if the link expires.
                $base . '/api/seller/stripe/callback?account_id=' . $accountId . '&refresh=1',
            );
        } catch (ApiErrorException $e) {
            Log::error('Stripe onboarding failed', ['user_id' => $seller->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not start Stripe onboarding. Please try again.'], 502);
        }

        return response()->json([
            'onboarding_url' => $onboardingUrl,
            'stripe_account_id' => $accountId,
        ]);
    }

    /**
     * GET /api/seller/stripe/callback   (PUBLIC — Stripe redirects the browser here)
     *
     * This route has no JWT because Stripe redirects the user's browser without our
     * auth header. We identify the seller by the account_id we saved earlier, then
     * confirm with Stripe that onboarding is actually complete.
     *
     * NOTE: For production, the robust source of truth is the `account.updated`
     * webhook; treat this callback as a convenience/"thanks" landing endpoint. In a
     * real app, return_url usually points to a frontend page instead of the API.
     */
    public function callback(Request $request, StripeService $stripe): JsonResponse
    {
        $accountId = $request->query('account_id');

        if (blank($accountId)) {
            return response()->json(['message' => 'Missing account_id.'], 400);
        }

        $user = User::where('stripe_account_id', $accountId)->first();

        if (! $user) {
            return response()->json(['message' => 'Unknown Stripe account.'], 404);
        }

        try {
            $account = $stripe->retrieveAccount($accountId);
        } catch (ApiErrorException $e) {
            Log::error('Stripe retrieveAccount failed', ['account_id' => $accountId, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not verify the Stripe account. Please try again.'], 502);
        }

        // Onboarding is "done" once Stripe has all details and the account can charge.
        $completed = (bool) ($account->details_submitted && $account->charges_enabled);

        if ($completed) {
            // Mark the seller verified now that they can accept payments.
            $user->forceFill(['is_verified' => true])->save();
        }

        return response()->json([
            'message' => $completed
                ? 'Stripe onboarding complete — you can now accept payments.'
                : 'Stripe onboarding is not finished yet. Please complete all steps.',
            'onboarding_complete' => $completed,
            'charges_enabled' => (bool) $account->charges_enabled,
            'details_submitted' => (bool) $account->details_submitted,
        ]);
    }
}
