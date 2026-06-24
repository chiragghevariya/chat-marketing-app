# Marketplace — Mobile App (Phase 4)

React Native (Expo) client for the Laravel marketplace backend (Phases 1–3).

## Stack

- **Expo** (SDK 51) + React Native
- **React Navigation** — bottom tabs + stack
- **Axios** — REST client against the Laravel `/api`
- **pusher-js** — real-time chat (private channels)
- **@stripe/stripe-react-native** — Buy Now payment sheet
- **expo-image-picker** — multi-photo upload (S3 via the API)
- **@react-native-async-storage/async-storage** — JWT persistence

## Project layout

```
mobile/
├── App.js                       # StripeProvider → AuthProvider → NavigationContainer → RootNavigator
├── app.json                     # Expo config (Stripe + image-picker plugins)
├── babel.config.js
├── package.json
└── src/
    ├── config/
    │   ├── env.js               # API base URL, Pusher key/cluster, Stripe key, token storage key
    │   ├── api.js               # axios instance + the `api` client (auth/listings/conversations/orders/...)
    │   └── theme.js             # colors (orange #E65100), spacing, radius
    ├── store/
    │   └── AuthContext.js       # JWT auth state: login / register / logout / refreshUser
    ├── hooks/
    │   └── usePusher.js         # useConversationChannel() — subscribe to private-conversation.{id}
    ├── navigation/
    │   └── RootNavigator.js     # auth gate + 4 tabs + ListingDetail/Chat stack screens
    ├── components/
    │   ├── ListingCard.js       # 2-column grid card
    │   └── MessageBubble.js     # chat bubble
    └── screens/
        ├── auth/LoginScreen.js  # login + register toggle
        ├── ExploreScreen.js     # search + category chips + filters + grid
        ├── MessagesScreen.js    # conversation list w/ unread badges
        ├── SellScreen.js        # create listing + multi-image picker
        ├── ProfileScreen.js     # my listings, orders, Stripe Connect, logout
        ├── ListingDetailScreen.js # carousel + Message Seller + Buy Now (Stripe sheet)
        └── ChatScreen.js        # real-time message thread
```

## Setup

```bash
cd mobile
npm install

# Align native module versions with the installed Expo SDK (recommended):
npx expo install \
  expo-image-picker expo-status-bar expo-web-browser \
  react-native-gesture-handler react-native-safe-area-context react-native-screens \
  @react-native-async-storage/async-storage @stripe/stripe-react-native

npm start          # then press a / i, or scan the QR with Expo Go
```

## Configure `src/config/env.js`

| Constant | Where it comes from (backend `.env`) | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | `APP_URL` | Root URL, **no** `/api`. See host note below. |
| `PUSHER_KEY` | `PUSHER_APP_KEY` | Public key only. |
| `PUSHER_CLUSTER` | `PUSHER_APP_CLUSTER` | e.g. `mt1`. |
| `STRIPE_PUBLISHABLE_KEY` | `STRIPE_KEY` | `pk_test_...` (publishable, not secret). |

`API_BASE_URL` and `BROADCASTING_AUTH_URL` are derived from `APP_BASE_URL`.

**Host address while developing** (because `localhost` on the device ≠ your machine):
- Android emulator → `http://10.0.2.2:8000`
- iOS simulator → `http://localhost:8000`
- Physical device → your computer's LAN IP, e.g. `http://192.168.1.20:8000`

## How it maps to the backend

- **Auth** — JWT (`tymon/jwt-auth`). The token comes back as `access_token`, is stored in AsyncStorage, and sent as `Authorization: Bearer <token>`.
- **Listings** — `GET /api/listings` with `q`, `category_id`, `min_price`, `max_price`, `condition`, `status`. Create is a single multipart `POST /api/listings` with `images[]` uploaded to S3 by the backend.
- **Chat** — REST for history + send; **Pusher private channel** `private-conversation.{id}`, event `message.sent`, authorized via `/broadcasting/auth` with the Bearer token. Sent messages are appended locally (backend broadcasts `toOthers`).
- **Payments** — `POST /api/orders` returns a PaymentIntent `client_secret`; the app runs `initPaymentSheet` → `presentPaymentSheet`, then `POST /api/orders/{id}/confirm-payment` (manual-capture escrow).
- **Stripe Connect** — `POST /api/seller/stripe/connect-account` returns an `onboarding_url` opened in the browser; seller status is read from `user.stripe_account_id` + `user.is_verified`.

## Real-time requirements

For live message delivery the backend must broadcast. In dev, set `QUEUE_CONNECTION=sync` (or run `php artisan queue:work`) so the `MessageSent` event is actually pushed to Pusher.
