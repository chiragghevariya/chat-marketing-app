<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Product category (supports nesting via parent_id).
 */
class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'icon',
        'parent_id',
    ];

    /* -----------------------------------------------------------------
     | Relationships
     | ----------------------------------------------------------------- */

    /**
     * The parent category (NULL for top-level categories).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    /**
     * Direct sub-categories.
     */
    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    /**
     * Listings filed under this category.
     */
    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class);
    }
}
