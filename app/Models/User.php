<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;       // gives us assignRole(), hasRole(), etc.
use Tymon\JWTAuth\Contracts\JWTSubject;       // contract required to issue JWTs for this model

/**
 * Application user.
 *
 * A single users table holds buyers, sellers and admins. The active role(s) are
 * managed by spatie/laravel-permission (the `roles` pivot), while a denormalised
 * copy lives in the `role` column for convenience.
 *
 * Implements JWTSubject so tymon/jwt-auth can encode/decode this model in tokens.
 */
class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, HasRoles;

    /**
     * Mass-assignable attributes.
     *
     * NOTE: `role`, `is_verified` and `stripe_account_id` are intentionally NOT
     * here. They are trust/privilege fields and must only ever be set by explicit
     * server-controlled code (e.g. $user->role = ... in AuthController), never by
     * mass-assigning client input — otherwise a user could self-promote to admin.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'avatar',
    ];

    /**
     * Attributes hidden from JSON output (never expose these to the API).
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Attribute casting.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',      // auto-hashes when set, e.g. $user->password = 'plain'
            'is_verified' => 'boolean',
        ];
    }

    /* -----------------------------------------------------------------
     | Relationships
     | ----------------------------------------------------------------- */

    /**
     * All listings created by this user (as a seller).
     */
    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class, 'seller_id');
    }

    /* -----------------------------------------------------------------
     | JWTSubject implementation
     | ----------------------------------------------------------------- */

    /**
     * The value stored in the token's "sub" claim (the user id).
     */
    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /**
     * Extra claims to embed in the JWT payload. We keep it empty for now.
     *
     * @return array<string, mixed>
     */
    public function getJWTCustomClaims(): array
    {
        return [];
    }
}
