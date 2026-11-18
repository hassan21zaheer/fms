<?php

namespace App\Services;

use App\Models\Form;
use App\Models\FormCategory;
use App\Models\Question;
use App\Models\QuestionOption;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class FormTemplateService
{
    public function templates(): array
    {
        return [
            'hotel' => [
                'name' => 'Hotel Stay Feedback',
                'categories' => ['Room', 'Cleanliness', 'Staff', 'Service'],
                'questions' => [
                    ['text' => 'How would you rate your room?', 'type' => 'single_choice', 'category' => 'Room', 'weight' => 1.5, 'critical' => true],
                    ['text' => 'Cleanliness of the room', 'type' => 'single_choice', 'category' => 'Cleanliness', 'weight' => 1.5, 'critical' => true],
                    ['text' => 'Staff friendliness', 'type' => 'star', 'category' => 'Staff', 'weight' => 1, 'critical' => false],
                    ['text' => 'Overall service quality', 'type' => 'nps', 'category' => 'Service', 'weight' => 1, 'critical' => false],
                    ['text' => 'Would you stay with us again?', 'type' => 'yes_no', 'category' => 'Service', 'weight' => 1, 'critical' => false],
                    ['text' => 'Any additional comments?', 'type' => 'text', 'category' => 'Service', 'weight' => 0, 'critical' => false],
                ],
            ],
            'restaurant' => [
                'name' => 'Restaurant / Café Feedback',
                'categories' => ['Food', 'Service', 'Ambience', 'Value'],
                'questions' => [
                    ['text' => 'How was the food quality?', 'type' => 'single_choice', 'category' => 'Food', 'weight' => 1.5, 'critical' => true],
                    ['text' => 'Speed of service', 'type' => 'single_choice', 'category' => 'Service', 'weight' => 1, 'critical' => false],
                    ['text' => 'Staff courtesy', 'type' => 'star', 'category' => 'Service', 'weight' => 1, 'critical' => false],
                    ['text' => 'Ambience and cleanliness', 'type' => 'single_choice', 'category' => 'Ambience', 'weight' => 1, 'critical' => true],
                    ['text' => 'Value for money', 'type' => 'nps', 'category' => 'Value', 'weight' => 1, 'critical' => false],
                    ['text' => 'Anything we should improve?', 'type' => 'text', 'category' => 'Service', 'weight' => 0, 'critical' => false],
                ],
            ],
            'clinic' => [
                'name' => 'Clinic Visit Feedback',
                'categories' => ['Care', 'Staff', 'Facilities', 'Overall'],
                'questions' => [
                    ['text' => 'Quality of care received', 'type' => 'single_choice', 'category' => 'Care', 'weight' => 1.5, 'critical' => true],
                    ['text' => 'Waiting time experience', 'type' => 'single_choice', 'category' => 'Overall', 'weight' => 1, 'critical' => false],
                    ['text' => 'Staff helpfulness', 'type' => 'star', 'category' => 'Staff', 'weight' => 1, 'critical' => false],
                    ['text' => 'Facility cleanliness', 'type' => 'single_choice', 'category' => 'Facilities', 'weight' => 1, 'critical' => true],
                    ['text' => 'Would you recommend us?', 'type' => 'yes_no', 'category' => 'Overall', 'weight' => 1, 'critical' => false],
                    ['text' => 'Additional comments', 'type' => 'text', 'category' => 'Overall', 'weight' => 0, 'critical' => false],
                ],
            ],
        ];
    }

    /**
     * Every ready-made question from every template, flattened so staff can pick single questions.
     *
     * @return array<int, array<string, mixed>>
     */
    public function questionLibrary(): array
    {
        $choiceOptions = [
            ['label' => 'Excellent', 'score_value' => 100],
            ['label' => 'Good', 'score_value' => 75],
            ['label' => 'Average', 'score_value' => 50],
            ['label' => 'Poor', 'score_value' => 25],
            ['label' => 'Bad', 'score_value' => 0],
        ];

        $items = [];
        foreach ($this->templates() as $key => $template) {
            foreach ($template['questions'] as $index => $def) {
                $options = match ($def['type']) {
                    'single_choice', 'multi_choice' => $choiceOptions,
                    'yes_no' => [['label' => 'Yes', 'score_value' => 100], ['label' => 'No', 'score_value' => 0]],
                    default => [],
                };

                $items[] = [
                    'id' => $key.':'.$index,
                    'group' => $template['name'],
                    'text' => $def['text'],
                    'type' => $def['type'],
                    'category' => $def['category'],
                    'weight' => $def['weight'],
                    'is_critical' => $def['critical'],
                    'options' => $options,
                ];
            }
        }

        return $items;
    }

    public function apply(int $organizationId, string $templateKey, ?int $branchId = null): Form
    {
        $templates = $this->templates();
        if (! isset($templates[$templateKey])) {
            throw new InvalidArgumentException('Unknown template.');
        }

        $template = $templates[$templateKey];
        $choiceOptions = [
            ['label' => 'Excellent', 'score_value' => 100],
            ['label' => 'Good', 'score_value' => 75],
            ['label' => 'Average', 'score_value' => 50],
            ['label' => 'Poor', 'score_value' => 25],
            ['label' => 'Bad', 'score_value' => 0],
        ];

        return DB::transaction(function () use ($organizationId, $branchId, $template, $choiceOptions) {
            $form = Form::query()->create([
                'organization_id' => $organizationId,
                'branch_id' => $branchId,
                'name' => $template['name'],
                'is_active' => true,
            ]);

            $categoryMap = [];
            foreach ($template['categories'] as $index => $name) {
                $category = FormCategory::query()->create([
                    'organization_id' => $organizationId,
                    'form_id' => $form->id,
                    'name' => $name,
                    'sort_order' => $index + 1,
                    'is_active' => true,
                ]);
                $categoryMap[$name] = $category->id;
            }

            foreach ($template['questions'] as $index => $def) {
                $question = Question::query()->create([
                    'organization_id' => $organizationId,
                    'form_id' => $form->id,
                    'form_category_id' => $categoryMap[$def['category']] ?? null,
                    'text' => $def['text'],
                    'type' => $def['type'],
                    'is_required' => $def['type'] !== 'text',
                    'sort_order' => $index + 1,
                    'weight' => $def['weight'],
                    'is_critical' => $def['critical'],
                    'follow_up_on_low' => $def['critical'],
                    'low_score_threshold' => 40,
                    'is_active' => true,
                ]);

                if ($def['type'] === 'single_choice') {
                    foreach ($choiceOptions as $optIndex => $option) {
                        QuestionOption::query()->create([
                            'question_id' => $question->id,
                            'label' => $option['label'],
                            'score_value' => $option['score_value'],
                            'sort_order' => $optIndex,
                        ]);
                    }
                }
            }

            return $form->load(['categories', 'questions.options']);
        });
    }
}
