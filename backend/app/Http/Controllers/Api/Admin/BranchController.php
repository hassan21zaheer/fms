<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Submission;
use App\Models\User;
use App\Support\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BranchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $branches = Branch::query()
            ->withCount('locations')
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($request->filled('organization_id') && $user->isOwner(), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->withCount('locations')
            ->orderBy('name')
            ->get();

        $ids = $branches->pluck('id');
        $types = Location::query()->whereIn('branch_id', $ids)
            ->selectRaw('branch_id, type, COUNT(*) as total')->groupBy('branch_id', 'type')->get()->groupBy('branch_id');
        $scores = Submission::query()->whereIn('branch_id', $ids)
            ->selectRaw('branch_id, AVG(overall_score) as average_score')->groupBy('branch_id')->pluck('average_score', 'branch_id');
        $managers = User::query()->role('admin')->where('is_active', true)->whereIn('branch_id', $ids)
            ->orderBy('id')->get(['id', 'name', 'branch_id'])->groupBy('branch_id');

        $branches = $branches->map(fn (Branch $branch) => [
            ...$branch->toArray(),
            'rooms_count' => (int) ($types->get($branch->id)?->firstWhere('type', 'room')?->total ?? 0),
            'tables_count' => (int) ($types->get($branch->id)?->firstWhere('type', 'table')?->total ?? 0),
            'average_score' => $scores->has($branch->id) ? (int) round((float) $scores->get($branch->id)) : null,
            'manager_name' => $managers->get($branch->id)?->first()?->name,
        ]);

        return response()->json(['data' => $branches]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $organizationId = $user->isOwner()
            ? $request->integer('organization_id')
            : $user->organization_id;

        $data = $request->validate([
            'organization_id' => [$user->isOwner() ? 'required' : 'nullable', 'integer'],
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', Rule::unique('branches', 'slug')->where('organization_id', $organizationId)],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'is_active' => ['boolean'],
        ]);

        $organization = Organization::query()->with('plan')->findOrFail($organizationId);
        PlanLimits::assertCanAddBranch($organization);

        $branch = Branch::query()->create([
            'organization_id' => $organizationId,
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']),
            'address' => $data['address'] ?? null,
            'city' => $data['city'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['data' => $branch], 201);
    }

    public function update(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['sometimes', 'string', 'max:120', Rule::unique('branches', 'slug')->where('organization_id', $branch->organization_id)->ignore($branch->id)],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'is_active' => ['boolean'],
        ]);

        $branch->update($data);

        return response()->json(['data' => $branch]);
    }

    public function destroy(Request $request, Branch $branch): JsonResponse
    {
        $this->authorizeBranch($request, $branch);
        $branch->delete();

        return response()->json(['message' => 'Branch deleted']);
    }

    private function authorizeBranch(Request $request, Branch $branch): void
    {
        $user = $request->user();
        abort_unless(
            $user->isOwner() || $user->organization_id === $branch->organization_id,
            403
        );
    }
}
