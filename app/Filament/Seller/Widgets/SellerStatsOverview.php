<?php

namespace App\Filament\Seller\Widgets;

use App\Models\Listing;
use App\Models\Order;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class SellerStatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $sellerId = auth()->id();

        $totalSales = Order::where('seller_id', $sellerId)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_SHIPPED, Order::STATUS_COMPLETED])
            ->sum('amount');

        $totalEarnings = Order::where('seller_id', $sellerId)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_SHIPPED, Order::STATUS_COMPLETED])
            ->sum('seller_amount');

        $pendingEarnings = Order::where('seller_id', $sellerId)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_SHIPPED])
            ->sum('seller_amount');

        return [
            Stat::make('Total Listings', Listing::where('seller_id', $sellerId)->count())
                ->description('Total items created')
                ->descriptionIcon('heroicon-m-shopping-bag')
                ->color('primary'),

            Stat::make('Active Listings', Listing::where('seller_id', $sellerId)->where('status', 'active')->count())
                ->description('Currently visible on marketplace')
                ->descriptionIcon('heroicon-m-check-circle')
                ->color('success'),

            Stat::make('Sold Listings', Listing::where('seller_id', $sellerId)->where('status', 'sold')->count())
                ->description('Items sold successfully')
                ->descriptionIcon('heroicon-m-check-badge')
                ->color('gray'),

            Stat::make('Pending Orders', Order::where('seller_id', $sellerId)->where('status', Order::STATUS_PENDING_PAYMENT)->count())
                ->description('Awaiting buyer payment')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning'),

            Stat::make('Shipped Orders', Order::where('seller_id', $sellerId)->where('status', Order::STATUS_SHIPPED)->count())
                ->description('Orders currently in transit')
                ->descriptionIcon('heroicon-m-truck')
                ->color('info'),

            Stat::make('Completed Orders', Order::where('seller_id', $sellerId)->where('status', Order::STATUS_COMPLETED)->count())
                ->description('Delivered and payout released')
                ->descriptionIcon('heroicon-m-hand-thumb-up')
                ->color('success'),

            Stat::make('Total Sales Volume', '$' . number_format($totalSales, 2))
                ->description('Gross marketplace revenue')
                ->descriptionIcon('heroicon-m-presentation-chart-line')
                ->color('success'),

            Stat::make('Total Earnings', '$' . number_format($totalEarnings, 2))
                ->description('Revenue after platform fees')
                ->descriptionIcon('heroicon-m-currency-dollar')
                ->color('success'),

            Stat::make('Pending Earnings', '$' . number_format($pendingEarnings, 2))
                ->description('Holding in escrow')
                ->descriptionIcon('heroicon-m-arrow-path')
                ->color('warning'),
        ];
    }
}
