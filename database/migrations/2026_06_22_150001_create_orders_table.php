<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Orders table — one purchase of a listing by a buyer.
 *
 * Money is split three ways and stored for the record:
 *   amount        = what the buyer pays (the listing price)
 *   platform_fee  = our cut (10% of amount) — Stripe "application_fee_amount"
 *   seller_amount = amount - platform_fee (what the seller receives)
 *
 * We use FK restrictOnDelete on listing/buyer/seller so financial records can
 * never be silently destroyed by deleting a related row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            $table->foreignId('listing_id')->constrained('listings')->restrictOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();

            // Amounts in the store currency (USD). DECIMAL avoids float rounding.
            $table->decimal('amount', 12, 2);
            $table->decimal('platform_fee', 12, 2);
            $table->decimal('seller_amount', 12, 2);

            // Order lifecycle:
            //   pending_payment -> paid -> shipped -> completed
            // A refund can happen from any non-terminal paid state (paid/shipped/
            // completed), moving the order to the terminal "refunded".
            $table->enum('status', [
                'pending_payment',
                'paid',
                'shipped',
                'completed',
                'refunded',
            ])->default('pending_payment');

            // Stripe PaymentIntent id (pi_...). Set when the order is created.
            $table->string('stripe_payment_intent_id')->nullable();

            // Shipping tracking number added by the seller.
            $table->string('tracking_number')->nullable();

            $table->timestamps();

            $table->index('buyer_id');
            $table->index('seller_id');
            $table->index('status');
            $table->index('stripe_payment_intent_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
