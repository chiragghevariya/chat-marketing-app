<?php

namespace App\Filament\Seller\Resources\ListingResource\Pages;

use App\Filament\Seller\Resources\ListingResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Storage;

class EditListing extends EditRecord
{
    protected static string $resource = ListingResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeFill(array $data): array
    {
        $listing = $this->record;
        $disk = config('filesystems.uploads', 's3');

        // Map existing listing image URLs back to relative paths for the file upload field
        $data['uploaded_images'] = $listing->images->map(function ($image) use ($disk) {
            $url = $image->url;
            $base = rtrim(Storage::disk($disk)->url(''), '/');

            if ($base !== '' && str_starts_with($url, $base)) {
                return ltrim(substr($url, strlen($base)), '/');
            }

            $path = parse_url($url, PHP_URL_PATH);
            return $path !== false && $path !== null ? ltrim($path, '/') : $url;
        })->toArray();

        return $data;
    }

    protected function afterSave(): void
    {
        $listing = $this->record;
        $images = $this->data['uploaded_images'] ?? [];
        $disk = config('filesystems.uploads', 's3');

        // Delete old listings images records and recreate the collection
        $listing->images()->delete();

        foreach ($images as $index => $path) {
            if (filter_var($path, FILTER_VALIDATE_URL)) {
                $url = $path;
            } else {
                $url = Storage::disk($disk)->url($path);
            }

            $listing->images()->create([
                'url' => $url,
                'is_primary' => $index === 0,
                'order' => $index,
            ]);
        }
    }
}
