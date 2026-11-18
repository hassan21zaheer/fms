<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\FeedbackCase;
use App\Models\Location;
use App\Models\ScoringSetting;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Services\InsightsService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The numbers behind each tab of the Reports module. Every endpoint honours the date range and the branch
 * or location filter, and branch-level users only ever see their own branch.
 */
class ReportTabsController extends Controller
{
    public function __construct(private InsightsService $insights) {}

    /** Branches the signed-in user can filter by. */
    public function filters(Request $request): JsonResponse
    {
        return response()->json([
            'branches' => $this->visibleBranches($request)->orderBy('name')->get(['id', 'name', 'organization_id']),
        ]);
    }

    public function overview(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $days = (int) $from->diffInDays($to) + 1;
        $previousTo = $from->copy()->subSecond();
        $previousFrom = $from->copy()->subDays($days);

        $current = $this->stats($this->submissions($request, $from, $to));
        $previous = $this->stats($this->submissions($request, $previousFrom, $previousTo));
        $scans = $this->scanCount($request, $from, $to);
        $previousScans = $this->scanCount($request, $previousFrom, $previousTo);

        $casesInPeriod = $this->cases($request)->whereBetween('feedback_cases.created_at', [$from, $to]);
        $resolved = (clone $casesInPeriod)->where('status', 'resolved')->whereNotNull('resolved_at')->get(['created_at', 'resolved_at']);

        $trend = $this->submissions($request, $from, $to)
            ->selectRaw('DATE(submissions.submitted_at) as day, COUNT(*) as responses, AVG(submissions.overall_score) as average_score')
            ->groupBy('day')
            ->get()
            ->keyBy(fn ($row) => (string) $row->day);

        $series = [];
        for ($day = $from->copy(); $day <= $to; $day->addDay()) {
            $key = $day->toDateString();
            $row = $trend->get($key);
            $series[] = [
                'day' => $key,
                'responses' => $row ? (int) $row->responses : 0,
                'average_score' => $row ? (int) round((float) $row->average_score) : null,
            ];
        }

        $bandCounts = $this->submissions($request, $from, $to)
            ->whereNotNull('submissions.rating_band')
            ->selectRaw('submissions.rating_band as band, COUNT(*) as total')
            ->groupBy('submissions.rating_band')
            ->pluck('total', 'band');

        $organizationId = $this->organizationId($request);
        $bandOrder = collect($organizationId
            ? (ScoringSetting::query()->where('organization_id', $organizationId)->value('rating_bands') ?? ScoringSetting::defaults()['rating_bands'])
            : ScoringSetting::defaults()['rating_bands'])
            ->sortByDesc('min')
            ->pluck('label');

        $bands = $bandOrder->map(fn ($label) => ['label' => $label, 'count' => (int) ($bandCounts[$label] ?? 0)])->values();
        foreach ($bandCounts as $label => $count) {
            if (! $bandOrder->contains($label)) {
                $bands->push(['label' => $label, 'count' => (int) $count]);
            }
        }

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $days],
            'kpis' => [
                'responses' => $this->compare($current['responses'], $previous['responses']),
                'average_score' => $this->compare($current['average_score'], $previous['average_score']),
                'flagged' => [
                    ...$this->compare($current['flagged'], $previous['flagged']),
                    'rate_percent' => $current['responses'] > 0 ? round($current['flagged'] / $current['responses'] * 100, 1) : null,
                ],
                'scans' => $this->compare($scans, $previousScans),
                'response_rate_percent' => $this->responseRate($current['responses'], $scans),
                'previous_response_rate_percent' => $this->responseRate($previous['responses'], $previousScans),
                'open_cases' => $this->cases($request)->whereIn('status', ['open', 'in_progress'])->count(),
                'resolved_cases' => $resolved->count(),
                'avg_resolution_hours' => InsightsService::averageResolutionHours($resolved),
            ],
            'trend' => $series,
            'bands' => $bands,
            'recommendations' => $organizationId
                ? $this->insights->recommendations($organizationId, $this->branchScope($request))
                : [],
        ]);
    }

    public function categories(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);
        $days = (int) $from->diffInDays($to) + 1;

        $current = $this->categoryRows($request, $from, $to);
        $previous = $this->categoryRows($request, $from->copy()->subDays($days), $from->copy()->subSecond())->keyBy('category');

        $categories = $current->map(fn ($row) => [
            ...$row,
            'previous_score' => $previous->get($row['category'])['average_score'] ?? null,
            'change' => isset($previous[$row['category']])
                ? $row['average_score'] - $previous[$row['category']]['average_score']
                : null,
        ])->values();

        $ids = $this->submissions($request, $from, $to)->select('submissions.id');
        $questions = SubmissionAnswer::query()
            ->whereIn('submission_id', $ids)
            ->whereNotNull('score_snapshot')
            ->selectRaw('question_text_snapshot as question, category_name_snapshot as category, AVG(score_snapshot) as average_score, COUNT(*) as answers')
            ->groupBy('question_text_snapshot', 'category_name_snapshot')
            ->orderBy('average_score')
            ->limit(15)
            ->get()
            ->map(fn ($row) => [
                'question' => $row->question,
                'category' => $row->category,
                'average_score' => (int) round((float) $row->average_score),
                'answers' => (int) $row->answers,
            ]);

        return response()->json([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $days],
            'categories' => $categories,
            'questions' => $questions,
        ]);
    }

    public function branches(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        $stats = $this->submissions($request, $from, $to)
            ->selectRaw('submissions.branch_id, COUNT(*) as responses, AVG(submissions.overall_score) as average_score, SUM(CASE WHEN submissions.is_flagged = 1 THEN 1 ELSE 0 END) as flagged')
            ->groupBy('submissions.branch_id')
            ->get()
            ->keyBy('branch_id');

        $cases = $this->cases($request)->get(['branch_id', 'status', 'created_at', 'resolved_at']);

        $rows = $this->visibleBranches($request)
            ->with('organization:id,name')
            ->when($request->filled('branch_id'), fn ($q) => $q->whereKey($request->integer('branch_id')))
            ->orderBy('name')
            ->get()
            ->map(function (Branch $branch) use ($stats, $cases, $from, $to) {
                $row = $stats->get($branch->id);
                $branchCases = $cases->where('branch_id', $branch->id);
                $resolved = $branchCases->where('status', 'resolved')
                    ->filter(fn ($case) => $case->resolved_at && $case->resolved_at->between($from, $to));
                $responses = $row ? (int) $row->responses : 0;
                $flagged = $row ? (int) $row->flagged : 0;

                return [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'city' => $branch->city,
                    'organization_name' => $branch->organization?->name,
                    'is_active' => $branch->is_active,
                    'responses' => $responses,
                    'average_score' => $row ? (int) round((float) $row->average_score) : null,
                    'flagged' => $flagged,
                    'flag_rate_percent' => $responses > 0 ? round($flagged / $responses * 100, 1) : null,
                    'open_cases' => $branchCases->whereIn('status', ['open', 'in_progress'])->count(),
                    'resolved_cases' => $resolved->count(),
                    'avg_resolution_hours' => InsightsService::averageResolutionHours($resolved),
                ];
            })
            ->sortByDesc(fn ($row) => $row['average_score'] ?? -1)
            ->values();

        return response()->json(['period' => $this->periodPayload($from, $to), 'branches' => $rows]);
    }

    public function locations(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        $stats = $this->submissions($request, $from, $to)
            ->selectRaw('submissions.location_id, COUNT(*) as responses, AVG(submissions.overall_score) as average_score, SUM(CASE WHEN submissions.is_flagged = 1 THEN 1 ELSE 0 END) as flagged, MAX(submissions.submitted_at) as last_feedback_at')
            ->groupBy('submissions.location_id')
            ->get()
            ->keyBy('location_id');

        $rows = Location::query()
            ->with('branch:id,name')
            ->when(! $request->user()->isOwner(), fn ($q) => $q->where('organization_id', $request->user()->organization_id))
            ->when($request->user()->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($this->branchScope($request), fn ($q, $branchId) => $q->where('branch_id', $branchId))
            ->when($request->filled('location_id'), fn ($q) => $q->whereKey($request->integer('location_id')))
            ->orderBy('name')
            ->get()
            ->map(function (Location $location) use ($stats) {
                $row = $stats->get($location->id);
                $responses = $row ? (int) $row->responses : 0;
                $flagged = $row ? (int) $row->flagged : 0;

                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'type' => $location->type,
                    'branch_name' => $location->branch?->name,
                    'is_active' => $location->is_active,
                    'responses' => $responses,
                    'average_score' => $row ? (int) round((float) $row->average_score) : null,
                    'flagged' => $flagged,
                    'flag_rate_percent' => $responses > 0 ? round($flagged / $responses * 100, 1) : null,
                    'last_feedback_at' => $row?->last_feedback_at,
                ];
            })
            ->sortByDesc(fn ($row) => $row['responses'])
            ->values();

        return response()->json(['period' => $this->periodPayload($from, $to), 'locations' => $rows]);
    }

    public function casesSummary(Request $request): JsonResponse
    {
        [$from, $to] = $this->period($request);

        $inPeriod = $this->cases($request)->whereBetween('feedback_cases.created_at', [$from, $to])->get();
        $resolved = $inPeriod->where('status', 'resolved')->whereNotNull('resolved_at');

        $unresolved = $this->cases($request)->whereIn('status', ['open', 'in_progress'])->get(['created_at']);
        $ages = $unresolved->map(fn ($case) => $case->created_at->diffInDays(now()));
        $aging = [
            ['label' => 'Under 1 day', 'count' => $ages->filter(fn ($d) => $d < 1)->count()],
            ['label' => '1 to 3 days', 'count' => $ages->filter(fn ($d) => $d >= 1 && $d < 3)->count()],
            ['label' => '3 to 7 days', 'count' => $ages->filter(fn ($d) => $d >= 3 && $d < 7)->count()],
            ['label' => 'Over 7 days', 'count' => $ages->filter(fn ($d) => $d >= 7)->count()],
        ];

        $branchNames = Branch::query()->whereIn('id', $inPeriod->pluck('branch_id')->unique())->pluck('name', 'id');
        $byBranch = $inPeriod->groupBy('branch_id')->map(function ($group, $branchId) use ($branchNames) {
            $done = $group->where('status', 'resolved')->whereNotNull('resolved_at');

            return [
                'branch_id' => (int) $branchId,
                'name' => $branchNames[$branchId] ?? 'Unknown',
                'total' => $group->count(),
                'open' => $group->where('status', 'open')->count(),
                'in_progress' => $group->where('status', 'in_progress')->count(),
                'resolved' => $group->where('status', 'resolved')->count(),
                'avg_resolution_hours' => InsightsService::averageResolutionHours($done),
            ];
        })->sortByDesc('total')->values();

        $total = $inPeriod->count();

        return response()->json([
            'period' => $this->periodPayload($from, $to),
            'total' => $total,
            'by_status' => [
                'open' => $inPeriod->where('status', 'open')->count(),
                'in_progress' => $inPeriod->where('status', 'in_progress')->count(),
                'resolved' => $inPeriod->where('status', 'resolved')->count(),
            ],
            'by_priority' => [
                'urgent' => $inPeriod->where('priority', 'urgent')->count(),
                'high' => $inPeriod->where('priority', 'high')->count(),
                'medium' => $inPeriod->where('priority', 'medium')->count(),
            ],
            'avg_resolution_hours' => InsightsService::averageResolutionHours($resolved),
            'resolution_rate_percent' => $total > 0 ? round($resolved->count() / $total * 100, 1) : null,
            'unresolved_now' => $unresolved->count(),
            'oldest_unresolved_days' => $ages->isEmpty() ? null : (int) $ages->max(),
            'aging' => $aging,
            'by_branch' => $byBranch,
        ]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function period(Request $request): array
    {
        $to = $request->filled('to') ? Carbon::parse($request->string('to')->toString())->endOfDay() : now()->endOfDay();
        $from = $request->filled('from')
            ? Carbon::parse($request->string('from')->toString())->startOfDay()
            : $to->copy()->subDays(29)->startOfDay();

        if ($from > $to) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to];
    }

    /**
     * @return array{from: string, to: string, days: int}
     */
    private function periodPayload(Carbon $from, Carbon $to): array
    {
        return ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => (int) $from->diffInDays($to) + 1];
    }

    /** The branch a branch-level user is limited to, or the branch chosen in the filter. */
    private function branchScope(Request $request): ?int
    {
        $user = $request->user();

        if ($user->branch_id && ! $user->isOwner()) {
            return (int) $user->branch_id;
        }

        return $request->filled('branch_id') ? $request->integer('branch_id') : null;
    }

    private function organizationId(Request $request): ?int
    {
        $user = $request->user();

        if (! $user->isOwner()) {
            return (int) $user->organization_id;
        }

        return $request->filled('organization_id') ? $request->integer('organization_id') : null;
    }

    /**
     * @return Builder<Submission>
     */
    private function submissions(Request $request, Carbon $from, Carbon $to): Builder
    {
        $organizationId = $this->organizationId($request);

        return Submission::query()
            ->when($organizationId, fn ($q) => $q->where('submissions.organization_id', $organizationId))
            ->when($this->branchScope($request), fn ($q, $branchId) => $q->where('submissions.branch_id', $branchId))
            ->when($request->filled('location_id'), fn ($q) => $q->where('submissions.location_id', $request->integer('location_id')))
            ->whereBetween('submissions.submitted_at', [$from, $to]);
    }

    /** QR scans (guest form opens) in the period, with the same filters as the responses. */
    private function scanCount(Request $request, Carbon $from, Carbon $to): int
    {
        $organizationId = $this->organizationId($request);

        return (int) DB::table('location_scans')
            ->when($organizationId, fn ($q) => $q->where('organization_id', $organizationId))
            ->when($this->branchScope($request), fn ($q, $branchId) => $q->where('branch_id', $branchId))
            ->when($request->filled('location_id'), fn ($q) => $q->where('location_id', $request->integer('location_id')))
            ->whereBetween('scanned_at', [$from, $to])
            ->count();
    }

    /** Responses as a share of scans, capped at 100 because one scan can be reopened or skipped. */
    private function responseRate(int $responses, int $scans): ?float
    {
        return $scans > 0 ? min(100.0, round($responses / $scans * 100, 1)) : null;
    }

    /**
     * @return Builder<FeedbackCase>
     */
    private function cases(Request $request): Builder
    {
        $organizationId = $this->organizationId($request);

        return FeedbackCase::query()
            ->when($organizationId, fn ($q) => $q->where('feedback_cases.organization_id', $organizationId))
            ->when($this->branchScope($request), fn ($q, $branchId) => $q->where('feedback_cases.branch_id', $branchId));
    }

    /**
     * @return Builder<Branch>
     */
    private function visibleBranches(Request $request): Builder
    {
        $organizationId = $this->organizationId($request);

        return Branch::query()
            ->when($organizationId, fn ($q) => $q->where('organization_id', $organizationId))
            ->when($request->user()->branch_id && ! $request->user()->isOwner(), fn ($q) => $q->whereKey($request->user()->branch_id));
    }

    /**
     * @param  Builder<Submission>  $query
     * @return array{responses: int, average_score: int|null, flagged: int}
     */
    private function stats(Builder $query): array
    {
        $row = $query->selectRaw('COUNT(*) as responses, AVG(submissions.overall_score) as average_score, SUM(CASE WHEN submissions.is_flagged = 1 THEN 1 ELSE 0 END) as flagged')->first();

        return [
            'responses' => (int) ($row->responses ?? 0),
            'average_score' => $row && $row->average_score !== null ? (int) round((float) $row->average_score) : null,
            'flagged' => (int) ($row->flagged ?? 0),
        ];
    }

    /**
     * @return array{value: int|null, previous: int|null, change_percent: float|null}
     */
    private function compare(?int $value, ?int $previous): array
    {
        return [
            'value' => $value,
            'previous' => $previous,
            'change_percent' => ($value !== null && $previous) ? round(($value - $previous) / $previous * 100, 1) : null,
        ];
    }

    /**
     * @return Collection<int, array{category: string, average_score: int, answers: int, responses: int, lowest: int}>
     */
    private function categoryRows(Request $request, Carbon $from, Carbon $to)
    {
        $ids = $this->submissions($request, $from, $to)->select('submissions.id');

        return SubmissionAnswer::query()
            ->whereIn('submission_id', $ids)
            ->whereNotNull('score_snapshot')
            ->whereNotNull('category_name_snapshot')
            ->selectRaw('category_name_snapshot as category, SUM(score_snapshot * weight_snapshot) / NULLIF(SUM(weight_snapshot), 0) as average_score, COUNT(*) as answers, COUNT(DISTINCT submission_id) as responses, MIN(score_snapshot) as lowest')
            ->groupBy('category_name_snapshot')
            ->get()
            ->filter(fn ($row) => $row->average_score !== null)
            ->map(fn ($row) => [
                'category' => $row->category,
                'average_score' => (int) round((float) $row->average_score),
                'answers' => (int) $row->answers,
                'responses' => (int) $row->responses,
                'lowest' => (int) round((float) $row->lowest),
            ])
            ->sortBy('average_score')
            ->values();
    }
}
