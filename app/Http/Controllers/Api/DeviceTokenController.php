<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Registers/unregisters a device's push (FCM) token for the authenticated user.
 * All routes are behind auth:api. This only stores tokens — it does NOT send or
 * deliver any notifications.
 */
class DeviceTokenController extends Controller
{
    /**
     * POST /api/device-tokens
     *
     * Register (or update) this device's push token. Upsert keyed on the token so
     * the same device never creates duplicate rows; if the token already exists
     * (e.g. a shared device), it's reassigned to the current user.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'platform' => ['nullable', Rule::in(['ios', 'android'])],
        ]);

        $device = DeviceToken::updateOrCreate(
            ['token' => $data['token']],
            [
                'user_id' => auth('api')->id(),
                'platform' => $data['platform'] ?? null,
            ],
        );

        return response()->json([
            'message' => 'Device token registered.',
            'id' => $device->id,
        ], 201);
    }

    /**
     * DELETE /api/device-tokens
     *
     * Remove this device's token (called on logout). Scoped to the current user so
     * a user can only delete their own token.
     */
    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
        ]);

        DeviceToken::query()
            ->where('token', $data['token'])
            ->where('user_id', auth('api')->id())
            ->delete();

        return response()->json(['message' => 'Device token removed.']);
    }
}
