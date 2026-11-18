<?php

namespace App\Support;

/**
 * The four roles and what each may do by default.
 *
 *  - owner:      the platform owner; creates organizations and plans and can reach everything.
 *  - superadmin: the top account of one organization; creates its branches and team.
 *  - admin:      a branch admin (or an organization-wide admin without a branch).
 *  - staff:      staff / manager.
 *
 * Only the owner can adjust what each role is allowed to do, within the limits set here.
 */
final class RolePermissions
{
    public const ROLES = ['owner', 'superadmin', 'admin', 'staff'];

    /** Permissions that only the owner ever holds because they cross organizations. */
    private const PLATFORM_ONLY = ['manage organizations', 'manage plans'];

    /** Permissions that only the owner and superadmins may hold: they shape an organization's structure. */
    private const STRUCTURE_ONLY = ['manage branches'];

    /**
     * @return array<string, array{group: string, label: string, description: string}>
     */
    public static function catalog(): array
    {
        return [
            'manage organizations' => ['group' => 'Platform', 'label' => 'Manage organizations', 'description' => 'Create, suspend and delete organizations.'],
            'manage plans' => ['group' => 'Platform', 'label' => 'Manage plans', 'description' => 'Create and edit subscription plans and renewals.'],
            'manage branches' => ['group' => 'Branches & locations', 'label' => 'Manage branches', 'description' => 'Add, edit and deactivate branches.'],
            'manage locations' => ['group' => 'Branches & locations', 'label' => 'Manage locations & QR', 'description' => 'Add locations, connect forms and generate QR codes.'],
            'manage forms' => ['group' => 'Forms & scoring', 'label' => 'Manage forms', 'description' => 'Build forms, questions, categories and wording.'],
            'manage scoring' => ['group' => 'Forms & scoring', 'label' => 'Manage scoring', 'description' => 'Change weights, rating bands and flag rules.'],
            'view feedback' => ['group' => 'Feedback & cases', 'label' => 'View feedback', 'description' => 'Read feedback records and export them.'],
            'manage cases' => ['group' => 'Feedback & cases', 'label' => 'Manage cases', 'description' => 'Work cases: change status, add notes.'],
            'contact customers' => ['group' => 'Customers', 'label' => 'Contact customers', 'description' => 'Send email or WhatsApp messages to customers.'],
            'manage customers' => ['group' => 'Customers', 'label' => 'Add & edit customers', 'description' => 'Create and edit customer records.'],
            'view reports' => ['group' => 'Reports & settings', 'label' => 'View reports', 'description' => 'Open reports and download exports.'],
            'manage settings' => ['group' => 'Reports & settings', 'label' => 'Manage settings', 'description' => 'Branding, guest wording and domain settings.'],
            'manage users' => ['group' => 'Team', 'label' => 'Manage team', 'description' => 'Add members, change roles and reset passwords.'],
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function defaults(string $role): array
    {
        return match ($role) {
            'owner' => array_keys(self::catalog()),
            'superadmin' => array_values(array_diff(array_keys(self::catalog()), self::PLATFORM_ONLY)),
            'admin' => [
                'manage customers', 'manage locations', 'manage forms', 'manage scoring', 'manage users',
                'view feedback', 'manage cases', 'contact customers', 'view reports', 'manage settings',
            ],
            'staff' => ['view feedback', 'manage cases', 'contact customers'],
            default => [],
        };
    }

    /**
     * Permissions a role can never lose, so nobody is locked out of the screens they need to sign in and work.
     *
     * @return array<int, string>
     */
    public static function required(string $role): array
    {
        return match ($role) {
            'owner' => array_keys(self::catalog()),
            'superadmin' => ['view feedback', 'manage users', 'manage branches'],
            'admin' => ['view feedback', 'manage users'],
            default => ['view feedback'],
        };
    }

    /**
     * Permissions the owner may grant to the role.
     *
     * @return array<int, string>
     */
    public static function assignable(string $role): array
    {
        $all = array_keys(self::catalog());

        return match ($role) {
            'owner' => $all,
            'superadmin' => array_values(array_diff($all, self::PLATFORM_ONLY)),
            default => array_values(array_diff($all, self::PLATFORM_ONLY, self::STRUCTURE_ONLY)),
        };
    }

    public static function label(string $role): string
    {
        return match ($role) {
            'owner' => 'Owner',
            'superadmin' => 'Superadmin',
            'admin' => 'Branch Admin',
            default => 'Staff / Manager',
        };
    }
}
