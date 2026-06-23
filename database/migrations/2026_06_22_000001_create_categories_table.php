<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Categories table.
 *
 * Categories can be nested one level (or more) deep using the self-referencing
 * `parent_id` column. For example: "Electronics" (parent) -> "Phones" (child).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();

            // Display name, e.g. "Electronics".
            $table->string('name');

            // Optional icon. Can be an emoji, an icon-font class, or an image URL —
            // we keep it as a free-form string so the frontend decides how to render it.
            $table->string('icon')->nullable();

            // Self-referencing parent. NULL means this is a top-level category.
            // If a parent category is deleted, its children become top-level (nullOnDelete).
            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('categories')
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
