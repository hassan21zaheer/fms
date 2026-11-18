<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\FormCategory;
use App\Support\AuthorizesOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use AuthorizesOrganization;

    public function index(Request $request, Form $form): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        return response()->json([
            'data' => $form->categories()->orderBy('sort_order')->get(),
        ]);
    }

    public function store(Request $request, Form $form): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'icon' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:20'],
            'sort_order' => ['integer'],
            'is_active' => ['boolean'],
        ]);

        $category = FormCategory::query()->create([
            'organization_id' => $form->organization_id,
            'form_id' => $form->id,
            'name' => $data['name'],
            'weight' => $data['weight'] ?? null,
            'icon' => $data['icon'] ?? null,
            'color' => $data['color'] ?? null,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, FormCategory $category): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $category);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'icon' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:20'],
            'sort_order' => ['integer'],
            'is_active' => ['boolean'],
        ]);

        $category->update($data);

        return response()->json(['data' => $category]);
    }

    public function destroy(Request $request, FormCategory $category): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $category);

        $category->questions()->update(['form_category_id' => null]);
        $category->delete();

        return response()->json(['message' => 'Category deleted']);
    }
}
