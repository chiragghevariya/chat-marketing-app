<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Creates the three marketplace roles used by spatie/laravel-permission.
 *
 * The roles are created for the "api" guard because all of our protected routes
 * authenticate through the JWT "api" guard (see config/auth.php).
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // Clear spatie's permission cache so newly created roles are picked up.
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['buyer', 'seller', 'admin'] as $role) {
            // firstOrCreate => safe to run repeatedly without creating duplicates.
            Role::firstOrCreate([
                'name' => $role,
                'guard_name' => 'api',
            ]);
        }
    }
}
