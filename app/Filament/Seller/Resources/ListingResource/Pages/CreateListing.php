<?php

namespace App\Filament\Seller\Resources\ListingResource\Pages;

use App\Filament\Seller\Resources\ListingResource;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Storage;

class CreateListing extends CreateRecord
{
    protected static string $resource = ListingResource::class;

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        // Automatically assign the listing to the authenticated seller
        $data['seller_id'] = auth()->id();
        return $data;
    }

    protected function afterCreate(): void
    {
        $listing = $this->record;
        $images = $this->data['uploaded_images'] ?? [];
        $disk = config('filesystems.uploads', 's3');

        foreach ($images as $index => $path) {
            $url = Storage::disk($disk)->url($path);

            $listing->images()->create([
                'url' => $url,
                'is_primary' => $index === 0,
                'order' => $index,
            ]);
        }
    }
}
