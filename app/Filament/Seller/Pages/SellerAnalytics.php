<?php

namespace App\Filament\Seller\Pages;

use App\Models\Order;
use Filament\Pages\Page;

class SellerAnalytics extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-presentation-chart-bar';

    protected static string $view = 'filament.seller.pages.seller-analytics';

    protected static ?string $navigationGroup = 'Store Management';

    protected static ?int $navigationSort = 4;

    public array $monthlySales = [];
    public array $topListings = [];

    public function mount(): void
    {
        $sellerId = auth()->id();

        // 1. Fetch monthly sales and earnings
        $sales = Order::selectRaw("TO_CHAR(created_at, 'FMMonth') as month, SUM(amount) as total_sales, SUM(seller_amount) as total_earnings")
            ->where('seller_id', $sellerId)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_SHIPPED, Order::STATUS_COMPLETED])
            ->groupByRaw("TO_CHAR(created_at, 'FMMonth'), DATE_TRUNC('month', created_at)")
            ->orderByRaw("DATE_TRUNC('month', created_at)")
            ->limit(6)
            ->get();

        foreach ($sales as $sale) {
            $this->monthlySales[] = [
                'month' => $sale->month,
                'sales' => (float) $sale->total_sales,
                'earnings' => (float) $sale->total_earnings,
            ];
        }

        // 2. Fetch top selling listings
        $this->topListings = Order::selectRaw('listing_id, COUNT(*) as count, SUM(amount) as revenue')
            ->where('seller_id', $sellerId)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_SHIPPED, Order::STATUS_COMPLETED])
            ->groupBy('listing_id')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                return [
                    'title' => $row->listing ? $row->listing->title : 'Deleted Listing',
                    'sales_count' => $row->count,
                    'revenue' => (float) $row->revenue,
                ];
            })
            ->toArray();
    }
}
