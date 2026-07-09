<?php

namespace App\Filament\Buyer\Resources;

use App\Filament\Buyer\Resources\OrderResource\Pages;
use App\Models\Order;
use App\Services\StripeService;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?string $navigationIcon = 'heroicon-o-shopping-cart';

    protected static ?string $navigationGroup = 'My Account';

    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Order Information')
                    ->schema([
                        Forms\Components\Select::make('listing_id')
                            ->relationship('listing', 'title')
                            ->disabled(),
                        Forms\Components\Select::make('seller_id')
                            ->relationship('seller', 'name')
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
                    ])
                    ->columns(1),

                Forms\Components\Section::make('Shipping & Fulfillment')
                    ->schema([
                        Forms\Components\TextInput::make('tracking_number')
                            ->label('Tracking Number')
                            ->placeholder('No tracking number provided yet')
                            ->disabled(),
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
                Tables\Columns\TextColumn::make('seller.name')
                    ->label('Seller')
                    ->searchable(),
                Tables\Columns\TextColumn::make('amount')
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
                    ->placeholder('Awaiting shipment')
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
                Tables\Actions\Action::make('complete')
                    ->label('Confirm Delivery')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Confirm Delivery')
                    ->modalDescription('Are you sure you have received the item? This will capture the held payment and release the funds to the seller.')
                    ->action(function (Order $record, StripeService $stripe): void {
                        if (!in_array($record->status, [Order::STATUS_SHIPPED, Order::STATUS_PAID], true)) {
                            return;
                        }

                        try {
                            $stripe->capturePaymentIntent($record->stripe_payment_intent_id);
                            $record->update(['status' => Order::STATUS_COMPLETED]);

                            \Filament\Notifications\Notification::make()
                                ->title('Delivery Confirmed')
                                ->body('Order has been marked as completed. Funds released to seller.')
                                ->success()
                                ->send();
                        } catch (\Exception $e) {
                            \Filament\Notifications\Notification::make()
                                ->title('Action Failed')
                                ->body($e->getMessage())
                                ->danger()
                                ->send();
                        }
                    })
                    ->visible(fn (Order $record): bool => in_array($record->status, [Order::STATUS_SHIPPED, Order::STATUS_PAID])),
            ])
            ->bulkActions([]);
    }

    public static function getEloquentQuery(): Builder
    {
        // Enforce that buyers only see their own orders
        return parent::getEloquentQuery()->where('buyer_id', auth()->id());
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
