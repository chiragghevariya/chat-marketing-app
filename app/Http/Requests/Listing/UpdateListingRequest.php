<?php

namespace App\Http\Requests\Listing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the PUT/PATCH /api/listings/{id} payload (update a listing).
 *
 * Every field uses "sometimes" so the client can send a partial update — only
 * the fields present in the request are validated and changed.
 *
 * Reminder: HTML forms / mobile clients cannot send files with a real PUT, so to
 * upload new images send a POST with a `_method=PUT` field (Laravel method
 * spoofing) using multipart/form-data.
 */
class UpdateListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Field-level validation only. Ownership (is this *my* listing?) is checked
        // in the controller.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'required', 'string'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'category_id' => ['sometimes', 'required', 'integer', 'exists:categories,id'],

            'status' => ['sometimes', Rule::in(['active', 'sold', 'draft'])],
            'condition' => ['nullable', 'string', 'max:50'],
            'location' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],

            // Optionally append more images to the listing.
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],

            // Optionally delete existing images by id. Each id must belong to a
            // listing_images row (ownership of the listing is enforced separately).
            'removed_image_ids' => ['nullable', 'array'],
            'removed_image_ids.*' => ['integer', 'exists:listing_images,id'],
        ];
    }
}
