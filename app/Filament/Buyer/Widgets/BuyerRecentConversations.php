<?php

namespace App\Filament\Buyer\Widgets;

use App\Models\Conversation;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

class BuyerRecentConversations extends BaseWidget
{
    protected static ?int $sort = 3;

    protected int | string | array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                Conversation::query()->where('buyer_id', auth()->id())->latest('last_message_at')->limit(5)
            )
            ->columns([
                Tables\Columns\TextColumn::make('seller.name')
                    ->label('Seller'),
                Tables\Columns\TextColumn::make('listing.title')
                    ->label('Listing Product'),
                Tables\Columns\TextColumn::make('latestMessage.content')
                    ->label('Last Message')
                    ->placeholder('No messages yet')
                    ->limit(50),
                Tables\Columns\TextColumn::make('last_message_at')
                    ->dateTime()
                    ->label('Last Activity'),
            ])
            ->paginated(false);
    }
}
