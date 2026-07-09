<?php

namespace App\Jobs;

use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Queued delivery of a new-chat-message push notification to the RECEIVER's
 * devices. Dispatched from MessageController after the message is saved; runs on
 * the queue so Firebase is never in the message-send request path.
 */
class SendChatPushNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Retry a few times on transient failure, then give up quietly. */
    public int $tries = 3;

    public int $backoff = 10;

    /**
     * Only scalar data is queued (no Eloquent models) so the job is self-contained
     * and won't fail if the message row changes before it runs.
     */
    public function __construct(
        public int $receiverId,
        public string $title,
        public string $body,
        public array $data,
    ) {}

    public function handle(NotificationService $notifications): void
    {
        $notifications->sendToUser($this->receiverId, $this->title, $this->body, $this->data);
    }
}
