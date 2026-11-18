<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Submission;

/**
 * What an organization's plan allows. Branch and location limits apply when something new is added, and an
 * expired plan stops new setup (branches, locations, forms, team members). Guests can still leave feedback
 * so no customer response is ever lost.
 */
final class PlanLimits
{
    public static function locationLimit(Organization $organization): ?int
    {
        return $organization->plan?->location_limit;
    }

    public static function isExpired(Organization $organization): bool
    {
        return $organization->plan_expires_at !== null && $organization->plan_expires_at->isPast();
    }

    public static function assertPlanActive(Organization $organization): void
    {
        abort_if(
            self::isExpired($organization),
            422,
            'The plan for '.$organization->name.' expired on '.$organization->plan_expires_at->toFormattedDateString()
                .'. Renew it before adding anything new.'
        );
    }

    public static function assertCanAddBranch(Organization $organization): void
    {
        self::assertPlanActive($organization);

        $used = $organization->branches()->count();
        abort_if(
            $used >= $organization->branch_limit,
            422,
            "Branch limit reached ({$organization->branch_limit}). Upgrade the plan to add more branches."
        );
    }

    public static function assertCanAddLocation(Organization $organization): void
    {
        self::assertPlanActive($organization);

        $limit = self::locationLimit($organization);
        abort_if(
            $limit !== null && $organization->locations()->count() >= $limit,
            422,
            "Location limit reached ({$limit}). Upgrade the plan to add more locations."
        );
    }

    /**
     * @return array{branches: array{used: int, limit: int}, locations: array{used: int, limit: int|null}, users: int, responses: int}
     */
    public static function usage(Organization $organization): array
    {
        return [
            'branches' => ['used' => $organization->branches()->count(), 'limit' => (int) $organization->branch_limit],
            'locations' => ['used' => $organization->locations()->count(), 'limit' => self::locationLimit($organization)],
            'users' => $organization->users()->count(),
            'responses' => Submission::query()->where('organization_id', $organization->id)->count(),
        ];
    }

    /**
     * @return array{expired: bool, expires_at: string|null, days_left: int|null}
     */
    public static function status(Organization $organization): array
    {
        $expiresAt = $organization->plan_expires_at;

        return [
            'expired' => self::isExpired($organization),
            'expires_at' => $expiresAt?->toIso8601String(),
            'days_left' => $expiresAt ? (int) floor(now()->diffInDays($expiresAt, false)) : null,
        ];
    }
}
