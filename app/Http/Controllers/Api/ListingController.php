<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Listing\StoreListingRequest;
use App\Http\Requests\Listing\UpdateListingRequest;
use App\Http\Resources\ListingResource;
use App\Models\Category;
use App\Models\Listing;
use App\Services\ImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * CRUD + search for marketplace listings.
 *
 * Public:    index (search), show
 * Sellers:   store, update, destroy  (protected by auth:api + role:seller|admin
 *            in routes/api.php; ownership is enforced per-listing below)
 */
class ListingController extends Controller
{
    /**
     * GET /api/listings
     *
     * Search & filter listings. All parameters are optional:
     *   q          string  keyword matched against title + description
     *   category_id int     category (also includes that category's children)
     *   min_price  number
     *   max_price  number
     *   lat,lng    number  centre point for a radius search
     *   radius     number  radius in KM (requires lat + lng)
     *   status     string  active|sold|draft  (defaults to "active")
     *   sort       string  newest|oldest|price_asc|price_desc (ignored for radius)
     *   per_page   int     results per page (1-50, default 15)
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Listing::query()
            // Eager-load relations to avoid N+1 queries when serialising.
            ->with(['category', 'seller', 'images'])
            // Reusable filters defined as scopes on the Listing model.
            ->keyword($request->input('q'))
            ->priceBetween($request->input('min_price'), $request->input('max_price'))
            // Default to only showing active listings; allow an explicit override.
            ->where('status', $request->input('status', 'active'));

        // Category filter: match the chosen category OR any of its direct children
        // so searching "Electronics" also returns items in "Phones", "Laptops", etc.
        if ($request->filled('category_id')) {
            $categoryId = (int) $request->input('category_id');

            $categoryIds = Category::query()
                ->where('id', $categoryId)
                ->orWhere('parent_id', $categoryId)
                ->pluck('id');

            $query->whereIn('category_id', $categoryIds);
        }

        // Location radius search (nearest-first). Only runs when we have a centre
        // point AND a radius.
        $hasRadius = $request->filled(['lat', 'lng', 'radius']);

        if ($hasRadius) {
            $query->withinRadius(
                (float) $request->input('lat'),
                (float) $request->input('lng'),
                (float) $request->input('radius'),
            );
        } else {
            // Apply the chosen sort order (radius search already orders by distance).
            $query = $this->applySort($query, $request->input('sort', 'newest'));
        }

        // Clamp pagination size to a sane range.
        $perPage = min(max((int) $request->input('per_page', 15), 1), 50);

        // ListingResource::collection() keeps Laravel's pagination meta (links, total…).
        return ListingResource::collection($query->paginate($perPage));
    }

    /**
     * GET /api/listings/{listing}
     *
     * Show a single listing. Route-model binding loads the Listing by id (404 if
     * not found).
     */
    public function show(Listing $listing): ListingResource
    {
        $listing->load(['category', 'seller', 'images']);

        return new ListingResource($listing);
    }

    /**
     * POST /api/listings   (seller/admin only)
     *
     * Create a listing and upload any attached images to S3.
     */
    public function store(StoreListingRequest $request, ImageUploadService $images): JsonResponse
    {
        $listing = DB::transaction(function () use ($request, $images) {
            // The authenticated user is the seller.
            $listing = Listing::create([
                'seller_id' => auth('api')->id(),
                'category_id' => $request->integer('category_id'),
                'title' => $request->string('title'),
                'description' => $request->string('description'),
                'price' => $request->input('price'),
                'status' => $request->input('status', 'draft'),
                'condition' => $request->input('condition'),
                'location' => $request->input('location'),
                'lat' => $request->input('lat'),
                'lng' => $request->input('lng'),
            ]);

            $this->attachImages($listing, $request, $images);

            return $listing;
        });

        $listing->load(['category', 'seller', 'images']);

        // 201 Created.
        return (new ListingResource($listing))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * PUT/PATCH /api/listings/{listing}   (owner or admin only)
     *
     * Update listing fields, optionally remove existing images and/or add new ones.
     */
    public function update(UpdateListingRequest $request, Listing $listing, ImageUploadService $images): ListingResource
    {
        $this->authorizeOwner($listing);

        DB::transaction(function () use ($request, $listing, $images) {
            // Only update the scalar fields that were actually sent.
            $listing->update($request->safe()->only([
                'title', 'description', 'price', 'status',
                'condition', 'location', 'lat', 'lng', 'category_id',
            ]));

            // Remove selected images (delete from S3 + the DB row).
            if ($request->filled('removed_image_ids')) {
                $toRemove = $listing->images()
                    ->whereIn('id', $request->input('removed_image_ids'))
                    ->get();

                foreach ($toRemove as $image) {
                    $images->delete($image->url);
                    $image->delete();
                }
            }

            // Append any newly uploaded images after the current ones.
            $this->attachImages($listing, $request, $images);
        });

        $listing->load(['category', 'seller', 'images']);

        return new ListingResource($listing);
    }

    /**
     * DELETE /api/listings/{listing}   (owner or admin only)
     *
     * Delete the listing and all of its images (files on S3 + DB rows).
     */
    public function destroy(Listing $listing, ImageUploadService $images): JsonResponse
    {
        $this->authorizeOwner($listing);

        DB::transaction(function () use ($listing, $images) {
            // Remove the binary files from S3 first...
            foreach ($listing->images as $image) {
                $images->delete($image->url);
            }

            // ...then delete the listing. The listing_images rows are removed
            // automatically by the cascadeOnDelete foreign key.
            $listing->delete();
        });

        return response()->json(['message' => 'Listing deleted.']);
    }

    /* -----------------------------------------------------------------
     | Helpers
     | ----------------------------------------------------------------- */

    /**
     * Upload any files in the "images" field and attach them to the listing.
     * The first listing image (or the one named by "primary_image") is flagged
     * as primary.
     */
    private function attachImages(Listing $listing, Request $request, ImageUploadService $images): void
    {
        if (! $request->hasFile('images')) {
            return;
        }

        // Continue ordering after any images the listing already has.
        $startOrder = (int) $listing->images()->max('order');
        $startOrder = $listing->images()->exists() ? $startOrder + 1 : 0;

        $files = array_values($request->file('images'));
        $listingHasNoImages = ! $listing->images()->exists();

        // Which uploaded image should be the cover (zero-based). Only honoured if
        // the listing currently has no images. Clamp an out-of-range value back to
        // the first image so we always end up with exactly one primary image.
        $primaryIndex = (int) $request->input('primary_image', 0);
        if ($primaryIndex < 0 || $primaryIndex >= count($files)) {
            $primaryIndex = 0;
        }

        foreach ($files as $index => $file) {
            $url = $images->upload($file, 'listings');

            $listing->images()->create([
                'url' => $url,
                'is_primary' => $listingHasNoImages && $index === $primaryIndex,
                'order' => $startOrder + $index,
            ]);
        }
    }

    /**
     * Apply a sort order to the query. Defaults to newest-first.
     */
    private function applySort($query, ?string $sort)
    {
        return match ($sort) {
            'oldest' => $query->orderBy('created_at'),
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderByDesc('price'),
            default => $query->orderByDesc('created_at'), // "newest"
        };
    }

    /**
     * Abort with 403 unless the current user owns the listing or is an admin.
     */
    private function authorizeOwner(Listing $listing): void
    {
        $user = auth('api')->user();

        if ($listing->seller_id !== $user->id && ! $user->hasRole('admin')) {
            abort(403, 'You are not allowed to modify this listing.');
        }
    }
}
