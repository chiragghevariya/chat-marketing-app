<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Conversation;
use App\Models\Listing;
use App\Models\Message;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Phase 5 — demo showcase data.
 *
 * Seeds 3 sellers + 2 buyers, 10 active listings (with placeholder images)
 * across Phones / Furniture / Clothing, and 3 completed orders — each with a
 * buyer<->seller chat thread.
 *
 * Idempotent: safe to re-run. Natural keys drive firstOrCreate so a second run
 * never duplicates rows (users by email, listings by [seller_id,title], orders
 * by stripe_payment_intent_id, conversations by [listing_id,buyer_id,seller_id]).
 * Child rows (images/messages) are only added when none exist for the parent.
 *
 * IMPORTANT model rules respected here:
 *   - role / is_verified / stripe_account_id are GUARDED -> set via forceFill().
 *   - password has the "hashed" cast -> assign PLAIN text ('password123').
 *   - spatie roles use guard_name "api" -> syncRoles([...]) after RoleSeeder.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // --- Sellers (role seller, verified, placeholder Stripe Connect ids) ----
        $sarah = $this->makeSeller('Sarah Chen', 'seller1@demo.com', 'acct_demo_seller1');
        $marcus = $this->makeSeller('Marcus Lee', 'seller2@demo.com', 'acct_demo_seller2');
        $elena = $this->makeSeller('Elena Rossi', 'seller3@demo.com', 'acct_demo_seller3');

        // --- Buyers (role buyer, verified) -------------------------------------
        $bob = $this->makeBuyer('Bob Buyer', 'buyer1@demo.com');
        $alice = $this->makeBuyer('Alice Adams', 'buyer2@demo.com');

        // --- Categories (look up existing leaves; never create) -----------------
        $phones = Category::where('name', 'Phones')->first();
        $furniture = Category::where('name', 'Furniture')->first();
        $clothing = Category::where('name', 'Clothing')->first();

        if (! $phones || ! $furniture || ! $clothing) {
            $this->command?->warn('DemoSeeder: required categories missing — run CategorySeeder first. Skipping.');

            return;
        }

        // --- 10 listings, status active, spread over 3 sellers + 3 categories ---
        $specs = [
            // Phones
            [$sarah, $phones, 'iPhone 14 Pro 256GB - Deep Purple', 'Unlocked, 89% battery health. Includes original box, cable and a clear case. No scratches on the screen.', 849.00, 'like_new', 'Brooklyn, NY', 40.6782, -73.9442],
            [$marcus, $phones, 'Samsung Galaxy S23 Ultra', 'Phantom Black, 512GB. Used for 6 months, always in a case with screen protector. S-Pen included.', 720.00, 'used', 'Austin, TX', 30.2672, -97.7431],
            [$elena, $phones, 'Google Pixel 8 - Sealed', 'Brand new, factory sealed. Won it in a raffle and already have a phone. Hazel, 128GB.', 599.00, 'new', 'San Francisco, CA', 37.7749, -122.4194],
            [$sarah, $phones, 'iPhone SE (2022) 64GB', 'Reliable backup phone, Midnight. Light wear on the frame, screen is flawless. Battery 92%.', 219.00, 'used', 'Brooklyn, NY', 40.6782, -73.9442],

            // Furniture
            [$marcus, $furniture, 'Mid-Century Walnut Sideboard', 'Solid walnut credenza, tapered legs. One owner. Minor ring mark on top, otherwise excellent. Local pickup only.', 480.00, 'used', 'Austin, TX', 30.2672, -97.7431],
            [$elena, $furniture, 'Eames-Style Lounge Chair + Ottoman', 'Replica in cognac leather with rosewood veneer. Very comfortable, barely used. Smoke-free home.', 650.00, 'like_new', 'San Francisco, CA', 37.7749, -122.4194],
            [$sarah, $furniture, 'IKEA MALM 6-Drawer Dresser - White', 'Disassembled and ready to transport. All hardware included. A couple of small marks on the back panel.', 95.00, 'used', 'Brooklyn, NY', 40.6782, -73.9442],

            // Clothing
            [$elena, $clothing, 'Vintage Levi\'s 501 Denim Jacket', 'Authentic 90s trucker jacket, perfectly broken in. Size L. No rips, all buttons intact.', 140.00, 'used', 'San Francisco, CA', 37.7749, -122.4194],
            [$marcus, $clothing, 'Patagonia Nano Puff - New w/ Tags', 'Brand new, never worn. Men\'s medium, Black. Bought wrong size, tags still attached.', 169.00, 'new', 'Austin, TX', 30.2672, -97.7431],
            [$sarah, $clothing, 'Dr. Martens 1460 Boots - Size 9', 'Classic black smooth leather. Worn a handful of times, fully broken in and comfortable.', 110.00, 'like_new', 'Brooklyn, NY', 40.6782, -73.9442],
        ];

        /** @var array<int, Listing> $listings */
        $listings = [];
        foreach ($specs as [$seller, $category, $title, $desc, $price, $condition, $location, $lat, $lng]) {
            $listing = Listing::firstOrCreate(
                ['seller_id' => $seller->id, 'title' => $title],
                [
                    'category_id' => $category->id,
                    'description' => $desc,
                    'price' => $price,
                    'status' => 'active',
                    'condition' => $condition,
                    'location' => $location,
                    'lat' => $lat,
                    'lng' => $lng,
                ],
            );

            $this->seedImages($listing);
            $listings[] = $listing;
        }

        // --- 3 completed orders (one per category), with chat threads ----------
        // [listing, buyer, stripe pi id]
        $orderSpecs = [
            [$listings[0], $bob, 'pi_demo_1'],    // Phones  -> buyer1 (Bob)
            [$listings[4], $alice, 'pi_demo_2'],  // Furniture -> buyer2 (Alice)
            [$listings[7], $bob, 'pi_demo_3'],    // Clothing -> buyer1 (Bob)
        ];

        foreach ($orderSpecs as [$listing, $buyer, $intentId]) {
            $price = (float) $listing->price;
            $platformFee = round($price * 0.10, 2);
            $sellerAmount = round($price - $platformFee, 2);

            $order = Order::firstOrCreate(
                ['stripe_payment_intent_id' => $intentId],
                [
                    'listing_id' => $listing->id,
                    'buyer_id' => $buyer->id,
                    'seller_id' => $listing->seller_id,
                    'amount' => $price,
                    'platform_fee' => $platformFee,
                    'seller_amount' => $sellerAmount,
                    'status' => Order::STATUS_COMPLETED,
                    'tracking_number' => 'TRK' . str_pad((string) $listing->id, 8, '0', STR_PAD_LEFT),
                ],
            );

            // Purchased listing is no longer available.
            if ($listing->status !== 'sold') {
                $listing->update(['status' => 'sold']);
            }

            $this->seedConversation($listing, $buyer);
        }
    }

    /**
     * Create/locate a verified seller and set the guarded fields safely.
     */
    private function makeSeller(string $name, string $email, string $stripeAccountId): User
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => 'password123'], // 'hashed' cast -> plain text
        );

        // role / is_verified / stripe_account_id are guarded -> forceFill only.
        $user->forceFill([
            'role' => 'seller',
            'is_verified' => true,
            'stripe_account_id' => $stripeAccountId,
        ])->save();

        $user->syncRoles(['seller']);

        return $user;
    }

    /**
     * Create/locate a verified buyer and set the guarded fields safely.
     */
    private function makeBuyer(string $name, string $email): User
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => 'password123'],
        );

        $user->forceFill(['role' => 'buyer', 'is_verified' => true])->save();

        $user->syncRoles(['buyer']);

        return $user;
    }

    /**
     * Attach 2-3 placeholder images to a listing — only if it has none yet.
     */
    private function seedImages(Listing $listing): void
    {
        if ($listing->images()->exists()) {
            return;
        }

        $count = 2 + ($listing->id % 2); // 2 or 3 images
        for ($i = 0; $i < $count; $i++) {
            $listing->images()->create([
                'url' => 'https://picsum.photos/seed/' . $listing->id . '-' . $i . '/800/800',
                'is_primary' => $i === 0,
                'order' => $i,
            ]);
        }
    }

    /**
     * Create a conversation for an order (buyer<->seller about the listing) plus
     * a short, realistic text thread — only when the conversation has no messages.
     */
    private function seedConversation(Listing $listing, User $buyer): void
    {
        $conversation = Conversation::firstOrCreate(
            [
                'listing_id' => $listing->id,
                'buyer_id' => $buyer->id,
                'seller_id' => $listing->seller_id,
            ],
        );

        if ($conversation->messages()->exists()) {
            return;
        }

        // Alternating buyer -> seller -> buyer -> seller, all read.
        $script = [
            [$buyer->id, 'Hi! Is this still available?'],
            [$listing->seller_id, 'Yes it is — happy to answer any questions.'],
            [$buyer->id, 'Great, I just paid through the app. Could you ship it this week?'],
            [$listing->seller_id, 'All set, it\'s going out tomorrow. I\'ll add the tracking number once it ships. Thanks!'],
        ];

        $time = Carbon::now()->subDays(3);
        foreach ($script as $index => [$senderId, $content]) {
            $time = $time->copy()->addMinutes(7 * ($index + 1));

            // created_at/updated_at are NOT fillable on Message, so passing them
            // through create()/fill() would be silently dropped (Eloquent would
            // then stamp "now"). Set them explicitly with forceFill so the demo
            // chat history is genuinely back-dated and stays consistent with the
            // conversation's last_message_at below.
            $message = $conversation->messages()->create([
                'sender_id' => $senderId,
                'content' => $content,
                'type' => 'text',
                'is_read' => true,
            ]);

            $message->forceFill(['created_at' => $time, 'updated_at' => $time])->save();
        }

        // last_message_at tracks the final message time.
        $conversation->forceFill(['last_message_at' => $time])->save();
    }
}
