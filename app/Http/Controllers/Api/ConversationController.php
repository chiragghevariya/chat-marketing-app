<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreConversationRequest;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\Listing;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Manages chat conversations (the thread list / inbox).
 * Message sending/reading lives in MessageController.
 *
 * All routes here are behind auth:api.
 */
class ConversationController extends Controller
{
    /**
     * POST /api/conversations
     *
     * Start (or re-open) a conversation about a listing. The authenticated user is
     * the buyer; the seller is taken from the listing. Idempotent: hitting it twice
     * for the same listing returns the existing thread instead of duplicating it.
     */
    public function store(StoreConversationRequest $request): JsonResponse
    {
        $buyer = auth('api')->user();
        $listing = Listing::findOrFail($request->integer('listing_id'));

        // You can't message yourself about your own listing.
        if ($listing->seller_id === $buyer->id) {
            return response()->json([
                'message' => 'You cannot start a conversation on your own listing.',
            ], 422);
        }

        // Active (published) listings can be contacted about by anyone. Once a
        // listing is sold/inactive we still allow its ACTUAL buyer to reach the
        // seller (e.g. to coordinate delivery on the order they placed), but not
        // random users. (GET /listings/{id} can return non-active listings by id.)
        if ($listing->status !== 'active'
            && ! Order::where('listing_id', $listing->id)->where('buyer_id', $buyer->id)->exists()) {
            return response()->json([
                'message' => 'This listing is not available for messaging.',
            ], 422);
        }

        // One thread per (listing, buyer, seller) — reuse if it already exists.
        $conversation = Conversation::firstOrCreate([
            'listing_id' => $listing->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $listing->seller_id,
        ]);

        $conversation->load(['listing', 'buyer', 'seller', 'latestMessage']);

        // 201 when we just created it, 200 when returning an existing thread.
        return (new ConversationResource($conversation))
            ->response()
            ->setStatusCode($conversation->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * GET /api/conversations
     *
     * The current user's inbox: every conversation they take part in (as buyer or
     * seller), newest activity first, each with a last-message preview and the
     * number of messages they haven't read yet.
     */
    public function index(): AnonymousResourceCollection
    {
        $userId = auth('api')->id();

        $conversations = Conversation::query()
            ->forUser($userId)
            ->with(['listing', 'buyer', 'seller', 'latestMessage'])
            // Count only messages the current user hasn't read and didn't send.
            ->withCount(['messages as unread_count' => function ($query) use ($userId) {
                $query->where('is_read', false)->where('sender_id', '!=', $userId);
            }])
            // Sort by latest message; fall back to created_at for empty threads.
            // COALESCE keeps the ordering consistent across MySQL/PostgreSQL.
            ->orderByRaw('COALESCE(last_message_at, created_at) DESC')
            ->paginate(20);

        return ConversationResource::collection($conversations);
    }
}
