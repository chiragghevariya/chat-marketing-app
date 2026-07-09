<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;       // gives us assignRole(), hasRole(), etc.
use Tymon\JWTAuth\Contracts\JWTSubject;       // contract required to issue JWTs for this model
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;

/**
 * Application user.
 *
 * A single users table holds buyers, sellers and admins. The active role(s) are
 * managed by spatie/laravel-permission (the `roles` pivot), while a denormalised
 * copy lives in the `role` column for convenience.
 *
 * Implements JWTSubject so tymon/jwt-auth can encode/decode this model in tokens.
 */
class User extends Authenticatable implements JWTSubject, FilamentUser
{
    use HasFactory, Notifiable, HasRoles;

    /**
     * The guard name Spatie Laravel Permission uses to authorize this model.
     * Forces both JWT (api) and Web Session (web) guards to share the 'api' role definitions.
     *
     * @var string
     */
    protected $guard_name = 'api';

    /**
     * Determine if the user is authorized to access the given Filament panel.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        if ($panel->getId() === 'admin') {
            return $this->hasRole('admin');
        }

        if ($panel->getId() === 'seller') {
            return $this->hasRole('seller');
        }

        if ($panel->getId() === 'buyer') {
            return $this->hasRole('buyer');
        }

        return false;
    }

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

    /**
     * This user's registered device push (FCM) tokens.
     */
    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
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
