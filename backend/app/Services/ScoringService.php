<?php

namespace App\Services;

use App\Models\Form;
use App\Models\Question;
use App\Models\ScoringSetting;
use Illuminate\Support\Collection;
use InvalidArgumentException;

/**
 * Feedback scoring, always calculated on the server.
 *
 *  1. Every answer becomes a score from 0 to 100 (options carry their own score; 1-5 stars map to
 *     0/25/50/75/100; 0-10 scales are multiplied by 10; yes/no is 100/0). Free text is not scored.
 *  2. A category score is the weighted average of its answer scores, using the question weight.
 *  3. The overall score is the weighted average of the category scores, using the category weight. A
 *     category without scored answers is left out and the remaining weights are re-normalized.
 *  4. Full precision is kept throughout; the overall score and every category score are rounded once at
 *     the end, then mapped to a rating band and checked against the flag rules.
 */
class ScoringService
{
    /**
     * @param  array<int, array{question_id:int, option_id?:int|null, value?:mixed, free_text?:string|null}>  $answers
     * @param  bool  $enforceFollowUp  Require follow-up text for low scores (off for the score tester).
     * @return array{
     *   overall_score: int|null,
     *   rating_band: string|null,
     *   is_flagged: bool,
     *   flag_reasons: array<int, string>,
     *   category_scores: array<int, array{category_id: int|null, name: string, score: int, weight: float, share: float}>,
     *   priority: string,
     *   answer_rows: array<int, array<string, mixed>>
     * }
     */
    public function evaluate(Form $form, ScoringSetting $settings, array $answers, bool $enforceFollowUp = true): array
    {
        // Prefer already-resolved questions (includes branch overrides) when present.
        if ($form->relationLoaded('questions')) {
            $questions = $form->questions
                ->filter(fn ($q) => (bool) $q->is_active)
                ->loadMissing(['options', 'category'])
                ->keyBy('id');
        } else {
            $questions = $form->questions()
                ->with(['options', 'category'])
                ->where('is_active', true)
                ->get()
                ->keyBy('id');
        }

        $answerRows = [];
        $buckets = [];
        $flagReasons = [];
        $criticalLimit = (float) ($settings->critical_threshold ?? 50);

        foreach ($answers as $answer) {
            /** @var Question|null $question */
            $question = $questions->get((int) ($answer['question_id'] ?? 0));

            if (! $question) {
                continue;
            }

            [$score, $optionLabel, $freeText] = $this->answerScore($question, $answer);

            $answerRows[] = [
                'question_id' => $question->id,
                'question_text_snapshot' => $question->text,
                'question_type_snapshot' => $question->type,
                'option_label_snapshot' => $optionLabel,
                'score_snapshot' => $score,
                'weight_snapshot' => (float) $question->weight,
                'free_text_value' => $freeText,
                'is_critical_snapshot' => $question->is_critical,
                'form_category_id' => $question->form_category_id,
                'category_name_snapshot' => $question->category?->name,
            ];

            if ($score === null || $question->type === 'text') {
                continue;
            }

            $weight = (float) $question->weight;
            $categoryId = $question->form_category_id ?? 0;

            $buckets[$categoryId] ??= [
                'total' => 0.0,
                'weight' => 0.0,
                'name' => $question->category?->name,
                'category_weight' => $question->category?->weight,
            ];
            $buckets[$categoryId]['total'] += $score * $weight;
            $buckets[$categoryId]['weight'] += $weight;

            if ($settings->flag_on_critical_question && $question->is_critical && $score < $criticalLimit) {
                $flagReasons[] = "Critical question scored {$this->whole($score)}, below the limit of {$this->whole($criticalLimit)}: {$question->text}";
            }

            if (
                $enforceFollowUp
                && $question->follow_up_on_low
                && $score < (float) $question->low_score_threshold
                && blank($freeText)
            ) {
                throw new InvalidArgumentException(
                    "Follow-up text is required for low score on: {$question->text}"
                );
            }
        }

        [$overallRaw, $categoryRows] = $this->combine($buckets);

        $overall = $overallRaw === null ? null : (int) round($overallRaw);
        $categoryScores = array_map(function (array $row) {
            return [...$row, 'score' => (int) round($row['score'])];
        }, $categoryRows);

        $bands = collect($settings->rating_bands ?? ScoringSetting::defaults()['rating_bands']);
        $band = $this->resolveBand($overall, $bands);

        if ($settings->flag_on_overall && $overall !== null && $overall < (float) $settings->flag_threshold) {
            $flagReasons[] = "Overall score {$overall} is below the limit of {$this->whole((float) $settings->flag_threshold)}";
        }

        if ($settings->flag_on_category && $settings->flag_category_threshold !== null) {
            $categoryLimit = (float) $settings->flag_category_threshold;
            foreach ($categoryScores as $row) {
                if ($row['category_id'] !== null && $row['score'] < $categoryLimit) {
                    $flagReasons[] = "Category {$row['name']} scored {$row['score']}, below the limit of {$this->whole($categoryLimit)}";
                }
            }
        }

        $flagReasons = array_values(array_unique($flagReasons));

        return [
            'overall_score' => $overall,
            'rating_band' => $band,
            'is_flagged' => $flagReasons !== [],
            'flag_reasons' => $flagReasons,
            'category_scores' => $categoryScores,
            'priority' => $this->priorityFor($overall),
            'answer_rows' => $answerRows,
        ];
    }

    /**
     * Case priority from the overall score: urgent below 35, high below 50, otherwise medium.
     */
    public function priorityFor(?int $overall): string
    {
        return match (true) {
            $overall === null => 'medium',
            $overall < 35 => 'urgent',
            $overall < 50 => 'high',
            default => 'medium',
        };
    }

    /**
     * @return array{0: float|null, 1: string|null, 2: string|null} score (0-100), chosen label, free text
     */
    private function answerScore(Question $question, array $answer): array
    {
        $value = $answer['value'] ?? null;
        $freeText = $answer['free_text'] ?? null;
        $numeric = is_numeric($value) ? (float) $value : null;

        switch ($question->type) {
            case 'text':
                return [null, null, $value ?? $freeText];

            case 'star':
                if ($numeric === null || $numeric < 1) {
                    return [null, null, $freeText];
                }
                $stars = min(5.0, $numeric);

                return [round(($stars - 1) / 4 * 100, 4), (string) $stars, $freeText];

            case 'nps':
                if ($numeric === null) {
                    return [null, null, $freeText];
                }
                $points = max(0.0, min(10.0, $numeric));

                return [$points * 10, (string) $points, $freeText];

            case 'yes_no':
                $answerText = strtolower((string) $value);
                if (in_array($answerText, ['yes', '1', 'true'], true)) {
                    return [100.0, 'Yes', $freeText];
                }
                if (in_array($answerText, ['no', '0', 'false'], true)) {
                    return [0.0, 'No', $freeText];
                }

                return [null, null, $freeText];

            default:
                $option = $question->options->firstWhere('id', $answer['option_id'] ?? null);
                if ($option) {
                    return [(float) $option->score_value, $option->label, $freeText];
                }

                // An emoji question without answer options falls back to the star scale.
                if ($question->type === 'emoji' && $question->options->isEmpty() && $numeric !== null && $numeric >= 1) {
                    return [round((min(5.0, $numeric) - 1) / 4 * 100, 4), (string) min(5.0, $numeric), $freeText];
                }

                return [null, null, $freeText];
        }
    }

    /**
     * Category scores and the overall score at full precision.
     *
     * A category without an explicit weight counts as the sum of its question weights, so a form with no
     * category weights scores exactly like one plain weighted average of every scored answer.
     *
     * @param  array<int, array{total: float, weight: float, name: ?string, category_weight: mixed}>  $buckets
     * @return array{0: float|null, 1: array<int, array{category_id: int|null, name: string, score: float, weight: float, share: float}>}
     */
    private function combine(array $buckets): array
    {
        $rows = [];
        $weightedTotal = 0.0;
        $weightSum = 0.0;

        foreach ($buckets as $categoryId => $bucket) {
            if ($bucket['weight'] <= 0) {
                continue;
            }

            $categoryScore = $bucket['total'] / $bucket['weight'];
            $categoryWeight = $bucket['category_weight'] !== null
                ? (float) $bucket['category_weight']
                : $bucket['weight'];

            $weightedTotal += $categoryScore * $categoryWeight;
            $weightSum += $categoryWeight;

            $rows[] = [
                'category_id' => $categoryId === 0 ? null : $categoryId,
                'name' => $bucket['name'] ?? 'General',
                'score' => $categoryScore,
                'weight' => $categoryWeight,
                'share' => 0.0,
            ];
        }

        if ($weightSum <= 0) {
            return [null, array_map(fn ($row) => [...$row, 'weight' => 0.0], $rows)];
        }

        $rows = array_map(
            fn ($row) => [...$row, 'weight' => round($row['weight'], 2), 'share' => round($row['weight'] / $weightSum * 100, 2)],
            $rows
        );

        return [$weightedTotal / $weightSum, $rows];
    }

    private function whole(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }

    private function resolveBand(?int $score, Collection $bands): ?string
    {
        if ($score === null) {
            return null;
        }

        foreach ($bands as $band) {
            $min = (float) ($band['min'] ?? 0);
            $max = (float) ($band['max'] ?? 100);
            if ($score >= $min && $score <= $max) {
                return (string) ($band['label'] ?? 'Unknown');
            }
        }

        return null;
    }
}
