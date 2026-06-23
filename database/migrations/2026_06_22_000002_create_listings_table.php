<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Listings table — the core "products" of the marketplace.
 *
 * A listing is created by a seller (a user with the `seller` role) and belongs
 * to one category. Geo coordinates (lat/lng) power the "search near me" radius
 * filter implemented in ListingController@index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table) {
            $table->id();

            // The seller who owns this listing. If the user is deleted, remove
            // their listings too (cascadeOnDelete).
            $table->foreignId('seller_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // The category this listing belongs to. We block deleting a category
            // that still has listings (restrictOnDelete) to avoid orphan data.
            $table->foreignId('category_id')
                ->constrained('categories')
                ->restrictOnDelete();

            $table->string('title');
            $table->text('description');

            // Price stored as DECIMAL to avoid floating-point rounding errors.
            // 12 total digits, 2 after the decimal point -> up to 9,999,999,999.99
            $table->decimal('price', 12, 2);

            // Lifecycle status of the listing.
            $table->enum('status', ['active', 'sold', 'draft'])->default('draft');

            // Item condition, e.g. "new", "like_new", "used". Free-form/nullable
            // so we are not forced into a fixed list this early in the project.
            $table->string('condition')->nullable();

            // Human-readable location, e.g. "Brooklyn, NY".
            $table->string('location')->nullable();

            // Geo coordinates used for the radius (distance) search.
            // DECIMAL(10, 7) gives ~1cm precision and a range of -180.0 to 180.0.
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();

            $table->timestamps();

            // Indexes for the most common filters used by the search endpoint.
            $table->index('status');
            $table->index(['lat', 'lng']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listings');
    }
};
