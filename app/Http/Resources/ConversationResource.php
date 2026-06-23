<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Lightweight listing context (only the columns are loaded; the
            // listing's own seller/images/category are not eager-loaded here).
            'listing' => new ListingResource($this->whenLoaded('listing')),
            'buyer' => new PublicUserResource($this->whenLoaded('buyer')),
            'seller' => new PublicUserResource($this->whenLoaded('seller')),

            'last_message_at' => $this->last_message_at,
            // Preview of the most recent message for the inbox list.
            'last_message' => new MessageResource($this->whenLoaded('latestMessage')),

            // Number of unread messages for the *current* user. Present only when
            // the controller adds it via withCount (see ConversationController@index).
            'unread_count' => $this->when(
                $this->unread_count !== null,
                fn () => (int) $this->unread_count,
            ),

            'created_at' => $this->created_at,
        ];
    }
}
