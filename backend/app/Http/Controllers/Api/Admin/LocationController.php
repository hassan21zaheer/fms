<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Form;
use App\Models\Location;
use App\Support\AuthorizesOrganization;
use App\Support\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
    use AuthorizesOrganization;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $locations = Location::query()
            ->with(['branch:id,name,slug', 'form:id,name,is_active,branch_id'])
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($request->filled('form_id'), fn ($q) => $q->where('form_id', $request->integer('form_id')))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $locations]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'form_id' => ['nullable', 'integer', 'exists:forms,id'],
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120'],
            'type' => ['required', Rule::in(['room', 'table', 'counter', 'other'])],
            'is_active' => ['boolean'],
        ]);

        $branch = Branch::query()->findOrFail($data['branch_id']);
        abort_unless($user->isOwner() || $user->organization_id === $branch->organization_id, 403);
        $this->assertBranchAccess($user, (int) $branch->id);
        PlanLimits::assertCanAddLocation($branch->organization()->with('plan')->firstOrFail());

        $formId = $this->validatedFormId($data['form_id'] ?? null, $branch);

        $slug = $data['slug'] ?? Str::slug($data['name']);

        $location = Location::query()->create([
            'organization_id' => $branch->organization_id,
            'branch_id' => $branch->id,
            'form_id' => $formId,
            'name' => $data['name'],
            'slug' => $slug,
            'type' => $data['type'],
            'is_active' => $data['is_active'] ?? true,
        ])->load(['branch:id,name,slug', 'form:id,name,is_active,branch_id']);

        $branch->loadMissing('organization');

        return response()->json([
            'data' => $location,
            'public_path' => sprintf('/f/%s/%s/%s', $branch->organization->slug, $branch->slug, $location->slug),
        ], 201);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $this->authorizeLocation($request, $location);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'slug' => ['sometimes', 'string', 'max:120', Rule::unique('locations', 'slug')->where('branch_id', $location->branch_id)->ignore($location->id)],
            'type' => ['sometimes', Rule::in(['room', 'table', 'counter', 'other'])],
            'form_id' => ['nullable', 'integer', 'exists:forms,id'],
            'is_active' => ['boolean'],
        ]);

        if (array_key_exists('form_id', $data)) {
            $data['form_id'] = $this->validatedFormId($data['form_id'], $location->branch);
        }

        $location->update($data);

        return response()->json([
            'data' => $location->fresh()->load(['branch:id,name,slug', 'form:id,name,is_active,branch_id']),
        ]);
    }

    public function destroy(Request $request, Location $location): JsonResponse
    {
        $this->authorizeLocation($request, $location);
        $location->delete();

        return response()->json(['message' => 'Location deleted']);
    }

    private function authorizeLocation(Request $request, Location $location): void
    {
        $user = $request->user();
        abort_unless(
            $user->isOwner() || $user->organization_id === $location->organization_id,
            403
        );
        $this->assertBranchAccess($user, (int) $location->branch_id);
    }

    private function validatedFormId(?int $formId, Branch $branch): ?int
    {
        if (! $formId) {
            return null;
        }

        $form = Form::query()->findOrFail($formId);
        abort_unless((int) $form->organization_id === (int) $branch->organization_id, 422, 'Form belongs to another organization.');
        abort_unless(
            $form->branch_id === null || (int) $form->branch_id === (int) $branch->id,
            422,
            'Form is scoped to a different branch.'
        );
        abort_unless($form->is_active, 422, 'Connect an active form.');

        return $form->id;
    }
}
