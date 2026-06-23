<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');

            // ---- Marketplace-specific columns ----------------------------------
            // Phone number (optional at registration, used later for SMS / contact).
            $table->string('phone')->nullable();

            // Public URL of the user's avatar image (stored on S3 via ImageUploadService).
            $table->string('avatar')->nullable();

            // Denormalised primary role for quick reads/filtering.
            // The authoritative role check is done through spatie/laravel-permission
            // (the `roles` pivot table), but keeping a copy here is handy for the UI
            // and avoids an extra join on simple "what is this user?" lookups.
            $table->string('role')->default('buyer'); // buyer | seller | admin

            // Stripe Connect account id (e.g. "acct_123"). Populated in a later phase
            // when a seller onboards for payouts. Nullable until then.
            $table->string('stripe_account_id')->nullable();

            // Whether the account passed identity/email verification.
            $table->boolean('is_verified')->default(false);
            // --------------------------------------------------------------------

            $table->rememberToken();
            $table->timestamps();

            // We frequently filter "all sellers", so index the role column.
            $table->index('role');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
