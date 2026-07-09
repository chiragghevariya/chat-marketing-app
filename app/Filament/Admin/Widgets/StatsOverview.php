<?php

namespace App\Filament\Admin\Widgets;

use App\Models\User;
use App\Models\Listing;
use App\Models\Order;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $revenue = Order::whereIn('status', ['paid', 'shipped', 'completed'])->sum('amount');
        $earnings = Order::whereIn('status', ['paid', 'shipped', 'completed'])->sum('platform_fee');

        return [
            Stat::make('Total Users', User::count())
                ->description('Total registered accounts')
                ->descriptionIcon('heroicon-m-users')
                ->color('primary'),

            Stat::make('Total Sellers', User::role('seller')->count())
                ->description('Accounts with seller role')
                ->descriptionIcon('heroicon-m-user-group')
                ->color('info'),

            Stat::make('Total Buyers', User::role('buyer')->count())
                ->description('Accounts with buyer role')
                ->descriptionIcon('heroicon-m-user')
                ->color('success'),

            Stat::make('Active Listings', Listing::where('status', 'active')->count())
                ->description('Active items on marketplace')
                ->descriptionIcon('heroicon-m-shopping-bag')
                ->color('success'),

            Stat::make('Sold Listings', Listing::where('status', 'sold')->count())
                ->description('Items sold successfully')
                ->descriptionIcon('heroicon-m-check-badge')
                ->color('gray'),

            Stat::make('Total Orders', Order::count())
                ->description('Total order transactions')
                ->descriptionIcon('heroicon-m-shopping-cart')
                ->color('primary'),

            Stat::make('Total Revenue', '$' . number_format($revenue, 2))
                ->description('Gross transaction volume')
                ->descriptionIcon('heroicon-m-presentation-chart-line')
                ->color('success'),

            Stat::make('Platform Earnings', '$' . number_format($earnings, 2))
                ->description('Marketplace fee earnings')
                ->descriptionIcon('heroicon-m-currency-dollar')
                ->color('success'),

            Stat::make('Pending Orders', Order::where('status', 'pending_payment')->count())
                ->description('Awaiting buyer payment')
                ->descriptionIcon('heroicon-m-clock')
                ->color('warning'),

            Stat::make('Completed Orders', Order::where('status', 'completed')->count())
                ->description('Delivered and completed')
                ->descriptionIcon('heroicon-m-check')
                ->color('success'),
        ];
    }
}
