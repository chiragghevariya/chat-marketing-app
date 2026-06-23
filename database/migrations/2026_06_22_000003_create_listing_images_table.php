<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Listing images table.
 *
 * Each listing can have many images (a one-to-many relationship). Exactly one
 * image should be flagged as `is_primary` to be used as the thumbnail.
 * The actual image binary lives on AWS S3; here we only store its public URL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listing_images', function (Blueprint $table) {
            $table->id();

            // Parent listing. Deleting a listing removes its images rows too.
            // (The files on S3 are removed separately by ImageUploadService.)
            $table->foreignId('listing_id')
                ->constrained('listings')
                ->cascadeOnDelete();

            // Public S3 URL of the uploaded image.
            $table->string('url');

            // Marks the main/cover image shown in listing previews.
            $table->boolean('is_primary')->default(false);

            // Display order in the image gallery (0 = first). "order" is a
            // reserved SQL word, but Eloquent quotes identifiers so it is safe.
            $table->unsignedInteger('order')->default(0);

            $table->timestamps();

            $table->index('listing_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_images');
    }
};
