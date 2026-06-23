<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'content' => $this->content,
            'type' => $this->type,
            'is_read' => $this->is_read,
            // Public sender info only (no email/phone).
            'sender' => new PublicUserResource($this->whenLoaded('sender')),
            'created_at' => $this->created_at,
        ];
    }
}
