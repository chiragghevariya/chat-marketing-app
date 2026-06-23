<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates POST /api/orders (buyer places an order).
 *
 * The amount is NEVER taken from the client — it is computed server-side from the
 * listing's price. We only need to know which listing is being bought.
 */
class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind auth:api
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'listing_id' => ['required', 'integer', 'exists:listings,id'],
        ];
    }
}
