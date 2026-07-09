<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\ImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Handles registration, login and the authenticated user's profile.
 *
 * Authentication uses JSON Web Tokens (tymon/jwt-auth) via the "api" guard.
 * The client stores the returned access_token and sends it on every protected
 * request as:  Authorization: Bearer <token>
 */
class AuthController extends Controller
{
    /**
     * POST /api/auth/register
     *
     * Creates a buyer or seller account, assigns the matching role and returns a
     * ready-to-use JWT so the user is logged in immediately after signing up.
     */
    public function register(RegisterRequest $request, ImageUploadService $images): JsonResponse
    {
        // Default to "buyer" if the client did not specify a role.
        $role = $request->input('role', 'buyer');

        // Wrap account creation + role assignment in a transaction so we never end
        // up with a user that has no role (or vice-versa) if something fails.
        $user = DB::transaction(function () use ($request, $role, $images) {
            // Upload the avatar to S3 first (only if one was provided).
            $avatarUrl = $request->hasFile('avatar')
                ? $images->upload($request->file('avatar'), 'avatars')
                : null;

            $user = new User();
            // Only safe, mass-assignable fields go through fill().
            $user->fill([
                'name' => $request->string('name'),
                'email' => $request->string('email'),
                'password' => $request->string('password'), // hashed automatically via the model cast
                'phone' => $request->input('phone'),
                'avatar' => $avatarUrl,
            ]);
            // Privilege fields are set explicitly (they are guarded from mass
            // assignment). $role is validated to buyer|seller by RegisterRequest.
            $user->role = $role;            // denormalised convenience column
            $user->is_verified = false;
            $user->save();

            // Authoritative role via spatie/laravel-permission.
            $user->assignRole($role);

            return $user;
        });

        // Issue a JWT for the freshly created user.
        $token = auth('api')->login($user);

        return $this->respondWithToken($token);
    }

    /**
     * POST /api/auth/login
     *
     * Verifies credentials and returns a JWT on success.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->only('email', 'password');

        // attempt() returns the token string on success, or false on failure.
        if (! $token = auth('api')->attempt($credentials)) {
            return response()->json([
                'message' => 'Invalid email or password.',
            ], 401);
        }

        return $this->respondWithToken($token);
    }

    /**
     * GET /api/auth/me
     *
     * Returns the currently authenticated user (requires a valid token).
     */
    public function me(): JsonResponse
    {
        // Return the resource via response()->json() (NOT directly) so the payload
        // is the flat user object — identical to the "user" shape login/register
        // return. Returning the resource directly would wrap it in a { "data": ... }
        // envelope, which the app does not expect (it would break name/avatar display
        // and stripe_account_id / is_verified detection after refreshUser()).
        return response()->json(new UserResource(auth('api')->user()));
    }

    /**
     * POST /api/auth/logout
     *
     * Invalidates the current token so it can no longer be used.
     */
    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()->json(['message' => 'Successfully logged out.']);
    }

    /**
     * POST /api/auth/refresh
     *
     * Exchanges the current (still valid) token for a fresh one.
     */
    public function refresh(): JsonResponse
    {
        return $this->respondWithToken(auth('api')->refresh());
    }

    /**
     * Build the standard token response used by register/login/refresh.
     */
    protected function respondWithToken(string $token): JsonResponse
    {
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            // TTL is configured in config/jwt.php (minutes); convert to seconds.
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => new UserResource(auth('api')->user()),
        ]);
    }
}
