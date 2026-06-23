<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A marketplace listing (the thing buyers browse and sellers create).
 */
class Listing extends Model
{
    use HasFactory;

    protected $fillable = [
        'seller_id',
        'category_id',
        'title',
        'description',
        'price',
        'status',
        'condition',
        'location',
        'lat',
        'lng',
    ];

    /**
     * Attribute casting.
     *
     * NOTE: `decimal:2` intentionally returns a STRING (e.g. "799.00") to avoid
     * binary floating-point rounding on money — so the API emits price as a JSON
     * string. lat/lng use `float` and serialize as JSON numbers.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'lat' => 'float',
            'lng' => 'float',
        ];
    }

    /* -----------------------------------------------------------------
     | Relationships
     | ----------------------------------------------------------------- */

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        // Ordered gallery: primary image first, then by the `order` column.
        return $this->hasMany(ListingImage::class)
            ->orderByDesc('is_primary')
            ->orderBy('order');
    }

    /**
     * Convenience relation to fetch just the cover image.
     */
    public function primaryImage(): HasOne
    {
        return $this->hasOne(ListingImage::class)->where('is_primary', true);
    }

    /* -----------------------------------------------------------------
     | Query scopes (reusable filters for the search endpoint)
     | ----------------------------------------------------------------- */

    /**
     * Only listings that are live/buyable.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    /**
     * Free-text search across title and description.
     */
    public function scopeKeyword(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('title', 'like', "%{$term}%")
                ->orWhere('description', 'like', "%{$term}%");
        });
    }

    /**
     * Filter by an inclusive price range. Either bound may be null.
     */
    public function scopePriceBetween(Builder $query, $min, $max): Builder
    {
        if (filled($min)) {
            $query->where('price', '>=', $min);
        }

        if (filled($max)) {
            $query->where('price', '<=', $max);
        }

        return $query;
    }

    /**
     * Restrict results to within $radiusKm of the given coordinates and order
     * them nearest-first.
     *
     * Uses the Haversine great-circle formula (Earth radius = 6371 km) computed
     * in SQL. Verified on PostgreSQL (the production RDS target) and works on
     * MySQL too — both provide acos()/cos()/sin()/radians() natively.
     *
     * NOTE: This query is NOT supported on SQLite (it lacks those math functions
     * and will throw "no such function: acos"). Use MySQL or PostgreSQL locally
     * if you need location/radius search — see README_PHASE1.md.
     */
    public function scopeWithinRadius(Builder $query, float $lat, float $lng, float $radiusKm): Builder
    {
        // The "?" placeholders are bound in order to prevent SQL injection.
        $haversine = '(6371 * acos('
            . 'cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) '
            . '+ sin(radians(?)) * sin(radians(lat))'
            . '))';

        return $query
            ->whereNotNull('lat')
            ->whereNotNull('lng')
            // Filter in the WHERE clause (not HAVING) using the full expression.
            // Why: paginate() runs a separate count(*) query that drops the SELECT
            // columns, so a HAVING that referenced the "distance" alias would crash.
            // A self-contained whereRaw survives that count query unchanged.
            ->whereRaw("{$haversine} <= ?", [$lat, $lng, $lat, $radiusKm])
            // Also expose the computed distance (km) and sort nearest-first. These
            // select/order bits are stripped from the count query automatically.
            ->select('listings.*')
            ->selectRaw("{$haversine} AS distance", [$lat, $lng, $lat])
            ->orderBy('distance');
    }
}
