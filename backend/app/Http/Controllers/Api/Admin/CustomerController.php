<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\FeedbackCase;
use App\Models\User;
use App\Services\CustomerCommunicationService;
use App\Support\AuthorizesOrganization;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private CustomerCommunicationService $communication) {}

    public function index(Request $request): JsonResponse
    {
        $customers = $this->listQuery($request)->paginate(min(max($request->integer('per_page', 20), 1), 200));

        return response()->json($customers);
    }

    /** Every customer matching the current filters as CSV, not just one page. */
    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->listQuery($request)->get();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'id', 'name', 'phone', 'email', 'source', 'feedback_count', 'average_score',
                'flagged_count', 'last_feedback_at', 'notes',
            ]);

            foreach ($rows as $customer) {
                fputcsv($out, [
                    $customer->id,
                    $customer->name,
                    $customer->phone,
                    $customer->email,
                    $customer->source,
                    $customer->feedback_count,
                    $customer->average_score !== null ? round((float) $customer->average_score) : null,
                    $customer->flagged_count,
                    $customer->last_feedback_at,
                    $customer->notes,
                ]);
            }

            fclose($out);
        }, 'customers-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function show(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeCustomer($request, $customer);
        $user = $request->user();
        $scope = $this->submissionScope($user);

        $submissions = $customer->submissions()
            ->tap($scope)
            ->with(['branch:id,name', 'location:id,name'])
            ->latest('submitted_at')
            ->limit(50)
            ->get();

        $cases = FeedbackCase::query()
            ->whereIn('submission_id', $submissions->pluck('id'))
            ->latest('id')
            ->get(['id', 'submission_id', 'status', 'priority', 'created_at', 'resolved_at']);

        $stats = $customer->submissions()->tap($scope);

        return response()->json([
            'data' => [
                ...$customer->only(['id', 'organization_id', 'branch_id', 'name', 'phone', 'email', 'notes', 'source', 'created_at']),
                'branch' => $customer->branch?->only(['id', 'name']),
                'stats' => [
                    'feedback_count' => (clone $stats)->count(),
                    'average_score' => ($avg = (clone $stats)->avg('overall_score')) !== null ? (int) round((float) $avg) : null,
                    'lowest_score' => ($min = (clone $stats)->min('overall_score')) !== null ? (int) round((float) $min) : null,
                    'flagged_count' => (clone $stats)->where('is_flagged', true)->count(),
                    'last_feedback_at' => (clone $stats)->max('submitted_at'),
                ],
                'submissions' => $submissions,
                'cases' => $cases,
                'messages' => $customer->messages()->with('user:id,name')->latest()->limit(50)->get(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $organizationId = $this->resolveOrganizationId($user, $request->integer('organization_id') ?: null);
        $data = $this->validatedCustomer($request, $organizationId);

        $customer = Customer::query()->create([
            ...$data,
            'organization_id' => $organizationId,
            'branch_id' => $user->isOwner() ? null : $user->branch_id,
            'source' => 'manual',
        ]);

        return response()->json(['data' => $customer], 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeCustomer($request, $customer);

        $customer->update($this->validatedCustomer($request, (int) $customer->organization_id, $customer->id));

        return response()->json(['data' => $customer->fresh()]);
    }

    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(['owner', 'superadmin']), 403);
        $this->assertSameOrganization($request->user(), $customer);

        // Feedback records stay; they simply stop pointing at this customer.
        $customer->delete();

        return response()->json(['message' => 'Customer deleted']);
    }

    public function messages(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeCustomer($request, $customer);

        return response()->json([
            'data' => $customer->messages()->with('user:id,name')->latest()->paginate(20),
        ]);
    }

    public function sendEmail(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeCustomer($request, $customer);

        $data = $request->validate([
            'subject' => ['required', 'string', 'max:180'],
            'body' => ['required', 'string'],
            'submission_id' => ['nullable', 'integer', 'exists:submissions,id'],
        ]);

        try {
            $message = $this->communication->sendEmail(
                $customer,
                $request->user(),
                $data['subject'],
                $data['body'],
                $data['submission_id'] ?? null
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $message], 201);
    }

    public function sendWhatsApp(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeCustomer($request, $customer);

        $data = $request->validate([
            'body' => ['required', 'string'],
            'submission_id' => ['nullable', 'integer', 'exists:submissions,id'],
        ]);

        try {
            $message = $this->communication->prepareWhatsApp(
                $customer,
                $request->user(),
                $data['body'],
                $data['submission_id'] ?? null
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => $message,
            'whatsapp_link' => $message->external_link,
        ], 201);
    }

    /**
     * Customers the signed-in user may see, with their feedback numbers. Branch users only see
     * customers who gave feedback at their branch or whom they added, and only count that branch's feedback.
     *
     * @return Builder<Customer>
     */
    private function listQuery(Request $request): Builder
    {
        $user = $request->user();
        $userScope = $this->submissionScope($user);
        $branchFilter = $request->filled('branch_id') ? $request->integer('branch_id') : null;
        $scope = function ($query) use ($userScope, $branchFilter) {
            $userScope($query);

            return $branchFilter ? $query->where('branch_id', $branchFilter) : $query;
        };

        return $this->visibleCustomers($request)
            ->when($branchFilter, fn ($q) => $q->whereHas('submissions', fn ($s) => $s->where('branch_id', $branchFilter)))
            ->withCount([
                'submissions as feedback_count' => $scope,
                'submissions as flagged_count' => fn ($q) => $scope($q)->where('is_flagged', true),
            ])
            ->withAvg(['submissions as average_score' => $scope], 'overall_score')
            ->withMax(['submissions as last_feedback_at' => $scope], 'submitted_at')
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = '%'.$request->string('search').'%';
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', $search)
                        ->orWhere('phone', 'like', $search)
                        ->orWhere('email', 'like', $search);
                });
            })
            ->when($request->boolean('flagged'), fn ($q) => $q->whereHas('submissions', fn ($s) => $scope($s)->where('is_flagged', true)))
            ->when($request->boolean('has_email'), fn ($q) => $q->whereNotNull('email')->where('email', '!=', ''))
            ->when($request->boolean('has_phone'), fn ($q) => $q->whereNotNull('phone')->where('phone', '!=', ''))
            ->when($request->filled('source'), fn ($q) => $q->where('source', $request->string('source')))
            ->orderByDesc('id');
    }

    /**
     * @return Builder<Customer>
     */
    private function visibleCustomers(Request $request): Builder
    {
        $user = $request->user();

        return Customer::query()
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($user->branch_id && ! $user->isOwner(), function ($q) use ($user) {
                $q->where(function ($inner) use ($user) {
                    $inner->where('branch_id', $user->branch_id)
                        ->orWhereHas('submissions', fn ($s) => $s->where('branch_id', $user->branch_id));
                });
            });
    }

    /** Limits a submissions query to the user's own branch (no limit for superadmins or org-wide admins). */
    private function submissionScope(User $user): Closure
    {
        return function ($query) use ($user) {
            if ($user->branch_id && ! $user->isOwner()) {
                $query->where('branch_id', $user->branch_id);
            }

            return $query;
        };
    }

    private function authorizeCustomer(Request $request, Customer $customer): void
    {
        $user = $request->user();
        $this->assertSameOrganization($user, $customer);

        if ($user->branch_id && ! $user->isOwner()) {
            $visible = (int) $customer->branch_id === (int) $user->branch_id
                || $customer->submissions()->where('branch_id', $user->branch_id)->exists();

            abort_unless($visible, 403);
        }
    }

    /**
     * @return array{name: ?string, phone: ?string, email: ?string, notes: ?string}
     */
    private function validatedCustomer(Request $request, int $organizationId, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\-\s]{5,40}$/'],
            'email' => ['nullable', 'email', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $clean = [
            'name' => filled($data['name'] ?? null) ? trim($data['name']) : null,
            'phone' => Customer::normalizePhone($data['phone'] ?? null),
            'email' => Customer::normalizeEmail($data['email'] ?? null),
            'notes' => filled($data['notes'] ?? null) ? trim($data['notes']) : null,
        ];

        if (! $clean['name'] && ! $clean['phone'] && ! $clean['email']) {
            throw ValidationException::withMessages(['name' => ['Add at least a name, phone number or email.']]);
        }

        foreach (['phone', 'email'] as $field) {
            if (! $clean[$field]) {
                continue;
            }

            $existing = Customer::query()
                ->where('organization_id', $organizationId)
                ->where($field, $clean[$field])
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->first();

            if ($existing) {
                $who = $existing->name ?: 'another customer';
                throw ValidationException::withMessages([
                    $field => ["A customer with this {$field} already exists ({$who})."],
                ]);
            }
        }

        return $clean;
    }
}
