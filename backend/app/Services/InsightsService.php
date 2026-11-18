<?php

namespace App\Services;

use App\Models\FeedbackCase;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use Illuminate\Support\Facades\DB;

class InsightsService
{
    public function caseResolutionMetrics(int $organizationId, ?int $branchId = null): array
    {
        $query = FeedbackCase::query()->where('organization_id', $organizationId);
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $resolved = (clone $query)->where('status', 'resolved')->whereNotNull('resolved_at');

        $avgHours = self::averageResolutionHours((clone $resolved)->get(['created_at', 'resolved_at']));

        $openCount = (clone $query)->whereIn('status', ['open', 'in_progress'])->count();
        $resolvedCount = (clone $resolved)->count();
        $total = (clone $query)->count();

        return [
            'total_cases' => $total,
            'open_cases' => $openCount,
            'resolved_cases' => $resolvedCount,
            'avg_resolution_hours' => $avgHours,
            'resolution_rate' => $total > 0 ? round(($resolvedCount / $total) * 100, 2) : null,
        ];
    }

    /**
     * Average hours from opening to resolving, worked out in PHP so it behaves the same on every database.
     *
     * @param  iterable<int, FeedbackCase>  $cases
     */
    public static function averageResolutionHours(iterable $cases): ?float
    {
        $minutes = collect($cases)
            ->filter(fn ($case) => $case->resolved_at !== null)
            ->map(fn ($case) => $case->created_at->diffInMinutes($case->resolved_at));

        return $minutes->isEmpty() ? null : round($minutes->avg() / 60, 1);
    }

    public function recommendations(int $organizationId, ?int $branchId = null): array
    {
        $currentFrom = now()->subDays(30)->startOfDay();
        $previousFrom = now()->subDays(60)->startOfDay();
        $previousTo = now()->subDays(30)->startOfDay();

        $current = $this->categoryAverages($organizationId, $branchId, $currentFrom, now());
        $previous = $this->categoryAverages($organizationId, $branchId, $previousFrom, $previousTo);

        $recs = [];
        foreach ($current as $category => $score) {
            if ($category === '' || $category === null) {
                continue;
            }
            $prev = $previous[$category] ?? null;
            if ($prev === null || $prev <= 0) {
                if ($score < 60) {
                    $recs[] = [
                        'type' => 'low_score',
                        'category' => $category,
                        'message' => "{$category} is scoring low at {$score}.",
                        'current_score' => $score,
                        'previous_score' => $prev,
                        'change_percent' => null,
                    ];
                }

                continue;
            }

            $change = round((($score - $prev) / $prev) * 100, 1);
            if ($change <= -10) {
                $recs[] = [
                    'type' => 'drop',
                    'category' => $category,
                    'message' => "{$category} dropped {$change}% over the last 30 days.",
                    'current_score' => $score,
                    'previous_score' => $prev,
                    'change_percent' => $change,
                ];
            } elseif ($change >= 10) {
                $recs[] = [
                    'type' => 'improvement',
                    'category' => $category,
                    'message' => "{$category} improved {$change}% over the last 30 days.",
                    'current_score' => $score,
                    'previous_score' => $prev,
                    'change_percent' => $change,
                ];
            }
        }

        usort($recs, fn ($a, $b) => ($a['change_percent'] ?? 0) <=> ($b['change_percent'] ?? 0));

        return array_values($recs);
    }

    private function categoryAverages(int $organizationId, ?int $branchId, $from, $to): array
    {
        $submissionIds = Submission::query()
            ->where('organization_id', $organizationId)
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereBetween('submitted_at', [$from, $to])
            ->pluck('id');

        if ($submissionIds->isEmpty()) {
            return [];
        }

        return SubmissionAnswer::query()
            ->whereIn('submission_id', $submissionIds)
            ->whereNotNull('score_snapshot')
            ->whereNotNull('category_name_snapshot')
            ->select('category_name_snapshot', DB::raw('AVG(score_snapshot) as average_score'))
            ->groupBy('category_name_snapshot')
            ->pluck('average_score', 'category_name_snapshot')
            ->map(fn ($v) => round((float) $v, 2))
            ->all();
    }
}
