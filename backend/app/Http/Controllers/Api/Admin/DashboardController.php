<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\FeedbackCase;
use App\Models\Organization;
use App\Models\Submission;
use App\Models\User;
use App\Services\InsightsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __construct(private InsightsService $insights) {}

    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->loadMissing(['organization', 'branch']);
        $role = $user->getRoleNames()->first() ?: 'staff';

        $query = Submission::query();

        if (! $user->isOwner()) {
            $query->where('organization_id', $user->organization_id);
            if (($user->hasAnyRole(['admin', 'staff'])) && $user->branch_id) {
                $query->where('branch_id', $user->branch_id);
            }
        } elseif ($request->filled('organization_id')) {
            $query->where('organization_id', $request->integer('organization_id'));
        }

        $total = (clone $query)->count();
        $flagged = (clone $query)->where('is_flagged', true)->count();
        $avgScore = (clone $query)->avg('overall_score');

        $casesQuery = FeedbackCase::query()
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where('branch_id', $user->branch_id));

        $openCases = (clone $casesQuery)->whereIn('status', ['open', 'in_progress'])->count();

        $byBand = (clone $query)
            ->selectRaw('rating_band, COUNT(*) as total')
            ->groupBy('rating_band')
            ->pluck('total', 'rating_band');

        $recentFeedback = (clone $query)
            ->with(['branch:id,name', 'location:id,name'])
            ->latest('submitted_at')
            ->latest('id')
            ->limit(6)
            ->get(['id', 'branch_id', 'location_id', 'customer_name', 'overall_score', 'rating_band', 'is_flagged', 'submitted_at']);

        $recentCases = (clone $casesQuery)
            ->with(['branch:id,name', 'submission:id,overall_score,customer_name'])
            ->latest('id')
            ->limit(6)
            ->get(['id', 'branch_id', 'submission_id', 'status', 'assigned_to', 'created_at', 'resolved_at']);

        $payload = [
            'role' => $role,
            'scope' => [
                'organization_id' => $user->organization_id,
                'branch_id' => $user->branch_id,
                'organization_name' => $user->organization?->name,
                'branch_name' => $user->branch?->name,
            ],
            'stats' => [
                'total_responses' => $total,
                'average_score' => $avgScore ? round((float) $avgScore, 2) : null,
                'flagged_count' => $flagged,
                'open_cases' => $openCases,
                'unassigned_cases' => (clone $casesQuery)
                    ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
                    ->whereIn('status', ['open', 'in_progress'])->whereNull('assigned_to')->count(),
                'waiting_customers' => (int) (clone $query)
                    ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
                    ->whereIn('id', (clone $casesQuery)->whereIn('status', ['open', 'in_progress'])->select('submission_id'))
                    ->selectRaw("COUNT(DISTINCT COALESCE(NULLIF(customer_phone, ''), NULLIF(customer_email, ''), customer_name)) as guests")
                    ->value('guests'),
            ],
            'rating_bands' => $byBand,
            'recent_feedback' => $recentFeedback,
            'recent_cases' => $recentCases,
        ];

        if ($user->isOwner()) {
            $payload['platform'] = [
                'organizations_count' => Organization::query()->count(),
                'active_organizations' => Organization::query()->where('status', 'active')->count(),
                'suspended_organizations' => Organization::query()->where('status', 'suspended')->count(),
                'users_count' => User::query()->whereNotNull('organization_id')->count(),
                'organizations' => Organization::query()
                    ->with('plan:id,name')
                    ->withCount('branches')
                    ->latest('id')
                    ->limit(8)
                    ->get(['id', 'name', 'slug', 'status', 'plan_id', 'branch_limit', 'created_at']),
            ];
        }

        $scopeOrganizationId = match (true) {
            $user->isOwner() => $request->integer('organization_id') ?: null,
            $user->hasAnyRole(['admin', 'superadmin']) && ! $user->branch_id => $user->organization_id,
            default => null,
        };

        if ($user->isOwner() && $scopeOrganizationId) {
            $payload['scope']['organization_id'] = $scopeOrganizationId;
            $payload['scope']['organization_name'] = Organization::query()->whereKey($scopeOrganizationId)->value('name');
        }

        if ($scopeOrganizationId) {
            $payload['branch_comparison'] = Branch::query()
                ->where('organization_id', $scopeOrganizationId)
                ->orderBy('name')
                ->get(['id', 'name', 'city', 'is_active'])
                ->map(function (Branch $branch) {
                    $branchQuery = Submission::query()->where('branch_id', $branch->id);

                    return [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'city' => $branch->city,
                        'is_active' => $branch->is_active,
                        'responses_count' => (clone $branchQuery)->count(),
                        'flagged_count' => (clone $branchQuery)->where('is_flagged', true)->count(),
                        'average_score' => round((float) ((clone $branchQuery)->avg('overall_score') ?? 0), 2),
                    ];
                });

            $payload['case_resolution'] = $this->insights->caseResolutionMetrics($scopeOrganizationId);
            $payload['recommendations'] = $this->insights->recommendations($scopeOrganizationId);
        }

        if (($user->hasAnyRole(['superadmin', 'admin', 'staff'])) && $user->organization_id) {
            $payload['case_resolution'] = $this->insights->caseResolutionMetrics(
                (int) $user->organization_id,
                $user->branch_id
            );
            if ($user->hasAnyRole(['superadmin', 'admin'])) {
                $payload['recommendations'] = $this->insights->recommendations(
                    (int) $user->organization_id,
                    $user->branch_id
                );
            }
        }

        $trend = (clone $query)
            ->where('submitted_at', '>=', now()->subDays(13)->startOfDay())
            ->select(DB::raw('DATE(submitted_at) as day'), DB::raw('COUNT(*) as responses'), DB::raw('AVG(overall_score) as average_score'))
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $payload['trend'] = $trend;

        return response()->json($payload);
    }
}
