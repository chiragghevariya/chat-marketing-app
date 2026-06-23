<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

/**
 * Seeds a small, realistic set of top-level categories, each with a few children.
 */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        // [parent name, icon, [child names...]]
        $tree = [
            ['Electronics', '📱', ['Phones', 'Laptops', 'Cameras', 'Audio']],
            ['Vehicles', '🚗', ['Cars', 'Motorcycles', 'Bicycles']],
            ['Home & Garden', '🛋️', ['Furniture', 'Appliances', 'Tools']],
            ['Fashion', '👕', ['Clothing', 'Shoes', 'Accessories']],
            ['Hobbies', '🎮', ['Games', 'Books', 'Sports']],
        ];

        foreach ($tree as [$name, $icon, $children]) {
            $parent = Category::firstOrCreate(
                ['name' => $name, 'parent_id' => null],
                ['icon' => $icon],
            );

            foreach ($children as $childName) {
                Category::firstOrCreate([
                    'name' => $childName,
                    'parent_id' => $parent->id,
                ]);
            }
        }
    }
}
