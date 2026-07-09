<x-filament-panels::page>
    <div class="space-y-6">
        <div class="p-6 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
            <div class="flex items-center space-x-4">
                <div class="p-3 bg-primary-50 text-primary-500 rounded-full dark:bg-primary-950/30 dark:text-primary-400">
                    <x-heroicon-o-credit-card class="w-8 h-8" />
                </div>
                <div>
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Stripe Express Account Connection</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        Connect your account with Stripe to receive payouts directly to your bank account when items sell.
                    </p>
                </div>
            </div>

            <div class="mt-6 border-t border-gray-100 pt-6 dark:border-gray-800 space-y-4">
                <div class="flex justify-between items-center text-sm">
                    <span class="font-medium text-gray-500 dark:text-gray-400">Connection Status:</span>
                    @if ($isConnected)
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Connected
                        </span>
                    @else
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Not Connected
                        </span>
                    @endif
                </div>

                @if ($accountId)
                    <div class="flex justify-between items-center text-sm">
                        <span class="font-medium text-gray-500 dark:text-gray-400">Connected Account ID:</span>
                        <code class="px-2 py-1 bg-gray-50 rounded text-xs font-mono dark:bg-gray-950 dark:text-gray-300">
                            {{ $accountId }}
                        </code>
                    </div>
                @endif

                <div class="flex justify-between items-center text-sm">
                    <span class="font-medium text-gray-500 dark:text-gray-400">Verification Status (Can accept payouts):</span>
                    @if ($detailsSubmitted && $chargesEnabled)
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Verified / Active
                        </span>
                    @else
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Pending Verification
                        </span>
                    @endif
                </div>
            </div>

            <div class="mt-8 flex flex-col sm:flex-row gap-4">
                @if (!$isConnected)
                    <button 
                        wire:click="connect" 
                        wire:loading.attr="disabled"
                        class="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-lg text-sm shadow-sm transition duration-150 flex items-center justify-center space-x-2"
                    >
                        <span wire:loading.remove>Connect with Stripe</span>
                        <span wire:loading class="inline-flex items-center">
                            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Connecting...
                        </span>
                    </button>
                @else
                    <button 
                        wire:click="connect" 
                        wire:loading.attr="disabled"
                        class="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-lg text-sm shadow-sm transition duration-150 flex items-center justify-center space-x-2"
                    >
                        <span wire:loading.remove>Stripe Dashboard</span>
                        <span wire:loading class="inline-flex items-center">
                            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Redirecting...
                        </span>
                    </button>
                @endif
            </div>
        </div>
    </div>
</x-filament-panels::page>
