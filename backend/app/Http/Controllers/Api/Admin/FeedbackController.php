<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FeedbackCase;
use App\Models\Submission;
use App\Services\ScoringService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FeedbackController extends Controller
{
    private const CSV_HEADERS = [
        'id', 'submitted_at', 'branch', 'location', 'customer_name', 'customer_phone',
        'customer_email', 'extra_details', 'overall_score', 'rating_band', 'is_flagged', 'case_status', 'answers',
    ];

    public function index(Request $request): JsonResponse
    {
        $submissions = $this->filteredQuery($request)
            ->with(['branch:id,name', 'location:id,name,type', 'customer:id,name,phone,email', 'feedbackCase:id,submission_id,status,priority'])
            ->paginate(min(max($request->integer('per_page', 20), 1), 200));

        return response()->json($submissions);
    }

    public function show(Request $request, Submission $submission): JsonResponse
    {
        $this->authorizeSubmission($request, $submission);

        $submission->load(['answers', 'branch', 'location', 'customer', 'feedbackCase.notes.user']);

        return response()->json(['data' => $submission]);
    }

    /**
     * Open a case by hand for a response that was not flagged automatically. The response becomes flagged and
     * gets the priority its score deserves unless one is given.
     */
    public function escalate(Request $request, Submission $submission): JsonResponse
    {
        $this->authorizeSubmission($request, $submission);
        abort_if($submission->feedbackCase()->exists(), 422, 'This feedback already has a case.');

        $data = $request->validate([
            'priority' => ['nullable', Rule::in(['urgent', 'high', 'medium'])],
        ]);

        $score = $submission->overall_score !== null ? (int) round((float) $submission->overall_score) : null;
        $priority = $data['priority'] ?? app(ScoringService::class)->priorityFor($score);

        $case = DB::transaction(function () use ($request, $submission, $priority) {
            $reasons = array_values(array_unique([...($submission->flag_reasons ?? []), 'Escalated manually by '.$request->user()->name]));
            $submission->update(['is_flagged' => true, 'flag_reasons' => $reasons]);

            return FeedbackCase::query()->create([
                'organization_id' => $submission->organization_id,
                'branch_id' => $submission->branch_id,
                'submission_id' => $submission->id,
                'status' => 'open',
                'priority' => $priority,
            ]);
        });

        return response()->json(['data' => $case->load(['submission.location:id,name', 'branch:id,name'])], 201);
    }

    /** Whole filtered table as CSV (every matching row, not just one page). */
    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->exportQuery($request)->get();

        return $this->streamCsv($rows, 'feedback-records-'.now()->format('Ymd-His').'.csv');
    }

    /** Whole filtered table as a printable PDF. */
    public function exportPdf(Request $request)
    {
        $rows = $this->exportQuery($request)->get();

        return Pdf::loadView('reports.feedback-table', [
            'generatedAt' => now()->toDateTimeString(),
            'rows' => $rows,
        ])->setPaper('a4', 'landscape')->download('feedback-records-'.now()->format('Ymd-His').'.pdf');
    }

    /** One complete record (all answers) as CSV. */
    public function exportRecordCsv(Request $request, Submission $submission): StreamedResponse
    {
        $this->authorizeSubmission($request, $submission);
        $submission->load(['branch:id,name', 'location:id,name', 'answers', 'feedbackCase']);

        return $this->streamCsv(collect([$submission]), 'feedback-record-'.$submission->id.'.csv');
    }

    /** One complete record (all answers and case notes) as PDF. */
    public function exportRecordPdf(Request $request, Submission $submission)
    {
        $this->authorizeSubmission($request, $submission);
        $submission->load(['branch', 'location', 'answers', 'feedbackCase.notes.user']);

        return Pdf::loadView('reports.feedback-record', [
            'generatedAt' => now()->toDateTimeString(),
            'submission' => $submission,
        ])->download('feedback-record-'.$submission->id.'.pdf');
    }

    private function authorizeSubmission(Request $request, Submission $submission): void
    {
        $user = $request->user();

        abort_unless(
            $user->isOwner() || (int) $user->organization_id === (int) $submission->organization_id,
            403
        );

        abort_if(
            $user->branch_id && ! $user->isOwner() && (int) $user->branch_id !== (int) $submission->branch_id,
            403
        );
    }

    private function exportQuery(Request $request): Builder
    {
        return $this->filteredQuery($request)
            ->with(['branch:id,name', 'location:id,name', 'answers', 'feedbackCase']);
    }

    /**
     * Rows the signed-in user may see, narrowed by the same filters the Feedback page offers.
     */
    private function filteredQuery(Request $request): Builder
    {
        $user = $request->user();

        return Submission::query()
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($request->filled('location_id'), fn ($q) => $q->where('location_id', $request->integer('location_id')))
            ->when($request->filled('flagged'), fn ($q) => $q->where('is_flagged', $request->boolean('flagged')))
            ->when($request->filled('rating_band'), fn ($q) => $q->where('rating_band', $request->string('rating_band')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('submitted_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('submitted_at', '<=', $request->date('to')))
            ->when($request->filled('score_min'), fn ($q) => $q->where('overall_score', '>=', (float) $request->input('score_min')))
            ->when($request->filled('score_below'), fn ($q) => $q->where('overall_score', '<', (float) $request->input('score_below')))
            ->when($request->filled('search'), fn ($q) => $this->applySearch($q, trim((string) $request->input('search'))))
            ->tap(fn ($q) => match ($request->input('sort')) {
                'score_high' => $q->orderByDesc('overall_score')->orderByDesc('id'),
                'score_low' => $q->orderBy('overall_score')->orderByDesc('id'),
                default => $q->orderByDesc('submitted_at')->orderByDesc('id'),
            });
    }

    /**
     * Matches the guest's details, the place, or a feedback number such as FB-000012.
     */
    private function applySearch(Builder $query, string $search): Builder
    {
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
        $number = preg_match('/^(?:fb-?)?0*(\d+)$/i', $search, $match) ? (int) $match[1] : null;

        return $query->where(function (Builder $inner) use ($like, $number) {
            $inner->where('customer_name', 'like', $like)
                ->orWhere('customer_phone', 'like', $like)
                ->orWhere('customer_email', 'like', $like)
                ->orWhereHas('location', fn ($l) => $l->where('name', 'like', $like))
                ->orWhereHas('branch', fn ($b) => $b->where('name', 'like', $like));

            if ($number !== null) {
                $inner->orWhere('id', $number);
            }
        });
    }

    /**
     * @param  iterable<int, Submission>  $rows
     */
    private function streamCsv(iterable $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, self::CSV_HEADERS);

            foreach ($rows as $row) {
                $answers = $row->answers->map(function ($answer) {
                    $value = $answer->option_label_snapshot ?: $answer->free_text_value ?: $answer->score_snapshot;

                    return $answer->question_text_snapshot.': '.$value;
                })->implode(' | ');

                fputcsv($out, [
                    $row->id,
                    optional($row->submitted_at)->toDateTimeString(),
                    $row->branch?->name,
                    $row->location?->name,
                    $row->customer_name,
                    $row->customer_phone,
                    $row->customer_email,
                    collect($row->customer_extra ?? [])
                        ->map(fn ($field) => ($field['label'] ?? '').': '.($field['value'] ?? ''))
                        ->implode(' | '),
                    $row->overall_score,
                    $row->rating_band,
                    $row->is_flagged ? 'yes' : 'no',
                    $row->feedbackCase?->status,
                    $answers,
                ]);
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
