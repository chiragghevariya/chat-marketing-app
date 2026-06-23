<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * PUBLIC view of a user — safe to show to *other* people.
 *
 * Use this anywhere a user is embedded in someone else's data (e.g. the seller
 * on a public listing, or the sender of a chat message). It deliberately omits
 * private fields (email, phone, stripe_account_id).
 *
 * For the authenticated user's OWN profile, use UserResource instead, which
 * includes those private fields.
 */
class PublicUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'avatar' => $this->avatar,
            'role' => $this->role,
            'is_verified' => $this->is_verified,
        ];
    }
}
