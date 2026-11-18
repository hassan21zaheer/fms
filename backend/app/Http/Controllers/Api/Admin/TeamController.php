<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\User;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class TeamController extends Controller
{
    /** What the signed-in user can choose when adding or editing a member. */
    public function options(Request $request): JsonResponse
    {
        $auth = $request->user();

        $branches = Branch::query()
            ->with('organization:id,name')
            ->when(! $auth->isOwner(), fn ($q) => $q->where('organization_id', $auth->organization_id))
            ->when($auth->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($auth->hasRole('admin') && $auth->branch_id, fn ($q) => $q->whereKey($auth->branch_id))
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'organization_id' => $branch->organization_id,
                'organization_name' => $branch->organization?->name,
            ]);

        $roles = collect(match (true) {
            $auth->isOwner() => RolePermissions::ROLES,
            $auth->isSuperadmin() => ['superadmin', 'admin', 'staff'],
            default => ['admin', 'staff'],
        })
            ->map(fn ($role) => ['value' => $role, 'label' => RolePermissions::label($role)])
            ->values();

        return response()->json([
            'branches' => $branches,
            'roles' => $roles,
            'branch_locked' => (bool) ($auth->hasRole('admin') && $auth->branch_id),
        ]);
    }

    /** The three roles with their permissions, member counts and the permission catalog. */
    public function roles(Request $request): JsonResponse
    {
        $auth = $request->user();

        $members = User::query()
            ->with('roles:id,name')
            ->when(! $auth->isOwner(), fn ($q) => $q->where('organization_id', $auth->organization_id))
            ->get();

        $roles = collect(RolePermissions::ROLES)->map(function (string $name) use ($members) {
            $role = Role::findByName($name, 'web');

            return [
                'name' => $name,
                'label' => RolePermissions::label($name),
                'locked' => $name === 'owner',
                'permissions' => $role->permissions->pluck('name')->values(),
                'defaults' => RolePermissions::defaults($name),
                'required' => RolePermissions::required($name),
                'assignable' => RolePermissions::assignable($name),
                'member_count' => $members->filter(fn (User $user) => $user->hasRole($name))->count(),
            ];
        });

        $catalog = collect(RolePermissions::catalog())->map(fn ($item, $key) => ['key' => $key, ...$item])->values();

        return response()->json([
            'roles' => $roles,
            'catalog' => $catalog,
            'can_edit' => $auth->isOwner(),
        ]);
    }

    public function updateRolePermissions(Request $request, string $role): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);
        abort_if($role === 'owner', 422, 'The owner always has every permission.');

        $data = $request->validate([
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
        ]);

        $permissions = collect($data['permissions'])->unique()->values();

        $notAllowed = $permissions->diff(RolePermissions::assignable($role));
        if ($notAllowed->isNotEmpty()) {
            throw ValidationException::withMessages([
                'permissions' => ['These permissions cannot be given to this role: '.$notAllowed->implode(', ').'.'],
            ]);
        }

        $missing = collect(RolePermissions::required($role))->diff($permissions);
        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'permissions' => ['This role must keep: '.$missing->implode(', ').'.'],
            ]);
        }

        Role::findByName($role, 'web')->syncPermissions($permissions->all());

        return $this->roles($request);
    }

    public function resetRolePermissions(Request $request, string $role): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403);
        abort_if($role === 'owner', 422, 'The owner always has every permission.');

        Role::findByName($role, 'web')->syncPermissions(RolePermissions::defaults($role));

        return $this->roles($request);
    }
}
