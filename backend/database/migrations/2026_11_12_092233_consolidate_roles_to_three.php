<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const ALL_PERMISSIONS = [
        'manage organizations',
        'manage plans',
        'manage branches',
        'manage locations',
        'manage forms',
        'manage scoring',
        'manage users',
        'view feedback',
        'manage cases',
        'contact customers',
        'view reports',
        'manage settings',
    ];

    private const ADMIN_PERMISSIONS = [
        'manage locations',
        'manage forms',
        'manage scoring',
        'manage users',
        'view feedback',
        'manage cases',
        'contact customers',
        'view reports',
        'manage settings',
    ];

    private const STAFF_PERMISSIONS = [
        'view feedback',
        'manage cases',
        'contact customers',
    ];

    /**
     * Collapse the five legacy roles into superadmin, admin and staff.
     *
     * Organization-bound superadmins become admins so they keep their organization-wide view but do not
     * gain access to other organizations. Platform owners become the all-access superadmin. Managers
     * become staff.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::ALL_PERMISSIONS as $permission) {
            Permission::findOrCreate($permission);
        }

        $superadmin = Role::findOrCreate('superadmin');
        $admin = Role::findOrCreate('admin');
        $staff = Role::findOrCreate('staff');

        $roleIds = Role::query()->pluck('id', 'name');

        $demoteToAdmin = DB::table('model_has_roles')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->where('model_has_roles.role_id', $roleIds['superadmin'])
            ->whereNotNull('users.organization_id')
            ->pluck('users.id');

        foreach ($demoteToAdmin as $userId) {
            $this->moveUser($userId, $roleIds['superadmin'], $roleIds['admin']);
        }

        $this->moveAllUsers($roleIds['platform_owner'] ?? null, $roleIds['superadmin']);
        $this->moveAllUsers($roleIds['manager'] ?? null, $roleIds['staff']);

        $superadmin->syncPermissions(self::ALL_PERMISSIONS);
        $admin->syncPermissions(self::ADMIN_PERMISSIONS);
        $staff->syncPermissions(self::STAFF_PERMISSIONS);

        Role::query()->whereIn('name', ['platform_owner', 'manager'])->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Role::findOrCreate('platform_owner')->syncPermissions(self::ALL_PERMISSIONS);
        Role::findOrCreate('manager')->syncPermissions(self::ADMIN_PERMISSIONS);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function moveAllUsers(?int $fromRoleId, int $toRoleId): void
    {
        if (! $fromRoleId) {
            return;
        }

        $userIds = DB::table('model_has_roles')
            ->where('model_type', 'App\\Models\\User')
            ->where('role_id', $fromRoleId)
            ->pluck('model_id');

        foreach ($userIds as $userId) {
            $this->moveUser($userId, $fromRoleId, $toRoleId);
        }
    }

    private function moveUser(int $userId, int $fromRoleId, int $toRoleId): void
    {
        $keys = ['model_type' => 'App\\Models\\User', 'model_id' => $userId];

        DB::table('model_has_roles')->where($keys)->where('role_id', $fromRoleId)->delete();

        if (! DB::table('model_has_roles')->where($keys)->where('role_id', $toRoleId)->exists()) {
            DB::table('model_has_roles')->insert([...$keys, 'role_id' => $toRoleId]);
        }
    }
};
