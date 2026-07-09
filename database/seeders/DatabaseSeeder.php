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



        // Call the image polisher seeder at the end to catch all products
        $this->call([
            ProductImagePolishSeeder::class,
        ]);
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
