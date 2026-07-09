<?php

namespace App\Policies;

use App\Models\Listing;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ListingPolicy
{
    use HandlesAuthorization;

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRole('admin') || $user->hasRole('seller');
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Listing $listing): bool
    {
        if ($user->hasRole('admin')) {
            return true;
        }

        return $user->hasRole('seller') && $listing->seller_id === $user->id;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasRole('admin') || $user->hasRole('seller');
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Listing $listing): bool
    {
        if ($user->hasRole('admin')) {
            return true;
        }

        return $user->hasRole('seller') && $listing->seller_id === $user->id;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Listing $listing): bool
    {
        if ($user->hasRole('admin')) {
            return true;
        }

        // Seller can only delete their own listing before it is sold
        return $user->hasRole('seller') 
            && $listing->seller_id === $user->id 
            && $listing->status !== 'sold';
    }
}
