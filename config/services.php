<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Stripe Connect (Phase 3 — marketplace payments).
    'stripe' => [
        'key' => env('STRIPE_KEY'),                       // publishable key (pk_...) — used by the frontend
        'secret' => env('STRIPE_SECRET'),                 // secret key (sk_...) — used here on the server
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'), // signing secret (whsec_...) for webhook verification
        'currency' => env('STRIPE_CURRENCY', 'usd'),
        'platform_fee_percent' => env('STRIPE_PLATFORM_FEE_PERCENT', 10), // our cut of each sale (%)
    ],

];
