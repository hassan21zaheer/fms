<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Form;
use App\Models\Location;
use App\Models\Organization;
use App\Models\QuestionBranchOverride;
use Illuminate\Support\Collection;

class FormResolutionService
{
    /**
     * Resolve the effective form for a QR location:
     * 1) form explicitly linked to the location
     * 2) dedicated branch form if present
     * 3) else org-wide form with per-question branch overrides applied
     */
    public function resolveForLocation(Organization $organization, Branch $branch, Location $location): Form
    {
        if ($location->form_id) {
            $linked = Form::query()
                ->where('organization_id', $organization->id)
                ->where('id', $location->form_id)
                ->where('is_active', true)
                ->with($this->formWith())
                ->first();

            if ($linked) {
                // Location-linked org forms still honor branch overrides.
                if ($linked->branch_id === null) {
                    return $this->applyBranchOverrides($organization, $branch, $linked, 'location_form_with_overrides');
                }

                $linked->setAttribute('resolution_mode', 'location_form');

                return $linked;
            }
        }

        return $this->resolveForBranch($organization, $branch);
    }

    /**
     * Resolve the effective form for a branch:
     * 1) dedicated branch form if present
     * 2) else org-wide form with per-question branch overrides applied
     */
    public function resolveForBranch(Organization $organization, Branch $branch): Form
    {
        $branchForm = Form::query()
            ->where('organization_id', $organization->id)
            ->where('branch_id', $branch->id)
            ->where('is_active', true)
            ->with($this->formWith())
            ->orderByDesc('id')
            ->first();

        if ($branchForm) {
            $branchForm->setAttribute('resolution_mode', 'branch_form');

            return $branchForm;
        }

        $orgForm = Form::query()
            ->where('organization_id', $organization->id)
            ->whereNull('branch_id')
            ->where('is_active', true)
            ->with($this->formWith())
            ->orderByDesc('id')
            ->firstOrFail();

        return $this->applyBranchOverrides($organization, $branch, $orgForm, 'org_form_with_overrides');
    }

    private function formWith(): array
    {
        return [
            'categories' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order'),
            'questions' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')->with(['options', 'category']),
        ];
    }

    private function applyBranchOverrides(
        Organization $organization,
        Branch $branch,
        Form $orgForm,
        string $mode
    ): Form {
        $overrides = QuestionBranchOverride::query()
            ->where('organization_id', $organization->id)
            ->where('branch_id', $branch->id)
            ->where('form_id', $orgForm->id)
            ->get()
            ->keyBy('question_id');

        $effectiveQuestions = $orgForm->questions
            ->map(function ($question) use ($overrides) {
                /** @var QuestionBranchOverride|null $override */
                $override = $overrides->get($question->id);
                if ($override?->is_hidden) {
                    return null;
                }

                if ($override) {
                    if ($override->text_override !== null) {
                        $question->text = $override->text_override;
                    }
                    if ($override->is_required_override !== null) {
                        $question->is_required = $override->is_required_override;
                    }
                    if ($override->weight_override !== null) {
                        $question->weight = $override->weight_override;
                    }
                    if ($override->sort_order_override !== null) {
                        $question->sort_order = $override->sort_order_override;
                    }
                    if ($override->follow_up_on_low_override !== null) {
                        $question->follow_up_on_low = $override->follow_up_on_low_override;
                    }
                    if ($override->low_score_threshold_override !== null) {
                        $question->low_score_threshold = $override->low_score_threshold_override;
                    }
                    $question->setAttribute('has_branch_override', true);
                } else {
                    $question->setAttribute('has_branch_override', false);
                }

                return $question;
            })
            ->filter()
            ->sortBy('sort_order')
            ->values();

        $orgForm->setRelation('questions', $effectiveQuestions);
        $orgForm->setAttribute('resolution_mode', $mode);
        $orgForm->setAttribute('applied_overrides_count', $overrides->count());

        return $orgForm;
    }

    public function overridesForBranch(int $organizationId, int $branchId, int $formId): Collection
    {
        return QuestionBranchOverride::query()
            ->where('organization_id', $organizationId)
            ->where('branch_id', $branchId)
            ->where('form_id', $formId)
            ->with('question:id,text,type')
            ->get();
    }
}
