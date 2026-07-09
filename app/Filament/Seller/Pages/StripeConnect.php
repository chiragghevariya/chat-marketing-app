<?php

namespace App\Filament\Seller\Pages;

use App\Services\StripeService;
use Filament\Pages\Page;
use Filament\Notifications\Notification;
use Stripe\Exception\ApiErrorException;

class StripeConnect extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static string $view = 'filament.seller.pages.stripe-connect';

    protected static ?string $navigationGroup = 'Store Management';

    protected static ?int $navigationSort = 3;

    public bool $isConnected = false;
    public ?string $accountId = null;
    public bool $detailsSubmitted = false;
    public bool $chargesEnabled = false;

    public function mount(StripeService $stripe): void
    {
        $seller = auth()->user();
        $this->accountId = $seller->stripe_account_id;

        if (filled($this->accountId)) {
            try {
                $account = $stripe->retrieveAccount($this->accountId);
                $this->detailsSubmitted = (bool) $account->details_submitted;
                $this->chargesEnabled = (bool) $account->charges_enabled;
                $this->isConnected = true;

                // Sync status back to database if onboarding completed
                $completed = $this->detailsSubmitted && $this->chargesEnabled;
                if ($completed && !$seller->is_verified) {
                    $seller->forceFill(['is_verified' => true])->save();
                }
            } catch (\Exception $e) {
                // Handle or ignore retrieve errors (e.g. invalid accounts in testing)
                $this->isConnected = false;
            }
        }
    }

    public function connect(StripeService $stripe)
    {
        $seller = auth()->user();
        $accountId = $seller->stripe_account_id;

        try {
            if (blank($accountId)) {
                $account = $stripe->createExpressAccount($seller);
                $accountId = $account->id;
                $seller->forceFill(['stripe_account_id' => $accountId])->save();
            }

            // Determine if onboarding is fully complete
            $isComplete = false;
            try {
                $account = $stripe->retrieveAccount($accountId);
                $isComplete = (bool) ($account->details_submitted && $account->charges_enabled);
            } catch (\Exception $e) {
                // Ignore retrieval errors for offline/sandbox mode
            }

            // Dynamically resolve base URL to preserve the current session cookie
            $base = request()->getSchemeAndHttpHost();

            if ($isComplete) {
                // Generate and redirect to a Stripe Express Dashboard login link
                $loginUrl = $stripe->createLoginLink($accountId);
                return redirect()->away($loginUrl);
            }

            // Generate Stripe Link and redirect back here to finish onboarding
            $onboardingUrl = $stripe->createOnboardingLink(
                $accountId,
                $base . '/seller/stripe-connect',
                $base . '/seller/stripe-connect'
            );

            return redirect()->away($onboardingUrl);
        } catch (\Exception $e) {
            Notification::make()
                ->title('Stripe Connection Failed')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
    }
}
