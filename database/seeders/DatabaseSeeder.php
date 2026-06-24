<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with roles, categories, a few demo users
     * and some sample listings so the API has data to return immediately.
     */
    public function run(): void
    {
        // Order matters: roles + categories must exist before users/listings.
        $this->call([
            RoleSeeder::class,
            CategorySeeder::class,
            // Phase 5: demo sellers/buyers, listings, completed orders & chat
            // threads for the marketplace showcase.
            DemoSeeder::class,
        ]);

        // --- Demo accounts (all use the password "password") -------------------
        $admin = $this->makeUser('Admin User', 'admin@example.com', 'admin');
        $seller = $this->makeUser('Sally Seller', 'seller@example.com', 'seller');
        $this->makeUser('Bob Buyer', 'buyer@example.com', 'buyer');

        // --- Sample listings for the demo seller -------------------------------
        $phones = Category::where('name', 'Phones')->first();
        $laptops = Category::where('name', 'Laptops')->first();

        if ($phones && $laptops) {
            Listing::create([
                'seller_id' => $seller->id,
                'category_id' => $phones->id,
                'title' => 'iPhone 14 Pro - Like New',
                'description' => 'Barely used, comes with original box and charger.',
                'price' => 799.00,
                'status' => 'active',
                'condition' => 'like_new',
                'location' => 'Brooklyn, NY',
                'lat' => 40.6782,
                'lng' => -73.9442,
            ]);

            Listing::create([
                'seller_id' => $seller->id,
                'category_id' => $laptops->id,
                'title' => 'MacBook Air M2 13"',
                'description' => '8GB RAM, 256GB SSD. Excellent condition.',
                'price' => 949.50,
                'status' => 'active',
                'condition' => 'used',
                'location' => 'Manhattan, NY',
                'lat' => 40.7831,
                'lng' => -73.9712,
            ]);
        }
    }

    /**
     * Create a verified user and assign the given spatie role.
     */
    private function makeUser(string $name, string $email, string $role): User
    {
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => 'password',   // hashed automatically by the model cast
            ],
        );

        // role/is_verified are guarded from mass assignment, so set them with
        // forceFill (trusted seeder context).
        $user->forceFill(['role' => $role, 'is_verified' => true])->save();

        $user->syncRoles([$role]);

        return $user;
    }
}
