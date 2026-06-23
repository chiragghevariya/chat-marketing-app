<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates POST /api/conversations (start a conversation about a listing).
 */
class StoreConversationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is already behind auth:api
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
