<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'amount' => $this->amount,
            'platform_fee' => $this->platform_fee,
            'seller_amount' => $this->seller_amount,
            'tracking_number' => $this->tracking_number,
            // The PaymentIntent id is fine to expose; the secret client_secret is
            // returned only once, in the create-order response (never stored here).
            'stripe_payment_intent_id' => $this->stripe_payment_intent_id,

            'listing' => new ListingResource($this->whenLoaded('listing')),
            'buyer' => new PublicUserResource($this->whenLoaded('buyer')),
            'seller' => new PublicUserResource($this->whenLoaded('seller')),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
