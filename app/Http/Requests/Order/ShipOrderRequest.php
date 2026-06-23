<?php

namespace App\Http\Requests\Order;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates POST /api/orders/{order}/ship (seller adds tracking).
 */
class ShipOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // ownership (is this the seller's order?) is checked in the controller
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tracking_number' => ['required', 'string', 'max:100'],
        ];
    }
}
