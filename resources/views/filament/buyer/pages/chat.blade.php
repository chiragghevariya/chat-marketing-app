<x-filament-panels::page>
    <style>
        .chat-sidebar-item {
            transition: all 0.15s ease-in-out;
            border-left: 4px solid transparent;
        }
        /* Light mode hover */
        .chat-sidebar-item:hover {
            background-color: rgba(0, 0, 0, 0.03) !important;
        }
        /* Light mode active */
        .chat-sidebar-item.active {
            background-color: rgba(0, 0, 0, 0.05) !important;
            border-left-color: rgb(var(--primary-600, 59, 130, 246)) !important;
        }
        /* Dark mode hover */
        .dark .chat-sidebar-item:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
        }
        /* Dark mode active */
        .dark .chat-sidebar-item.active {
            background-color: rgba(255, 255, 255, 0.08) !important;
            border-left-color: rgb(var(--primary-500, 59, 130, 246)) !important;
        }
    </style>

    <div class="grid grid-cols-12 gap-6 min-h-[550px] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
        <!-- Inbox / Conversations List -->
        <div class="col-span-12 md:col-span-4 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col">
            <h3 class="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 px-2 uppercase tracking-wider">
                My Messages
            </h3>

            <div class="flex-1 overflow-y-auto space-y-2 max-h-[480px]">
                @forelse ($conversations as $convo)
                    <div 
                        wire:click="selectConversation({{ $convo->id }})"
                        class="chat-sidebar-item p-3 rounded-lg cursor-pointer flex items-center space-x-3 
                        {{ $activeConversationId === $convo->id ? 'active' : '' }}"
                    >
                        <!-- Avatar / Placeholder -->
                        <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                            {{ substr($convo->seller->name, 0, 2) }}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-baseline">
                                <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {{ $convo->seller->name }}
                                </span>
                                @if ($convo->last_message_at)
                                    <span class="text-[10px] text-gray-400 dark:text-gray-500">
                                        {{ $convo->last_message_at->diffForHumans(null, true) }}
                                    </span>
                                @endif
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {{ $convo->listing->title }}
                            </p>
                            @if ($convo->latestMessage)
                                <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate italic mt-0.5">
                                    {{ $convo->latestMessage->sender_id === auth()->id() ? 'You: ' : '' }}{{ $convo->latestMessage->content }}
                                </p>
                            @endif
                        </div>
                    </div>
                @empty
                    <div class="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
                        No conversations found.
                    </div>
                @endforelse
            </div>
        </div>

        <!-- Active Conversation Thread -->
        <div class="col-span-12 md:col-span-8 flex flex-col justify-between min-h-[500px]">
            @if ($activeConversationId)
                <!-- Header -->
                @php
                    $activeConvo = collect($conversations)->firstWhere('id', $activeConversationId);
                @endphp
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
                    <div>
                        <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {{ $activeConvo->seller->name }}
                        </h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                            Product: {{ $activeConvo->listing->title }} (${{ number_format($activeConvo->listing->price, 2) }})
                        </p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-800 dark:bg-primary-950/30 dark:text-primary-400">
                        Seller Portal
                    </span>
                </div>

                <!-- Messages area -->
                <div 
                    wire:poll.3s="loadMessages" 
                    class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px]"
                >
                    @foreach ($messages as $msg)
                        <div class="flex {{ $msg->sender_id === auth()->id() ? 'justify-end' : 'justify-start' }}">
                            <div class="max-w-[70%] rounded-xl p-3 text-sm 
                                {{ $msg->sender_id === auth()->id() 
                                    ? 'bg-primary-600 text-white rounded-br-none dark:bg-primary-500' 
                                    : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-bl-none' }}"
                            >
                                <p>{{ $msg->content }}</p>
                                <span class="text-[10px] block text-right mt-1 opacity-70">
                                    {{ $msg->created_at->format('g:i A') }}
                                </span>
                            </div>
                        </div>
                    @endforeach
                </div>

                <!-- Footer Input Area -->
                <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/20">
                    <form wire:submit.prevent="sendMessage" class="flex space-x-2">
                        <input 
                            wire:model="newMessageText"
                            type="text" 
                            placeholder="Type a message..." 
                            class="flex-1 rounded-lg border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white text-sm focus:border-primary-500 focus:ring-primary-500"
                        />
                        <button 
                            type="submit" 
                            class="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-lg shadow-sm transition"
                        >
                            Send
                        </button>
                    </form>
                </div>
            @else
                <!-- Placeholder screen when no chat selected -->
                <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div class="p-4 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-full">
                        <x-heroicon-o-chat-bubble-left-right class="w-12 h-12" />
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100">Start a Conversation</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[280px]">
                            Select an active listing conversation from the left to read or reply.
                        </p>
                    </div>
                </div>
            @endif
        </div>
    </div>
</x-filament-panels::page>
