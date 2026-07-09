<?php

namespace App\Filament\Buyer\Resources\OrderResource\Pages;

use App\Filament\Buyer\Resources\OrderResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;

class CreateOrder extends CreateRecord
{
    protected static string $resource = OrderResource::class;
}
