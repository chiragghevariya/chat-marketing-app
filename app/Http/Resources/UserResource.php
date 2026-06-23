<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * PRIVATE / self view of a user — includes sensitive fields (email, phone,
 * stripe_account_id). Only return this for the authenticated user's OWN record
 * (e.g. GET /api/auth/me and the register/login token response).
 *
 * To embed a user inside data shown to OTHER people (seller on a listing, chat
 * message sender, ...), use PublicUserResource instead.
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar' => $this->avatar,
            'role' => $this->role,
            'is_verified' => $this->is_verified,
            'stripe_account_id' => $this->stripe_account_id,
            'created_at' => $this->created_at,
        ];
    }
}
