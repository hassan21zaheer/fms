<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Plan::query()->withCount('organizations')->orderBy('sort_order')->orderBy('price_monthly')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'unique:plans,slug'],
            'description' => ['nullable', 'string', 'max:255'],
            'price_monthly' => ['numeric', 'min:0'],
            'branch_limit' => ['integer', 'min:1'],
            'location_limit' => ['nullable', 'integer', 'min:1'],
            'features' => ['nullable', 'array'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $plan = Plan::query()->create([
            ...$data,
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'price_monthly' => $data['price_monthly'] ?? 0,
            'branch_limit' => $data['branch_limit'] ?? 1,
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(['data' => $plan], 201);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['sometimes', 'string', 'max:120', Rule::unique('plans', 'slug')->ignore($plan->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'price_monthly' => ['numeric', 'min:0'],
            'branch_limit' => ['integer', 'min:1'],
            'location_limit' => ['nullable', 'integer', 'min:1'],
            'features' => ['nullable', 'array'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $plan->update($data);

        return response()->json(['data' => $plan]);
    }

    public function destroy(Plan $plan): JsonResponse
    {
        abort_if($plan->organizations()->exists(), 422, 'Plan is assigned to organizations.');

        $plan->delete();

        return response()->json(['message' => 'Plan deleted']);
    }
}
