<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    /**
     * GET /api/categories
     *
     * Returns the category tree: top-level categories with their children
     * eager-loaded (so the mobile app can render a nested menu in one request).
     */
    public function index(): AnonymousResourceCollection
    {
        $categories = Category::query()
            ->whereNull('parent_id')          // only top-level categories...
            ->with('children')                // ...with their sub-categories eager-loaded
            ->orderBy('name')
            ->get();

        return CategoryResource::collection($categories);
    }
}
