<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Support\AuthorizesOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuestionController extends Controller
{
    use AuthorizesOrganization;

    public function store(Request $request, Form $form): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        $data = $request->validate([
            'form_category_id' => ['nullable', 'integer', 'exists:form_categories,id'],
            'text' => ['required', 'string'],
            'type' => ['required', Rule::in(['star', 'emoji', 'single_choice', 'multi_choice', 'yes_no', 'nps', 'text'])],
            'is_required' => ['boolean'],
            'sort_order' => ['integer'],
            'weight' => ['numeric', 'min:0', 'max:5'],
            'is_critical' => ['boolean'],
            'follow_up_on_low' => ['boolean'],
            'low_score_threshold' => ['integer'],
            'is_active' => ['boolean'],
            'options' => ['array'],
            'options.*.label' => ['required_with:options', 'string'],
            'options.*.score_value' => ['numeric'],
            'options.*.sort_order' => ['integer'],
        ]);

        $this->assertScoredWeight($data['type'], $data['weight'] ?? 1);

        $question = DB::transaction(function () use ($form, $data) {
            $question = Question::query()->create([
                'organization_id' => $form->organization_id,
                'form_id' => $form->id,
                'form_category_id' => $data['form_category_id'] ?? null,
                'text' => $data['text'],
                'type' => $data['type'],
                'is_required' => $data['is_required'] ?? true,
                'sort_order' => $data['sort_order'] ?? 0,
                'weight' => $data['weight'] ?? 1,
                'is_critical' => $data['is_critical'] ?? false,
                'follow_up_on_low' => $data['follow_up_on_low'] ?? false,
                'low_score_threshold' => $data['low_score_threshold'] ?? 40,
                'is_active' => $data['is_active'] ?? true,
            ]);

            foreach ($data['options'] ?? [] as $index => $option) {
                QuestionOption::query()->create([
                    'question_id' => $question->id,
                    'label' => $option['label'],
                    'score_value' => $option['score_value'] ?? 0,
                    'sort_order' => $option['sort_order'] ?? $index,
                ]);
            }

            return $question->load('options');
        });

        return response()->json(['data' => $question], 201);
    }

    public function update(Request $request, Question $question): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $question);

        $data = $request->validate([
            'form_category_id' => ['nullable', 'integer', 'exists:form_categories,id'],
            'text' => ['sometimes', 'string'],
            'type' => ['sometimes', Rule::in(['star', 'emoji', 'single_choice', 'multi_choice', 'yes_no', 'nps', 'text'])],
            'is_required' => ['boolean'],
            'sort_order' => ['integer'],
            'weight' => ['numeric', 'min:0', 'max:5'],
            'is_critical' => ['boolean'],
            'follow_up_on_low' => ['boolean'],
            'low_score_threshold' => ['integer'],
            'is_active' => ['boolean'],
            'options' => ['array'],
            'options.*.label' => ['required_with:options', 'string'],
            'options.*.score_value' => ['numeric'],
            'options.*.sort_order' => ['integer'],
        ]);

        $this->assertScoredWeight($data['type'] ?? $question->type, $data['weight'] ?? $question->weight);

        DB::transaction(function () use ($question, $data) {
            $options = $data['options'] ?? null;
            unset($data['options']);
            $question->update($data);

            if (is_array($options)) {
                $question->options()->delete();
                foreach ($options as $index => $option) {
                    QuestionOption::query()->create([
                        'question_id' => $question->id,
                        'label' => $option['label'],
                        'score_value' => $option['score_value'] ?? 0,
                        'sort_order' => $option['sort_order'] ?? $index,
                    ]);
                }
            }
        });

        return response()->json(['data' => $question->fresh('options')]);
    }

    /**
     * Scored questions carry a weight from 1 to 5; free-text questions are not scored and may use 0.
     */
    private function assertScoredWeight(string $type, float|int|string $weight): void
    {
        if ($type !== 'text' && (float) $weight < 1) {
            throw ValidationException::withMessages([
                'weight' => ['A scored question needs a weight from 1 to 5.'],
            ]);
        }
    }

    public function destroy(Request $request, Question $question): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $question);
        $question->delete();

        return response()->json(['message' => 'Question deleted']);
    }

    public function reorder(Request $request, Form $form): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $form);

        $data = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['integer', 'exists:questions,id'],
        ]);

        foreach ($data['order'] as $index => $questionId) {
            Question::query()
                ->where('form_id', $form->id)
                ->where('id', $questionId)
                ->update(['sort_order' => $index + 1]);
        }

        return response()->json(['message' => 'Questions reordered']);
    }
}
