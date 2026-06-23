<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates POST /api/conversations/{id}/messages (send a message).
 *
 * A message must contain EITHER text `content` OR an `image` file (use
 * multipart/form-data when sending an image).
 */
class SendMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // participant check is done in the controller
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Required only when no image is attached.
            'content' => ['required_without:image', 'nullable', 'string', 'max:5000'],
            // Required only when no text is provided.
            'image' => ['required_without:content', 'nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ];
    }
}
