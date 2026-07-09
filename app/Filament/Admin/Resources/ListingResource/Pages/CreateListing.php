<?php

namespace App\Filament\Admin\Resources\ListingResource\Pages;

use App\Filament\Admin\Resources\ListingResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;

class CreateListing extends CreateRecord
{
    protected static string $resource = ListingResource::class;
}
