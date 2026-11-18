<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Services\InsightsService;
use App\Support\AuthorizesOrganization;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private InsightsService $insights) {}

    public function summary(Request $request): JsonResponse
    {
        $query = $this->baseQuery($request);
        $user = $request->user();
        $organizationId = $user->isOwner()
            ? ($request->integer('organization_id') ?: (clone $query)->value('organization_id'))
            : $user->organization_id;
        $branchId = $request->filled('branch_id')
            ? $request->integer('branch_id')
            : (($user->branch_id && ! $user->isOwner()) ? $user->branch_id : null);

        $overall = [
            'total_responses' => (clone $query)->count(),
            'average_score' => round((float) ((clone $query)->avg('overall_score') ?? 0), 2),
            'flagged_count' => (clone $query)->where('is_flagged', true)->count(),
        ];

        $byBranch = (clone $query)
            ->join('branches', 'branches.id', '=', 'submissions.branch_id')
            ->selectRaw('branches.id, branches.name, COUNT(*) as responses, AVG(submissions.overall_score) as average_score')
            ->groupBy('branches.id', 'branches.name')
            ->orderByDesc('average_score')
            ->get();

        $byLocation = (clone $query)
            ->join('locations', 'locations.id', '=', 'submissions.location_id')
            ->selectRaw('locations.id, locations.name, locations.type, COUNT(*) as responses, AVG(submissions.overall_score) as average_score')
            ->groupBy('locations.id', 'locations.name', 'locations.type')
            ->orderByDesc('responses')
            ->get();

        $trend = (clone $query)
            ->selectRaw('DATE(submissions.submitted_at) as day, COUNT(*) as responses, AVG(submissions.overall_score) as average_score')
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $submissionIds = (clone $query)->select('submissions.id');

        $questionBreakdown = SubmissionAnswer::query()
            ->whereIn('submission_id', $submissionIds)
            ->whereNotNull('score_snapshot')
            ->selectRaw('question_text_snapshot, category_name_snapshot, AVG(score_snapshot) as average_score, COUNT(*) as answers')
            ->groupBy('question_text_snapshot', 'category_name_snapshot')
            ->orderBy('average_score')
            ->get();

        return response()->json([
            'overall' => $overall,
            'by_branch' => $byBranch,
            'by_location' => $byLocation,
            'trend' => $trend,
            'question_breakdown' => $questionBreakdown,
            'case_resolution' => $organizationId
                ? $this->insights->caseResolutionMetrics((int) $organizationId, $branchId)
                : null,
            'recommendations' => $organizationId
                ? $this->insights->recommendations((int) $organizationId, $branchId)
                : [],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->baseQuery($request)
            ->with(['branch:id,name', 'location:id,name', 'answers'])
            ->orderByDesc('submitted_at')
            ->get();

        $filename = 'feedback-export-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'id', 'submitted_at', 'branch', 'location', 'customer_name', 'customer_phone',
                'customer_email', 'overall_score', 'rating_band', 'is_flagged', 'answers',
            ]);

            foreach ($rows as $row) {
                $answers = $row->answers->map(function ($a) {
                    $value = $a->option_label_snapshot ?: $a->free_text_value ?: $a->score_snapshot;

                    return $a->question_text_snapshot.': '.$value;
                })->implode(' | ');

                fputcsv($out, [
                    $row->id,
                    optional($row->submitted_at)->toDateTimeString(),
                    $row->branch?->name,
                    $row->location?->name,
                    $row->customer_name,
                    $row->customer_phone,
                    $row->customer_email,
                    $row->overall_score,
                    $row->rating_band,
                    $row->is_flagged ? 'yes' : 'no',
                    $answers,
                ]);
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function exportPdf(Request $request)
    {
        $summary = $this->summary($request)->getData(true);

        $pdf = Pdf::loadView('reports.summary', [
            'generatedAt' => now()->toDateTimeString(),
            'summary' => $summary,
        ]);

        return $pdf->download('feedback-report-'.now()->format('Ymd-His').'.pdf');
    }

    private function baseQuery(Request $request)
    {
        $user = $request->user();

        return Submission::query()
            ->when(! $user->isOwner(), fn ($q) => $q->where('submissions.organization_id', $user->organization_id))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where('submissions.branch_id', $user->branch_id))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('submissions.branch_id', $request->integer('branch_id')))
            ->when($request->filled('location_id'), fn ($q) => $q->where('submissions.location_id', $request->integer('location_id')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('submissions.submitted_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('submissions.submitted_at', '<=', $request->date('to')));
    }
}
