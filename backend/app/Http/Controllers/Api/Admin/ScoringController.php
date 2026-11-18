<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\ScoringSetting;
use App\Services\ScoringService;
use App\Support\AuthorizesOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ScoringController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private ScoringService $scoring) {}

    /** Rating bands, flag rules and the recommended defaults for the organization. */
    public function show(Request $request): JsonResponse
    {
        $settings = $this->settingsFor($request);

        return response()->json([
            'data' => $settings,
            'recommended' => collect(ScoringSetting::defaults())->except('customer_fields'),
            'priority_limits' => ['urgent_below' => 35, 'high_below' => 50],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $settings = $this->settingsFor($request);

        $data = $request->validate([
            'flag_on_overall' => ['required', 'boolean'],
            'flag_threshold' => ['required', 'numeric', 'min:0', 'max:100'],
            'flag_on_critical_question' => ['required', 'boolean'],
            'critical_threshold' => ['required', 'numeric', 'min:0', 'max:100'],
            'flag_on_category' => ['required', 'boolean'],
            'flag_category_threshold' => ['required', 'numeric', 'min:0', 'max:100'],
            'rating_bands' => ['required', 'array', 'min:2', 'max:8'],
            'rating_bands.*.label' => ['required', 'string', 'max:40'],
            'rating_bands.*.min' => ['required', 'integer', 'min:0', 'max:100'],
            'rating_bands.*.max' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $data['rating_bands'] = $this->validatedBands($data['rating_bands']);

        $settings->update($data);

        return response()->json(['data' => $settings->fresh()]);
    }

    /**
     * Set every category weight of a form at once. The weights of the categories that have scored
     * questions are percentages and must add up to 100.
     */
    public function updateCategoryWeights(Request $request, Form $form): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        $data = $request->validate([
            'weights' => ['required', 'array', 'min:1'],
            'weights.*' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $categories = $form->categories()->get()->keyBy('id');
        $scoredCategoryIds = $form->questions()
            ->where('is_active', true)
            ->where('type', '!=', 'text')
            ->where('weight', '>', 0)
            ->pluck('form_category_id')
            ->filter()
            ->unique();

        foreach (array_keys($data['weights']) as $categoryId) {
            abort_unless($categories->has((int) $categoryId), 422, 'Unknown category in weights.');
        }

        $total = $scoredCategoryIds->sum(fn ($categoryId) => (float) ($data['weights'][$categoryId] ?? 0));
        if ($scoredCategoryIds->isNotEmpty() && abs($total - 100) > 0.05) {
            throw ValidationException::withMessages([
                'weights' => ['Category weights must add up to 100. They currently add up to '.round($total, 2).'.'],
            ]);
        }

        foreach ($data['weights'] as $categoryId => $weight) {
            $categories->get((int) $categoryId)->update(['weight' => $weight]);
        }

        return response()->json(['data' => $form->categories()->get()]);
    }

    /**
     * Score a set of sample answers with the real scoring rules, without saving anything.
     */
    public function preview(Request $request, Form $form): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        $data = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.option_id' => ['nullable', 'integer'],
            'answers.*.value' => ['nullable'],
        ]);

        $form->load(['questions.options', 'questions.category']);
        $settings = $this->settingsFor($request, (int) $form->organization_id);

        $result = $this->scoring->evaluate($form, $settings, $data['answers'], false);

        return response()->json([
            'overall_score' => $result['overall_score'],
            'rating_band' => $result['rating_band'],
            'is_flagged' => $result['is_flagged'],
            'flag_reasons' => $result['flag_reasons'],
            'category_scores' => $result['category_scores'],
            'priority' => $result['is_flagged'] ? $result['priority'] : null,
            'answers' => collect($result['answer_rows'])->map(fn ($row) => [
                'question_id' => $row['question_id'],
                'question' => $row['question_text_snapshot'],
                'label' => $row['option_label_snapshot'],
                'score' => $row['score_snapshot'],
                'weight' => $row['weight_snapshot'],
            ])->values(),
        ]);
    }

    private function settingsFor(Request $request, ?int $organizationId = null): ScoringSetting
    {
        $organizationId ??= $this->resolveOrganizationId(
            $request->user(),
            $request->integer('organization_id') ?: null
        );

        return ScoringSetting::query()->firstOrCreate(
            ['organization_id' => $organizationId],
            ScoringSetting::defaults()
        );
    }

    /**
     * Bands must cover 0 to 100 in whole numbers with no gaps and no overlaps.
     *
     * @param  array<int, array{label: string, min: int, max: int}>  $bands
     * @return array<int, array{label: string, min: int, max: int}>
     */
    private function validatedBands(array $bands): array
    {
        $sorted = collect($bands)
            ->map(fn ($band) => [
                'label' => trim($band['label']),
                'min' => (int) $band['min'],
                'max' => (int) $band['max'],
            ])
            ->sortBy('min')
            ->values();

        $problem = null;
        $expectedMin = 0;
        foreach ($sorted as $band) {
            if ($band['max'] < $band['min']) {
                $problem = "{$band['label']}: the top of the range is below its start.";
            } elseif ($band['min'] !== $expectedMin) {
                $problem = $band['min'] > $expectedMin
                    ? "Scores {$expectedMin} to ".($band['min'] - 1).' are not covered by any band.'
                    : "{$band['label']} overlaps the band before it.";
            }
            if ($problem) {
                break;
            }
            $expectedMin = $band['max'] + 1;
        }

        if (! $problem && $expectedMin !== 101) {
            $problem = "Scores {$expectedMin} to 100 are not covered by any band.";
        }

        if ($problem) {
            throw ValidationException::withMessages(['rating_bands' => [$problem]]);
        }

        return $sorted->all();
    }
}
