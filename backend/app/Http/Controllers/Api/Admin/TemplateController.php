<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Organization;
use App\Services\FormTemplateService;
use App\Support\AuthorizesOrganization;
use App\Support\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class TemplateController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private FormTemplateService $templates) {}

    public function index(): JsonResponse
    {
        $items = collect($this->templates->templates())->map(function ($template, $key) {
            return [
                'key' => $key,
                'name' => $template['name'],
                'categories' => $template['categories'],
                'question_count' => count($template['questions']),
            ];
        })->values();

        return response()->json(['data' => $items]);
    }

    public function library(): JsonResponse
    {
        return response()->json(['data' => $this->templates->questionLibrary()]);
    }

    public function apply(Request $request): JsonResponse
    {
        $auth = $request->user();
        abort_unless(
            $auth->hasAnyRole(['owner', 'superadmin', 'admin']),
            403
        );

        $data = $request->validate([
            'template' => ['required', 'string'],
            'organization_id' => [$auth->isOwner() ? 'required' : 'nullable', 'integer'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'connect_all_locations' => ['boolean'],
        ]);

        $organizationId = $this->resolveOrganizationId($auth, $data['organization_id'] ?? null);
        PlanLimits::assertPlanActive(Organization::query()->findOrFail($organizationId));

        try {
            $form = $this->templates->apply($organizationId, $data['template'], $data['branch_id'] ?? null);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($data['connect_all_locations'] ?? false) {
            $branchId = $data['branch_id'] ?? null;
            Location::query()
                ->where('organization_id', $organizationId)
                ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->update(['form_id' => $form->id]);
            $form->load(['locations.branch:id,name,slug']);
        }

        return response()->json(['data' => $form->load(['categories', 'questions.options']), 'ready' => true], 201);
    }
}
