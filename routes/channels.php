<?php

use App\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
| Authorization callbacks for private/presence channels. When a client tries
| to subscribe to a private channel, Pusher calls our /broadcasting/auth
| endpoint, which runs the matching callback below. Returning true authorizes
| the subscription; false denies it.
|
| The /broadcasting/auth route is registered in bootstrap/app.php with the
| auth:api middleware, so $user here is the JWT-authenticated user.
*/

/**
 * Private channel for a single conversation: "conversation.{id}".
 * Only the buyer or the seller of that conversation may subscribe — this is what
 * stops a third party from listening in on someone else's chat.
 *
 * {conversation} is route-model-bound to the Conversation model.
 */
Broadcast::channel('conversation.{conversation}', function ($user, Conversation $conversation) {
    return $conversation->isParticipant($user);
});
