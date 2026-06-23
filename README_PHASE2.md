# Marketplace Backend — Phase 2: Real-Time Chat

Adds buyer ⇄ seller **real-time chat** to the Phase 1 API, using
**Laravel broadcasting + Pusher Channels** with **Laravel Echo** on the frontend.

> Builds on Phase 1 (auth + listings). See `README_PHASE1.md` for base setup.

---

## 1. What was added

| Piece | File(s) |
|---|---|
| Packages | `pusher/pusher-php-server` (backend). `laravel-echo` + `pusher-js` are frontend npm packages (env in `.env.example`). |
| Migrations | `conversations`, `messages` |
| Models | `app/Models/Conversation.php`, `app/Models/Message.php` |
| Broadcast event | `app/Events/MessageSent.php` (`ShouldBroadcast`) |
| Controllers | `app/Http/Controllers/Api/ConversationController.php`, `MessageController.php` |
| Channel auth | `routes/channels.php` (private `conversation.{id}`) |
| Config | `config/broadcasting.php`, `bootstrap/app.php` (`withBroadcasting`) |

---

## 2. Install & configure

```bash
# Backend package (already added if you ran composer install on this repo)
composer require pusher/pusher-php-server

# Run the new migrations
php artisan migrate
```

In `.env` set the Pusher credentials (from https://dashboard.pusher.com):

```env
BROADCAST_CONNECTION=pusher          # Laravel 11 var (older Laravel used BROADCAST_DRIVER)
PUSHER_APP_ID=your_app_id
PUSHER_APP_KEY=your_app_key
PUSHER_APP_SECRET=your_app_secret
PUSHER_APP_CLUSTER=mt1
```

> **Local dev without Pusher keys:** keep `BROADCAST_CONNECTION=log`. Broadcasts are
> written to `storage/logs/laravel.log` instead of being sent — every chat REST
> endpoint still works; only the live push is skipped.

### ⚠️ Queue worker is required for live delivery

`MessageSent` implements `ShouldBroadcast`, so Laravel sends the broadcast **via the
queue**. With the default `QUEUE_CONNECTION=database` you must run a worker:

```bash
php artisan queue:work
```

Otherwise broadcasts sit in the `jobs` table and never reach Pusher. Alternatives:
set `QUEUE_CONNECTION=sync` (broadcast inline — fine for dev), or change the event to
implement `ShouldBroadcastNow` to bypass the queue.

---

## 3. How it fits together

```
buyer/seller  --POST /api/conversations/{id}/messages-->  MessageController@store
   creates Message  ->  broadcast(new MessageSent($message))->toOthers()
        |                                   |
   saved to DB                     queued broadcast -> Pusher
                                            |
   other participant's browser  <--  Echo.private(`conversation.{id}`)
                                          .listen('.message.sent', cb)
```

Subscribing to the **private** channel `conversation.{id}` triggers a call to
`POST /broadcasting/auth`, which is guarded by `auth:api` (JWT) and authorized by
`routes/channels.php` — only the conversation's buyer or seller is allowed in.

---

## 4. API reference (all require `Authorization: Bearer <JWT>`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/conversations` | Start (or reuse) a thread about a listing. Body: `listing_id`. |
| GET | `/api/conversations` | Inbox: my threads, newest first, with `last_message` preview + `unread_count`. |
| GET | `/api/conversations/{id}/messages` | Messages in a thread (paginated, newest first). |
| POST | `/api/conversations/{id}/messages` | Send a message → fires `MessageSent`. |
| POST | `/api/conversations/{id}/read` | Mark the other person's messages as read. |

Notes:
- The authenticated user is the **buyer**; the **seller** comes from the listing.
  You can't start a conversation on your own listing (`422`).
- Send a **text** message with JSON `{"content":"..."}`, or an **image** message as
  `multipart/form-data` with an `image` file (uploaded to S3, stored as the message
  `content`, `type=image`).
- Non-participants get `403` on every conversation route.

```bash
# Start a conversation about listing 1
curl -X POST http://127.0.0.1:8000/api/conversations \
  -H "Accept: application/json" -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" -d '{"listing_id":1}'

# Send a text message
curl -X POST http://127.0.0.1:8000/api/conversations/1/messages \
  -H "Accept: application/json" -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" -d '{"content":"Hi, is this still available?"}'

# Send an image message
curl -X POST http://127.0.0.1:8000/api/conversations/1/messages \
  -H "Accept: application/json" -H "Authorization: Bearer $BUYER_TOKEN" \
  -F "image=@/path/photo.jpg"
```

---

## 5. Frontend (Laravel Echo + Pusher)

Install the JS packages and configure Echo. The key detail for this JWT API is the
`auth.headers.Authorization` — Echo must send the user's token to `/broadcasting/auth`.

```bash
npm install --save laravel-echo pusher-js
```

```js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
window.Pusher = Pusher;

const echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
    // Point Echo at our JSON API and send the JWT so /broadcasting/auth can
    // authenticate the private-channel subscription.
    authEndpoint: 'http://127.0.0.1:8000/broadcasting/auth',
    auth: { headers: { Authorization: `Bearer ${jwtToken}`, Accept: 'application/json' } },
});

// Listen for new messages in a conversation
echo.private(`conversation.${conversationId}`)
    .listen('.message.sent', (e) => {
        // e = { id, conversation_id, content, type, is_read, created_at, sender:{id,name,avatar} }
        appendMessageToUI(e);
    });
```

> The leading dot in `.message.sent` is required — it tells Echo to use the
> custom broadcast name from `MessageSent::broadcastAs()` rather than the full
> event class name.

---

## 6. Data model

```
conversations
  id, listing_id ->listings, buyer_id ->users, seller_id ->users,
  last_message_at, timestamps
  UNIQUE(listing_id, buyer_id, seller_id)   -- one thread per trio

messages
  id, conversation_id ->conversations, sender_id ->users,
  content (text | image URL), type [text|image], is_read, timestamps
  INDEX(conversation_id, created_at)
```
