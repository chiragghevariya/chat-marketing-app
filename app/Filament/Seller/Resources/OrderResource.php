<?php

namespace App\Filament\Seller\Resources;

use App\Filament\Seller\Resources\OrderResource\Pages;
use App\Models\Order;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static ?string $navigationGroup = 'Store Management';

    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Order Information')
                    ->schema([
                        Forms\Components\Select::make('listing_id')
                            ->relationship('listing', 'title')
                            ->disabled(),
                        Forms\Components\Select::make('buyer_id')
                            ->relationship('buyer', 'name')
                            ->disabled(),
                        Forms\Components\TextInput::make('status')
                            ->disabled(),
                    ])
                    ->columns(2),

                Forms\Components\Section::make('Financial Details')
                    ->schema([
                        Forms\Components\TextInput::make('amount')
                            ->prefix('$')
                            ->disabled(),
                        Forms\Components\TextInput::make('platform_fee')
                            ->prefix('$')
                            ->disabled(),
                        Forms\Components\TextInput::make('seller_amount')
                            ->prefix('$')
                            ->disabled(),
                    ])
                    ->columns(3),

                Forms\Components\Section::make('Fulfillment')
                    ->schema([
                        Forms\Components\TextInput::make('tracking_number')
                            ->label('Tracking Number')
                            ->placeholder('No tracking number provided')
                            ->maxLength(255)
                            ->disabled(fn (?Order $record): bool => $record === null || !in_array($record->status, [Order::STATUS_PAID, Order::STATUS_SHIPPED])),
                    ])
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('Order ID')
                    ->sortable(),
                Tables\Columns\TextColumn::make('listing.title')
                    ->label('Product')
                    ->searchable(),
                Tables\Columns\TextColumn::make('buyer.name')
                    ->label('Buyer')
                    ->searchable(),
                Tables\Columns\TextColumn::make('amount')
                    ->money('USD')
                    ->sortable(),
                Tables\Columns\TextColumn::make('platform_fee')
                    ->money('USD')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('seller_amount')
                    ->money('USD')
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->colors([
                        'danger' => Order::STATUS_PENDING_PAYMENT,
                        'success' => [Order::STATUS_PAID, Order::STATUS_COMPLETED],
                        'warning' => Order::STATUS_SHIPPED,
                        'gray' => Order::STATUS_REFUNDED,
                    ]),
                Tables\Columns\TextColumn::make('tracking_number')
                    ->label('Tracking #')
                    ->placeholder('N/A')
                    ->searchable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->label('Order Date')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        Order::STATUS_PENDING_PAYMENT => 'Pending Payment',
                        Order::STATUS_PAID => 'Paid',
                        Order::STATUS_SHIPPED => 'Shipped',
                        Order::STATUS_COMPLETED => 'Completed',
                        Order::STATUS_REFUNDED => 'Refunded',
                    ]),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make()
                    ->label('Update Tracking')
                    ->modalHeading('Update Tracking Number')
                    ->visible(fn (Order $record): bool => in_array($record->status, [Order::STATUS_PAID, Order::STATUS_SHIPPED])),
                Tables\Actions\Action::make('ship')
                    ->label('Mark as Shipped')
                    ->icon('heroicon-o-truck')
                    ->color('warning')
                    ->form([
                        Forms\Components\TextInput::make('tracking_number')
                            ->label('Tracking Number')
                            ->required()
                            ->maxLength(255),
                    ])
                    ->action(function (Order $record, array $data): void {
                        if ($record->status !== Order::STATUS_PAID) {
                            return;
                        }

                        $record->update([
                            'tracking_number' => $data['tracking_number'],
                            'status' => Order::STATUS_SHIPPED,
                        ]);

                        \Filament\Notifications\Notification::make()
                            ->title('Order Shipped')
                            ->body('Order has been marked as shipped.')
                            ->success()
                            ->send();
                    })
                    ->visible(fn (Order $record): bool => $record->status === Order::STATUS_PAID),
            ])
            ->bulkActions([]);
    }

    public static function getEloquentQuery(): Builder
    {
        // Enforce that sellers only see orders for their own listings
        return parent::getEloquentQuery()->where('seller_id', auth()->id());
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListOrders::route('/'),
        ];
    }
}
