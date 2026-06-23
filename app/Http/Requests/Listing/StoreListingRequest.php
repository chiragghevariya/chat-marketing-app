<?php

namespace App\Http\Requests\Listing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the POST /api/listings payload (create a listing).
 *
 * Because this request can include image files, the client must send it as
 * multipart/form-data.
 */
class StoreListingRequest extends FormRequest
{
    /**
     * The route is already protected by the `auth:api` + `role:seller|admin`
     * middleware, so any request reaching here is an authorized seller/admin.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],

            'status' => ['nullable', Rule::in(['active', 'sold', 'draft'])],
            'condition' => ['nullable', 'string', 'max:50'],
            'location' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],

            // Up to 8 images per listing.
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,webp', 'max:5120'], // 5 MB each

            // Zero-based index of which uploaded image is the primary/cover one.
            'primary_image' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
