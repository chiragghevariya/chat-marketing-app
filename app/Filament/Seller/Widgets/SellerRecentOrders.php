<?php

namespace App\Filament\Seller\Widgets;

use App\Models\Order;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

class SellerRecentOrders extends BaseWidget
{
    protected static ?int $sort = 3;

    protected int | string | array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Order::query()->where('seller_id', auth()->id())->latest()->limit(5)
            )
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('Order ID'),
                Tables\Columns\TextColumn::make('listing.title')
                    ->label('Product'),
                Tables\Columns\TextColumn::make('buyer.name')
                    ->label('Buyer'),
                Tables\Columns\TextColumn::make('seller_amount')
                    ->money('USD')
                    ->label('My Earnings'),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->colors([
                        'danger' => Order::STATUS_PENDING_PAYMENT,
                        'success' => [Order::STATUS_PAID, Order::STATUS_COMPLETED],
                        'warning' => Order::STATUS_SHIPPED,
                        'gray' => Order::STATUS_REFUNDED,
                    ]),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->label('Ordered At'),
            ])
            ->paginated(false);
    }
}
