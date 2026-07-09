<?php

namespace App\Filament\Admin\Widgets;

use App\Models\Listing;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

class RecentListings extends BaseWidget
{
    protected static ?int $sort = 3;

    protected int | string | array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Listing::query()->latest()->limit(5)
            )
            ->columns([
                Tables\Columns\ImageColumn::make('primaryImage.url')
                    ->label('Image')
                    ->circular(),
                Tables\Columns\TextColumn::make('title')
                    ->label('Title'),
                Tables\Columns\TextColumn::make('category.name')
                    ->label('Category'),
                Tables\Columns\TextColumn::make('seller.name')
                    ->label('Seller'),
                Tables\Columns\TextColumn::make('price')
                    ->money('USD')
                    ->label('Price'),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->colors([
                        'success' => 'active',
                        'warning' => 'pending_payment',
                        'danger' => 'inactive',
                        'gray' => 'sold',
                    ]),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->label('Created At'),
            ])
            ->paginated(false);
    }
}
