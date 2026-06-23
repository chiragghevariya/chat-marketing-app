<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'icon' => $this->icon,
            'parent_id' => $this->parent_id,
            // Include children only when they have been eager-loaded, to avoid
            // accidental N+1 queries.
            'children' => CategoryResource::collection($this->whenLoaded('children')),
        ];
    }
}
