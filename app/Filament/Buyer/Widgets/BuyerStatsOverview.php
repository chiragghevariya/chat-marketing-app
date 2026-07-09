<?php

namespace App\Filament\Buyer\Widgets;

use App\Models\Order;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class BuyerStatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $buyerId = auth()->id();

        $totalSpending = Order::where('buyer_id', $buyerId)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_SHIPPED, Order::STATUS_COMPLETED])
            ->sum('amount');

        return [
            Stat::make('Total Purchases', Order::where('buyer_id', $buyerId)->count())
                ->description('Total orders placed')
                ->descriptionIcon('heroicon-m-shopping-cart')
                ->color('primary'),

            Stat::make('Pending Payment', Order::where('buyer_id', $buyerId)->where('status', Order::STATUS_PENDING_PAYMENT)->count())
                ->description('Awaiting checkout payment')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning'),

            Stat::make('Paid Orders', Order::where('buyer_id', $buyerId)->where('status', Order::STATUS_PAID)->count())
                ->description('Paid / Ready to ship')
                ->descriptionIcon('heroicon-m-credit-card')
                ->color('success'),

            Stat::make('Shipped Orders', Order::where('buyer_id', $buyerId)->where('status', Order::STATUS_SHIPPED)->count())
                ->description('Orders in transit')
                ->descriptionIcon('heroicon-m-truck')
                ->color('info'),

            Stat::make('Completed Orders', Order::where('buyer_id', $buyerId)->where('status', Order::STATUS_COMPLETED)->count())
                ->description('Delivered and confirmed')
                ->descriptionIcon('heroicon-m-check-badge')
                ->color('success'),

            Stat::make('Total Spending', '$' . number_format($totalSpending, 2))
                ->description('Total value of successful purchases')
                ->descriptionIcon('heroicon-m-currency-dollar')
                ->color('success'),
        ];
    }
}
