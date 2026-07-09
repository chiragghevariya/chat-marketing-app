<?php

namespace Database\Seeders;

use App\Models\Listing;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class ProductImagePolishSeeder extends Seeder
{
    public function run(): void
    {
        // Mapping of product titles to folder slugs and curated Unsplash URLs
        $mappings = [
            'iPhone 14 Pro 256GB - Deep Purple' => [
                'iphone-14-pro',
                [
                    'https://images.unsplash.com/photo-1678652197831-2d180705cd2c?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'Samsung Galaxy S23 Ultra' => [
                'galaxy-s23',
                [
                    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'Google Pixel 8 - Sealed' => [
                'pixel-8',
                [
                    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'iPhone SE (2022) 64GB' => [
                'iphone-se',
                [
                    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1565630916779-e303be97b6f5?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'Mid-Century Walnut Sideboard' => [
                'walnut-sideboard',
                [
                    'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'Eames-Style Lounge Chair + Ottoman' => [
                'eames-chair',
                [
                    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'IKEA MALM 6-Drawer Dresser - White' => [
                'malm-dresser',
                [
                    'https://images.unsplash.com/photo-1601760562234-9814eea6663a?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            "Vintage Levi's 501 Denim Jacket" => [
                'levis-jacket',
                [
                    'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'Patagonia Nano Puff - New w/ Tags' => [
                'patagonia-jacket',
                [
                    'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],
            'Dr. Martens 1460 Boots - Size 9' => [
                'doc-martens',
                [
                    'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=800&h=800&q=80',
                    'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=800&h=800&q=80',
                ]
            ],

        ];

        foreach ($mappings as $title => [$slug, $urls]) {
            $listing = Listing::where('title', $title)->first();

            if (!$listing) {
                $this->command?->warn("Listing not found: {$title}");
                continue;
            }

            // Create target folder locally
            Storage::disk('public')->makeDirectory("demo-products/{$slug}");

            // Clear old images
            $listing->images()->delete();

            // Download and save each image
            foreach ($urls as $index => $url) {
                $filename = "{$index}.jpg";
                $path = "demo-products/{$slug}/{$filename}";

                try {
                    $response = Http::withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    ])->get($url);

                    if ($response->successful()) {
                        Storage::disk('public')->put($path, $response->body());

                        // Generate the public asset URL
                        $publicUrl = url("storage/{$path}");

                        // Save image record to database
                        $listing->images()->create([
                            'url' => $publicUrl,
                            'is_primary' => $index === 0,
                            'order' => $index,
                        ]);
                    } else {
                        $this->command?->error("Failed to download image for {$title} from {$url} (Status: {$response->status()})");
                    }
                } catch (\Exception $e) {
                    $this->command?->error("Exception downloading {$url} for {$title}: " . $e->getMessage());
                }
            }

            $this->command?->info("Successfully updated images for: {$title}");
        }
    }
}
