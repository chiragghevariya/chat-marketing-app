<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the POST /api/auth/register payload.
 */
class RegisterRequest extends FormRequest
{
    /**
     * Anyone may register, so authorization always passes.
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            // "confirmed" requires a matching "password_confirmation" field.
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'phone' => ['nullable', 'string', 'max:30'],

            // Users may sign up as a buyer or a seller only. The "admin" role is
            // never self-assignable through the API.
            'role' => ['nullable', Rule::in(['buyer', 'seller'])],

            // Optional avatar image uploaded at sign-up.
            'avatar' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'], // max 5 MB
        ];
    }
}
