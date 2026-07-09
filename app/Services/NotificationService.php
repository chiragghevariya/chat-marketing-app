<?php

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;
use Throwable;

/**
 * Sends push notifications via Firebase Cloud Messaging (FCM HTTP v1 API, through
 * the Firebase Admin SDK / kreait). All FCM logic lives here so callers never
 * touch Firebase directly.
 *
 * Fail-safe by design: any Firebase problem (missing credentials, network error,
 * bad token) is logged and swallowed — it can NEVER affect chat. This service is
 * invoked from a queued job, so it also never runs inside the message-send request.
 */
class NotificationService
{
    /**
     * Push a notification to ALL of a user's registered devices. Automatically
     * prunes tokens FCM reports as invalid/expired. Never throws.
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): void
    {
        $tokens = DeviceToken::query()->where('user_id', $userId)->pluck('token')->all();

        if (empty($tokens)) {
            return; // no devices registered — nothing to send
        }

        try {
            /** @var Messaging $messaging */
            $messaging = app(Messaging::class);

            // FCM requires every data value to be a string.
            $stringData = array_map(static fn ($value) => (string) $value, $data);

            $message = CloudMessage::new()
                ->withNotification(Notification::create($title, $body))
                ->withData($stringData);

            // One API call fans out to every device the user has registered.
            $report = $messaging->sendMulticast($message, $tokens);
        } catch (Throwable $e) {
            // Missing/invalid service-account credentials, network failure, etc.
            Log::warning('FCM push failed', ['user_id' => $userId, 'error' => $e->getMessage()]);

            return;
        }

        // Remove tokens FCM reported as unregistered/invalid so we stop targeting them.
        $invalidTokens = array_merge($report->invalidTokens(), $report->unknownTokens());

        if (! empty($invalidTokens)) {
            DeviceToken::query()->whereIn('token', $invalidTokens)->delete();
            Log::info('FCM pruned invalid device tokens', ['count' => count($invalidTokens)]);
        }

        // Log any remaining per-token failures (without affecting chat).
        if ($report->hasFailures()) {
            foreach ($report->failures()->getItems() as $failure) {
                Log::warning('FCM delivery failure', ['error' => $failure->error()?->getMessage()]);
            }
        }
    }
}
