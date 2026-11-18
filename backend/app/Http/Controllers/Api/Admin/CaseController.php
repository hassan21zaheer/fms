<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CaseNote;
use App\Models\FeedbackCase;
use App\Models\User;
use App\Notifications\CaseAssignedAlert;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cases = $this->visibleCases($request)
            ->with(['submission:id,overall_score,rating_band,customer_name,customer_phone,customer_email,location_id,flag_reasons,submitted_at', 'submission.location:id,name', 'assignee:id,name', 'branch:id,name'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('priority'), fn ($q) => $q->where('priority', $request->string('priority')))
            ->when($request->boolean('unassigned'), fn ($q) => $q->whereNull('assigned_to'))
            ->when($request->filled('search'), fn ($q) => $this->applySearch($q, trim((string) $request->input('search'))))
            ->orderByDesc('id')
            ->paginate(min(max($request->integer('per_page', 20), 1), 200));

        $counts = $this->visibleCases($request)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            ...$cases->toArray(),
            'counts' => [
                'open' => (int) ($counts['open'] ?? 0),
                'in_progress' => (int) ($counts['in_progress'] ?? 0),
                'resolved' => (int) ($counts['resolved'] ?? 0),
            ],
        ]);
    }

    /**
     * Matches the guest's details, the place, or a case number such as CASE-1012 (case number minus 1000 is the id).
     */
    private function applySearch(Builder $query, string $search): Builder
    {
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
        $caseId = preg_match('/^(?:case-?)?(\d{4,})$/i', $search, $match) ? (int) $match[1] - 1000 : null;

        return $query->where(function (Builder $inner) use ($like, $caseId) {
            $inner->whereHas('submission', fn ($s) => $s->where(fn ($match) => $match
                ->where('customer_name', 'like', $like)
                ->orWhere('customer_phone', 'like', $like)
                ->orWhere('customer_email', 'like', $like)
                ->orWhereHas('location', fn ($l) => $l->where('name', 'like', $like))))
                ->orWhereHas('branch', fn ($b) => $b->where('name', 'like', $like));

            if ($caseId !== null && $caseId > 0) {
                $inner->orWhere('id', $caseId);
            }
        });
    }

    /** People a case can be assigned to: active members of the same organization (and branch, for branch users). */
    public function assignees(Request $request): JsonResponse
    {
        $user = $request->user();

        $people = User::query()
            ->with(['roles:id,name', 'branch:id,name'])
            ->where('is_active', true)
            ->whereNotNull('organization_id')
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where(fn ($inner) => $inner->where('branch_id', $user->branch_id)->orWhereNull('branch_id')))
            ->orderBy('name')
            ->get()
            ->map(fn (User $person) => [
                'id' => $person->id,
                'name' => $person->name,
                'email' => $person->email,
                'role' => $person->getRoleNames()->first(),
                'branch_name' => $person->branch?->name,
            ]);

        return response()->json(['data' => $people]);
    }

    public function show(Request $request, FeedbackCase $feedback_case): JsonResponse
    {
        $this->authorizeCase($request, $feedback_case);
        $feedback_case->load(['submission.answers', 'notes.user:id,name', 'assignee:id,name', 'branch']);

        return response()->json(['data' => $feedback_case]);
    }

    public function update(Request $request, FeedbackCase $feedback_case): JsonResponse
    {
        $this->authorizeCase($request, $feedback_case);

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['open', 'in_progress', 'resolved'])],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'resolution' => ['nullable', 'string'],
        ]);

        if (! empty($data['assigned_to'])) {
            $assignable = User::query()
                ->whereKey($data['assigned_to'])
                ->where('organization_id', $feedback_case->organization_id)
                ->where('is_active', true)
                ->exists();
            abort_unless($assignable, 422, 'That person cannot be assigned to this case.');
        }

        if (($data['status'] ?? null) === 'resolved') {
            $data['resolved_at'] = now();
        }

        if (($data['status'] ?? null) && $data['status'] !== 'resolved') {
            $data['resolved_at'] = null;
        }

        $previousAssignee = $feedback_case->assigned_to;
        $feedback_case->update($data);

        if (! empty($data['assigned_to']) && (int) $data['assigned_to'] !== (int) $previousAssignee && (int) $data['assigned_to'] !== (int) $request->user()->id) {
            User::query()->find($data['assigned_to'])?->notify(new CaseAssignedAlert($feedback_case, $request->user()->name));
        }

        return response()->json(['data' => $feedback_case->fresh(['assignee', 'submission'])]);
    }

    public function addNote(Request $request, FeedbackCase $feedback_case): JsonResponse
    {
        $this->authorizeCase($request, $feedback_case);

        $data = $request->validate([
            'note' => ['required', 'string'],
        ]);

        $note = CaseNote::query()->create([
            'feedback_case_id' => $feedback_case->id,
            'user_id' => $request->user()->id,
            'note' => $data['note'],
        ]);

        return response()->json(['data' => $note->load('user:id,name')], 201);
    }

    private function authorizeCase(Request $request, FeedbackCase $case): void
    {
        $user = $request->user();
        abort_unless(
            $user->isOwner() || (int) $user->organization_id === (int) $case->organization_id,
            403
        );

        abort_if(
            $user->branch_id && ! $user->isOwner() && (int) $user->branch_id !== (int) $case->branch_id,
            403
        );
    }

    /**
     * Cases the signed-in user may see: all for a superadmin (or the chosen organization), otherwise
     * their own organization and, for branch users, their own branch.
     *
     * @return Builder<FeedbackCase>
     */
    private function visibleCases(Request $request): Builder
    {
        $user = $request->user();

        return FeedbackCase::query()
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')));
    }
}
