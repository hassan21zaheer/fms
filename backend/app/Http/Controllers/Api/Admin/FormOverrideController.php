<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Form;
use App\Models\Question;
use App\Models\QuestionBranchOverride;
use App\Services\FormResolutionService;
use App\Support\AuthorizesOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FormOverrideController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private FormResolutionService $forms) {}

    public function index(Request $request, Form $form, Branch $branch): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);
        abort_unless((int) $branch->organization_id === (int) $form->organization_id, 422);
        abort_unless($form->branch_id === null, 422, 'Overrides apply only to organization-wide forms.');

        return response()->json([
            'data' => $this->forms->overridesForBranch($form->organization_id, $branch->id, $form->id),
        ]);
    }

    public function upsert(Request $request, Form $form, Branch $branch): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);
        abort_unless((int) $branch->organization_id === (int) $form->organization_id, 422);
        abort_unless($form->branch_id === null, 422, 'Overrides apply only to organization-wide forms.');

        $data = $request->validate([
            'question_id' => ['required', 'integer', 'exists:questions,id'],
            'is_hidden' => ['boolean'],
            'text_override' => ['nullable', 'string'],
            'is_required_override' => ['nullable', 'boolean'],
            'weight_override' => ['nullable', 'numeric'],
            'sort_order_override' => ['nullable', 'integer'],
            'follow_up_on_low_override' => ['nullable', 'boolean'],
            'low_score_threshold_override' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        $question = Question::query()->findOrFail($data['question_id']);
        abort_unless((int) $question->form_id === (int) $form->id, 422, 'Question does not belong to this form.');

        $override = QuestionBranchOverride::query()->updateOrCreate(
            [
                'branch_id' => $branch->id,
                'question_id' => $question->id,
            ],
            [
                'organization_id' => $form->organization_id,
                'form_id' => $form->id,
                'is_hidden' => $data['is_hidden'] ?? false,
                'text_override' => $data['text_override'] ?? null,
                'is_required_override' => $data['is_required_override'] ?? null,
                'weight_override' => $data['weight_override'] ?? null,
                'sort_order_override' => $data['sort_order_override'] ?? null,
                'follow_up_on_low_override' => $data['follow_up_on_low_override'] ?? null,
                'low_score_threshold_override' => $data['low_score_threshold_override'] ?? null,
            ]
        );

        return response()->json(['data' => $override->load('question:id,text,type')]);
    }

    public function destroy(Request $request, Form $form, Branch $branch, Question $question): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        QuestionBranchOverride::query()
            ->where('form_id', $form->id)
            ->where('branch_id', $branch->id)
            ->where('question_id', $question->id)
            ->delete();

        return response()->json(['message' => 'Override removed']);
    }
}
