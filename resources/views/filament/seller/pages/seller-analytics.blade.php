<x-filament-panels::page>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Monthly Performance Card -->
        <div class="p-6 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700 space-y-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <x-heroicon-o-presentation-chart-line class="w-5 h-5 text-blue-500" />
                <span>Monthly Revenue Overview</span>
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
                Monthly breakdown of gross sales and net earnings (after platform fees).
            </p>

            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-300">
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                            <th class="px-4 py-3">Month</th>
                            <th class="px-4 py-3 text-right">Gross Sales</th>
                            <th class="px-4 py-3 text-right">Net Earnings</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                        @forelse ($monthlySales as $row)
                            <tr>
                                <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                    {{ $row['month'] }}
                                </td>
                                <td class="px-4 py-3 text-right text-green-600 dark:text-green-400 font-semibold">
                                    ${{ number_format($row['sales'], 2) }}
                                </td>
                                <td class="px-4 py-3 text-right text-blue-600 dark:text-blue-400 font-semibold">
                                    ${{ number_format($row['earnings'], 2) }}
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="3" class="px-4 py-3 text-center text-gray-400 dark:text-gray-500">
                                    No sales history available.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Top Selling Listings Card -->
        <div class="p-6 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700 space-y-4">
            <h3 class="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <x-heroicon-o-fire class="w-5 h-5 text-orange-500" />
                <span>Top Selling Products</span>
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
                Your highest performing product listings sorted by sales volume.
            </p>

            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-300">
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                            <th class="px-4 py-3">Product Name</th>
                            <th class="px-4 py-3 text-center">Items Sold</th>
                            <th class="px-4 py-3 text-right">Revenue</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                        @forelse ($topListings as $row)
                            <tr>
                                <td class="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                                    {{ $row['title'] }}
                                </td>
                                <td class="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                                    {{ $row['sales_count'] }}
                                </td>
                                <td class="px-4 py-3 text-right text-green-600 dark:text-green-400 font-semibold">
                                    ${{ number_format($row['revenue'], 2) }}
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="3" class="px-4 py-3 text-center text-gray-400 dark:text-gray-500">
                                    No listings have been sold yet.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-filament-panels::page>
