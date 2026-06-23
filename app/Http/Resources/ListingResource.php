<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ListingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'price' => $this->price,
            'status' => $this->status,
            'condition' => $this->condition,
            'location' => $this->location,
            'lat' => $this->lat,
            'lng' => $this->lng,

            // "distance" only exists when the query was filtered by radius
            // (see Listing::scopeWithinRadius). whenNotNull hides it otherwise.
            'distance_km' => $this->whenNotNull(
                isset($this->distance) ? round((float) $this->distance, 2) : null
            ),

            // Related data is included only when eager-loaded by the controller.
            'category' => new CategoryResource($this->whenLoaded('category')),
            // PublicUserResource (NOT UserResource) — listings are public, so we
            // must not leak the seller's email/phone/stripe_account_id.
            'seller' => new PublicUserResource($this->whenLoaded('seller')),
            'images' => ListingImageResource::collection($this->whenLoaded('images')),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
