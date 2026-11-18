<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationSetting;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\ScoringSetting;
use App\Models\User;
use App\Support\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrganizationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);

        return response()->json([
            'data' => Organization::query()
                ->with('plan:id,name,slug,branch_limit,location_limit,price_monthly')
                ->withCount(['branches', 'locations', 'users'])
                ->orderBy('name')
                ->get()
                ->map(fn (Organization $organization) => [
                    ...$organization->toArray(),
                    'plan_status' => PlanLimits::status($organization),
                ]),
        ]);
    }

    /** One organization with its usage, plan status, admins and branches, for the organization workspace. */
    public function show(Request $request, Organization $organization): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->isOwner() || ((int) $user->organization_id === (int) $organization->id && $user->hasPermissionTo('manage branches', 'web')),
            403
        );
        $organization->load('plan');

        $branches = $organization->branches()->withCount('locations')->orderBy('name')->get();
        $membersByBranch = User::query()
            ->where('organization_id', $organization->id)
            ->selectRaw('branch_id, COUNT(*) as total')
            ->groupBy('branch_id')
            ->pluck('total', 'branch_id');

        $admins = User::query()
            ->where('organization_id', $organization->id)
            ->role(['superadmin', 'admin'])
            ->with(['branch:id,name', 'roles:id,name'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->getRoleNames()->first(),
                'branch_name' => $user->branch?->name,
                'is_active' => $user->is_active,
                'last_login_at' => $user->last_login_at,
            ]);

        return response()->json([
            'data' => $organization,
            'usage' => PlanLimits::usage($organization),
            'plan_status' => PlanLimits::status($organization),
            'admins' => $admins,
            'branches' => $branches->map(fn ($branch) => [
                ...$branch->toArray(),
                'members_count' => (int) ($membersByBranch[$branch->id] ?? 0),
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'unique:organizations,slug'],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'branch_limit' => ['integer', 'min:1'],
            'superadmin_name' => ['required', 'string', 'max:120'],
            'superadmin_email' => ['required', 'email', 'unique:users,email'],
            'superadmin_password' => ['required', 'string', 'min:8'],
        ]);

        $result = DB::transaction(function () use ($data) {
            $plan = isset($data['plan_id']) ? Plan::query()->find($data['plan_id']) : Plan::query()->where('slug', 'starter')->first();

            $org = Organization::query()->create([
                'plan_id' => $plan?->id,
                'name' => $data['name'],
                'slug' => $data['slug'] ?? Str::slug($data['name']),
                'branch_limit' => $data['branch_limit'] ?? $plan?->branch_limit ?? 3,
                'plan_expires_at' => now()->addMonth(),
                'welcome_text' => 'We value your feedback',
                'thank_you_text' => 'Thank you for your feedback!',
                'privacy_note' => 'Your feedback helps us improve. We protect your personal data.',
            ]);

            ScoringSetting::query()->create([
                'organization_id' => $org->id,
                ...ScoringSetting::defaults(),
            ]);

            NotificationSetting::query()->create([
                'organization_id' => $org->id,
                'email_on_flagged' => true,
                'notify_emails' => [$data['superadmin_email']],
            ]);

            $firstAdmin = User::query()->create([
                'organization_id' => $org->id,
                'name' => $data['superadmin_name'],
                'email' => $data['superadmin_email'],
                'password' => Hash::make($data['superadmin_password']),
                'is_active' => true,
            ]);
            $firstAdmin->assignRole('superadmin');

            return compact('org', 'firstAdmin');
        });

        return response()->json([
            'data' => $result['org']->load('plan'),
            'superadmin' => [
                'id' => $result['firstAdmin']->id,
                'email' => $result['firstAdmin']->email,
            ],
        ], 201);
    }

    public function update(Request $request, Organization $organization): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(['active', 'suspended'])],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'branch_limit' => ['sometimes', 'integer', 'min:1'],
            'plan_expires_at' => ['nullable', 'date'],
        ]);

        if (array_key_exists('plan_id', $data) && $data['plan_id']) {
            $plan = Plan::query()->findOrFail($data['plan_id']);
            $data['branch_limit'] = $data['branch_limit'] ?? $plan->branch_limit;

            $locationsUsed = $organization->locations()->count();
            abort_if(
                $plan->location_limit !== null && $locationsUsed > $plan->location_limit,
                422,
                "{$organization->name} already has {$locationsUsed} locations, but the {$plan->name} plan allows {$plan->location_limit}."
            );
        }

        if (isset($data['branch_limit'])) {
            $branchesUsed = $organization->branches()->count();
            abort_if(
                $data['branch_limit'] < $branchesUsed,
                422,
                "{$organization->name} already has {$branchesUsed} branches, so the limit cannot be set below that."
            );
        }

        $organization->update($data);

        return response()->json([
            'data' => $organization->fresh('plan'),
            'plan_status' => PlanLimits::status($organization->fresh('plan')),
        ]);
    }

    public function suspend(Request $request, Organization $organization): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);
        $organization->update(['status' => 'suspended']);

        return response()->json(['message' => 'Organization suspended', 'data' => $organization->fresh('plan')]);
    }

    public function activate(Request $request, Organization $organization): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);
        $organization->update(['status' => 'active']);

        return response()->json(['message' => 'Organization activated', 'data' => $organization->fresh('plan')]);
    }

    public function destroy(Request $request, Organization $organization): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);
        $organization->delete();

        return response()->json(['message' => 'Organization soft-deleted']);
    }

    public function restore(Request $request, int $organization): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);

        $org = Organization::withTrashed()->findOrFail($organization);
        $org->restore();
        if ($org->status === 'suspended') {
            // keep suspended unless explicitly activated
        }

        return response()->json(['message' => 'Organization restored', 'data' => $org->fresh('plan')]);
    }
}
