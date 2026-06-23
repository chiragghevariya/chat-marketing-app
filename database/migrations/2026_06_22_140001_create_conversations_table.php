<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Conversations table.
 *
 * A conversation is a 1-to-1 chat thread between a buyer and a seller ABOUT a
 * specific listing. There is at most one conversation per (listing, buyer, seller)
 * trio — enforced by the unique index below.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();

            // Which listing this chat is about. Delete the thread if the listing goes.
            $table->foreignId('listing_id')->constrained('listings')->cascadeOnDelete();

            // The two participants. Both reference users; if either account is
            // deleted, the conversation is removed.
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();

            // Timestamp of the most recent message — used to sort the inbox so the
            // newest conversations float to the top. Null until the first message.
            $table->timestamp('last_message_at')->nullable();

            $table->timestamps();

            // Prevent duplicate threads for the same listing/buyer/seller.
            $table->unique(['listing_id', 'buyer_id', 'seller_id']);

            // Speed up "my conversations" lookups (buyer_id = me OR seller_id = me).
            $table->index('buyer_id');
            $table->index('seller_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
