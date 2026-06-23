<?php

namespace App\Events;

use App\Http\Resources\PublicUserResource;
use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired whenever a chat message is sent. Because it implements ShouldBroadcast,
 * Laravel pushes it to Pusher so connected clients receive it in real time.
 *
 * Client side (Laravel Echo):
 *   Echo.private(`conversation.${id}`)
 *       .listen('.message.sent', (e) => { ...append e... });
 *
 * NOTE: ShouldBroadcast dispatches the broadcast via the QUEUE. For messages to
 * go out in real time you must run a queue worker (`php artisan queue:work`) or
 * set QUEUE_CONNECTION=sync. (Swap to ShouldBroadcastNow to skip the queue.)
 */
class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message)
    {
        // Ensure the sender is loaded so it can be included in the payload.
        $this->message->loadMissing('sender');
    }

    /**
     * The private channel this event broadcasts on: conversation.{id}.
     * Only participants of the conversation can subscribe (see routes/channels.php).
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.' . $this->message->conversation_id),
        ];
    }

    /**
     * The event name clients listen for (prefixed with a dot: '.message.sent').
     */
    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /**
     * The exact JSON payload delivered to subscribers. We send only public sender
     * fields — never the sender's email/phone.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'content' => $this->message->content,
            'type' => $this->message->type,
            'is_read' => $this->message->is_read,
            'created_at' => optional($this->message->created_at)->toISOString(),
            // Same shape as the REST MessageResource (PublicUserResource) so a
            // live-pushed sender matches a refetched one exactly (id, name, avatar,
            // role, is_verified) — and never leaks email/phone.
            'sender' => (new PublicUserResource($this->message->sender))->resolve(),
        ];
    }
}
