<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Messages table.
 *
 * Each message belongs to a conversation and is written by a sender (the buyer
 * or the seller). A message is either plain "text" (content = the text) or an
 * "image" (content = the public S3 URL of the uploaded image).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();

            // The text body, or (for image messages) the uploaded image's URL.
            $table->text('content');

            // Message kind.
            $table->enum('type', ['text', 'image'])->default('text');

            // Has the *recipient* read this message yet?
            $table->boolean('is_read')->default(false);

            // created_at + updated_at. created_at orders the thread; updated_at
            // changes when is_read flips.
            $table->timestamps();

            // Fetching a conversation's messages in chronological order is the hot path.
            $table->index(['conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
