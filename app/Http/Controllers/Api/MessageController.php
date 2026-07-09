<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\SendMessageRequest;
use App\Http\Resources\MessageResource;
use App\Jobs\SendChatPushNotification;
use App\Models\Conversation;
use App\Services\ImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

/**
 * Handles the messages inside a conversation: listing, sending and marking read.
 * Every action verifies the current user is a participant of the conversation.
 *
 * All routes here are behind auth:api.
 */
class MessageController extends Controller
{
    /**
     * GET /api/conversations/{conversation}/messages
     *
     * Paginated messages, newest first (the client can reverse for display and
     * page back through history with ?page=2, etc.).
     */
    public function index(Conversation $conversation): AnonymousResourceCollection
    {
        $this->authorizeParticipant($conversation);

        $messages = $conversation->messages()
            ->with('sender')
            ->orderByDesc('created_at')
            ->orderByDesc('id') // stable tie-breaker for same-timestamp messages
            ->paginate(30);

        return MessageResource::collection($messages);
    }

    /**
     * POST /api/conversations/{conversation}/messages
     *
     * Send a text or image message, then broadcast it in real time via the
     * MessageSent event.
     */
    public function store(SendMessageRequest $request, Conversation $conversation, ImageUploadService $images): JsonResponse
    {
        $this->authorizeParticipant($conversation);

        // Image message  -> upload the file to S3, store its URL as the content.
        // Text message    -> store the text directly.
        if ($request->hasFile('image')) {
            $type = 'image';
            $content = $images->upload($request->file('image'), 'messages');
        } else {
            $type = 'text';
            $content = $request->input('content');
        }

        $message = $conversation->messages()->create([
            'sender_id' => auth('api')->id(),
            'content' => $content,
            'type' => $type,
            'is_read' => false,
        ]);

        // Bump the thread's last-activity timestamp so it rises to the top of the inbox.
        $conversation->forceFill(['last_message_at' => $message->created_at])->save();

        // Broadcast to the OTHER participant in real time. toOthers() excludes the
        // sender's own socket so they don't receive an echo of their own message.
        broadcast(new MessageSent($message))->toOthers();

        $message->load('sender');

        // Queue a push notification to the OTHER participant (never the sender).
        // This is separate from the Pusher broadcast above (which drives the live,
        // in-app UI) and is queued + fail-safe, so Firebase can never block or break
        // message sending.
        $receiverId = $conversation->buyer_id === $message->sender_id
            ? $conversation->seller_id
            : $conversation->buyer_id;

        $preview = $message->type === 'image'
            ? '📷 Photo'
            : Str::limit((string) $message->content, 100);

        SendChatPushNotification::dispatch(
            $receiverId,
            'New message',
            $message->sender->name.': '.$preview,
            [
                'conversation_id' => (string) $conversation->id,
                'message_id' => (string) $message->id,
                'sender_id' => (string) $message->sender_id,
                'type' => 'chat',
            ],
        );

        return (new MessageResource($message))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * POST /api/conversations/{conversation}/read
     *
     * Mark the other person's unread messages in this conversation as read.
     */
    public function read(Conversation $conversation): JsonResponse
    {
        $this->authorizeParticipant($conversation);

        $updated = $conversation->messages()
            ->where('sender_id', '!=', auth('api')->id()) // only the other person's messages
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'message' => 'Messages marked as read.',
            'updated' => $updated,
        ]);
    }

    /**
     * Abort with 403 unless the current user is part of this conversation.
     */
    private function authorizeParticipant(Conversation $conversation): void
    {
        abort_unless(
            $conversation->isParticipant(auth('api')->user()),
            403,
            'You are not a participant in this conversation.',
        );
    }
}
