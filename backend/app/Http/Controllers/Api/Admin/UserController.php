<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Organization;
use App\Models\User;
use App\Support\AuthorizesOrganization;
use App\Support\PlanLimits;
use App\Support\RolePermissions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    use AuthorizesOrganization;

    public function index(Request $request): JsonResponse
    {
        $users = $this->visibleUsers($request)
            ->with(['roles:id,name', 'branch:id,name', 'organization:id,name'])
            ->withCount('tokens')
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = '%'.$request->string('search').'%';
                $q->where(fn ($inner) => $inner->where('name', 'like', $search)->orWhere('email', 'like', $search));
            })
            ->when($request->filled('role'), fn ($q) => $q->role($request->string('role')->toString()))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('is_active', $request->string('status')->toString() === 'active'))
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->present($user));

        return response()->json(['data' => $users]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeTarget($request->user(), $user);
        $user->load(['roles:id,name', 'branch:id,name', 'organization:id,name'])->loadCount('tokens');

        return response()->json([
            'data' => [
                ...$this->present($user),
                'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values(),
                'sessions' => $user->tokens()->latest('last_used_at')->get(['id', 'name', 'last_used_at', 'created_at']),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $auth = $request->user();

        $data = $request->validate([
            'organization_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:120', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(RolePermissions::ROLES)],
            'is_active' => ['boolean'],
        ]);

        $this->assertMayGrantRole($auth, $data['role']);

        if ($data['role'] === 'owner') {
            $organizationId = null;
            $branchId = null;
        } else {
            $organizationId = $this->resolveOrganizationId($auth, $request->integer('organization_id') ?: null);
            PlanLimits::assertPlanActive(Organization::query()->findOrFail($organizationId));
            $branchId = match (true) {
                $data['role'] === 'superadmin' => null,
                $auth->hasRole('admin') && $auth->branch_id => $auth->branch_id,
                default => $this->validatedBranchId($data['branch_id'] ?? null, $organizationId),
            };
        }

        $user = User::query()->create([
            'organization_id' => $organizationId,
            'branch_id' => $branchId,
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
            'is_active' => $data['is_active'] ?? true,
        ]);
        $user->assignRole($data['role']);

        return response()->json([
            'data' => $this->present($user->load(['roles:id,name', 'branch:id,name', 'organization:id,name'])->loadCount('tokens')),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();
        $this->authorizeTarget($auth, $user);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:40'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'role' => ['sometimes', Rule::in(RolePermissions::ROLES)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $role = $data['role'] ?? null;
        unset($data['role']);

        if ($role !== null && $role !== $user->getRoleNames()->first()) {
            abort_if($auth->id === $user->id, 422, 'You cannot change your own role.');
            abort_if($user->isOwner(), 422, 'The owner cannot be changed to another role here.');
            $this->assertMayGrantRole($auth, $role);
        }

        if (array_key_exists('is_active', $data) && ! $data['is_active']) {
            abort_if($auth->id === $user->id, 422, 'You cannot deactivate your own account.');
            $this->assertNotLastOwner($user);
        }

        if (isset($data['email'])) {
            $data['email'] = strtolower(trim($data['email']));
        }

        if ($role === 'owner') {
            $data['organization_id'] = null;
            $data['branch_id'] = null;
        } elseif ($role === 'superadmin') {
            $data['branch_id'] = null;
        } elseif (array_key_exists('branch_id', $data)) {
            if ($auth->hasRole('admin') && $auth->branch_id) {
                unset($data['branch_id']);
            } elseif ($user->isOwner() || $user->isSuperadmin() || $user->organization_id === null) {
                unset($data['branch_id']);
            } else {
                $data['branch_id'] = $this->validatedBranchId($data['branch_id'], (int) $user->organization_id);
            }
        }

        $user->update($data);

        if ($role !== null && ! $user->hasRole($role)) {
            $user->syncRoles([$role]);
        }

        if (array_key_exists('is_active', $data) && ! $data['is_active']) {
            $user->tokens()->delete();
        }

        return response()->json([
            'data' => $this->present($user->fresh()->load(['roles:id,name', 'branch:id,name', 'organization:id,name'])->loadCount('tokens')),
        ]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();
        $this->authorizeTarget($auth, $user);
        abort_if($auth->id === $user->id, 422, 'Use Change password to change your own password.');

        $data = $request->validate(['password' => ['required', 'string', 'min:8']]);

        $user->update(['password' => $data['password']]);
        $user->tokens()->delete();

        return response()->json(['message' => 'Password reset. The member has been signed out everywhere.']);
    }

    public function revokeSessions(Request $request, User $user): JsonResponse
    {
        $this->authorizeTarget($request->user(), $user);

        $user->tokens()->delete();

        return response()->json(['message' => 'Signed out everywhere.']);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();
        abort_unless($auth->hasAnyRole(['owner', 'superadmin']), 403);
        $this->authorizeTarget($auth, $user);
        abort_if($auth->id === $user->id, 422, 'You cannot delete yourself.');
        abort_if($auth->isSuperadmin() && $user->isSuperadmin(), 403, 'Only the owner can delete a superadmin.');
        $this->assertNotLastOwner($user);

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    /**
     * Team members the signed-in user may manage: everyone for a superadmin (or one organization), the
     * organization for an admin, and only their own branch for a branch-level admin.
     *
     * @return Builder<User>
     */
    private function visibleUsers(Request $request): Builder
    {
        $auth = $request->user();

        return User::query()
            ->when(! $auth->isOwner(), fn ($q) => $q->where('organization_id', $auth->organization_id))
            ->when($auth->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($auth->hasRole('admin') && $auth->branch_id, fn ($q) => $q->where('branch_id', $auth->branch_id));
    }

    private function authorizeTarget(User $auth, User $target): void
    {
        $this->assertSameOrganization($auth, $target);

        if ($auth->isOwner()) {
            return;
        }

        abort_if($target->isOwner(), 403);

        if ($auth->hasRole('admin')) {
            abort_if($target->isSuperadmin(), 403);

            if ($auth->branch_id) {
                abort_unless((int) $target->branch_id === (int) $auth->branch_id, 403);
            }
        }
    }

    /** Owners may grant any role, superadmins any role inside their organization except owner, admins only staff and admins. */
    private function assertMayGrantRole(User $auth, string $role): void
    {
        if ($auth->isOwner()) {
            return;
        }

        $allowed = $auth->isSuperadmin() ? ['superadmin', 'admin', 'staff'] : ['admin', 'staff'];

        abort_unless(in_array($role, $allowed, true), 403);
    }

    private function assertNotLastOwner(User $target): void
    {
        if (! $target->isOwner()) {
            return;
        }

        $others = User::query()->role('owner')->where('is_active', true)->where('id', '!=', $target->id)->count();

        abort_if($others === 0, 422, 'This is the last active owner and cannot be deactivated or deleted.');
    }

    private function validatedBranchId(?int $branchId, ?int $organizationId): ?int
    {
        if ($branchId === null) {
            return null;
        }

        $belongs = Branch::query()->whereKey($branchId)->where('organization_id', $organizationId)->exists();

        if (! $belongs) {
            throw ValidationException::withMessages(['branch_id' => ['That branch does not belong to this organization.']]);
        }

        return $branchId;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'organization_id' => $user->organization_id,
            'organization_name' => $user->organization?->name,
            'branch_id' => $user->branch_id,
            'branch_name' => $user->branch?->name,
            'is_active' => $user->is_active,
            'roles' => $user->getRoleNames(),
            'role' => $user->getRoleNames()->first(),
            'last_login_at' => $user->last_login_at,
            'sessions_count' => $user->tokens_count ?? $user->tokens()->count(),
            'created_at' => $user->created_at,
        ];
    }
}
