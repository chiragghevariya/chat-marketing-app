<?php

namespace App\Filament\Buyer\Pages;

use App\Models\Conversation;
use App\Models\Message;
use App\Events\MessageSent;
use Filament\Pages\Page;

class Chat extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-chat-bubble-left-right';

    protected static string $view = 'filament.buyer.pages.chat';

    protected static ?string $navigationGroup = 'Communication';

    protected static ?int $navigationSort = 2;

    public $conversations = [];
    public ?int $activeConversationId = null;
    public $messages = [];
    public string $newMessageText = '';

    public function mount(): void
    {
        $this->loadConversations();
    }

    public function loadConversations(): void
    {
        $this->conversations = Conversation::where('buyer_id', auth()->id())
            ->with(['seller', 'listing', 'latestMessage'])
            ->orderByDesc('last_message_at')
            ->get();
    }

    public function selectConversation(int $id): void
    {
        $conversation = Conversation::where('buyer_id', auth()->id())->findOrFail($id);
        $this->activeConversationId = $conversation->id;
        $this->loadMessages();

        // Mark messages as read
        $conversation->messages()
            ->where('sender_id', '!=', auth()->id())
            ->where('is_read', false)
            ->update(['is_read' => true]);
    }

    public function loadMessages(): void
    {
        if (!$this->activeConversationId) {
            return;
        }

        $conversation = Conversation::where('buyer_id', auth()->id())->findOrFail($this->activeConversationId);
        $this->messages = $conversation->messages()
            ->with('sender')
            ->oldest()
            ->get();
    }

    public function sendMessage(): void
    {
        if (blank($this->newMessageText) || !$this->activeConversationId) {
            return;
        }

        $conversation = Conversation::where('buyer_id', auth()->id())->findOrFail($this->activeConversationId);

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => auth()->id(),
            'content' => trim($this->newMessageText),
            'type' => 'text',
        ]);

        $conversation->update(['last_message_at' => now()]);

        // Broadcast to Pusher
        event(new MessageSent($message));

        $this->newMessageText = '';
        $this->loadMessages();
        $this->loadConversations();
    }
}
