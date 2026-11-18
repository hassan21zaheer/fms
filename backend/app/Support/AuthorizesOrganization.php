<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

trait AuthorizesOrganization
{
    protected function assertSameOrganization(User $user, Model $model): void
    {
        if ($user->isOwner()) {
            return;
        }

        abort_unless(
            (int) $user->organization_id === (int) $model->getAttribute('organization_id'),
            403
        );
    }

    /** Branch-level users may only touch their own branch; superadmins and organization-wide admins may touch any. */
    protected function assertBranchAccess(User $user, int $branchId): void
    {
        if ($user->branch_id && ! $user->isOwner()) {
            abort_unless((int) $user->branch_id === $branchId, 403);
        }
    }

    protected function scopedToUserOrganization(Builder $query, User $user, string $column = 'organization_id'): Builder
    {
        if ($user->isOwner()) {
            return $query;
        }

        return $query->where($column, $user->organization_id);
    }

    protected function resolveOrganizationId(User $user, ?int $requested = null): int
    {
        if ($user->isOwner()) {
            $organizationId = $requested ?: $user->organization_id;
            abort_unless($organizationId, 422, 'organization_id is required.');

            return (int) $organizationId;
        }

        abort_unless($user->organization_id, 403);

        return (int) $user->organization_id;
    }
}
