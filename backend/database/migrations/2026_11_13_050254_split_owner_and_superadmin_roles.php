<?php

use App\Support\RolePermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private const USER_TYPE = 'App\\Models\\User';

    /**
     * Four roles instead of three.
     *
     *  - The platform-wide "superadmin" (no organization) becomes the Owner.
     *  - Organization-wide admins (no branch) become the Superadmin of their organization.
     *  - Branch-tied admins stay Branch Admins; staff stay staff.
     */
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (array_keys(RolePermissions::catalog()) as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        $owner = Role::findOrCreate('owner', 'web');
        $superadmin = Role::findOrCreate('superadmin', 'web');
        $admin = Role::findOrCreate('admin', 'web');
        $staff = Role::findOrCreate('staff', 'web');

        $platformWide = $this->usersWithRole($superadmin->id)->whereNull('users.organization_id')->pluck('users.id');
        foreach ($platformWide as $userId) {
            $this->moveUser($userId, $superadmin->id, $owner->id);
        }

        $organizationWide = $this->usersWithRole($admin->id)
            ->whereNotNull('users.organization_id')
            ->whereNull('users.branch_id')
            ->pluck('users.id');
        foreach ($organizationWide as $userId) {
            $this->moveUser($userId, $admin->id, $superadmin->id);
        }

        $owner->syncPermissions(RolePermissions::defaults('owner'));
        $superadmin->syncPermissions(RolePermissions::defaults('superadmin'));
        $admin->syncPermissions(RolePermissions::defaults('admin'));
        $staff->syncPermissions(RolePermissions::defaults('staff'));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $owner = Role::findByName('owner', 'web');
        $superadmin = Role::findByName('superadmin', 'web');
        $admin = Role::findByName('admin', 'web');

        foreach ($this->usersWithRole($superadmin->id)->pluck('users.id') as $userId) {
            $this->moveUser($userId, $superadmin->id, $admin->id);
        }
        foreach ($this->usersWithRole($owner->id)->pluck('users.id') as $userId) {
            $this->moveUser($userId, $owner->id, $superadmin->id);
        }

        $superadmin->syncPermissions(array_keys(RolePermissions::catalog()));
        $owner->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function usersWithRole(int $roleId)
    {
        return DB::table('model_has_roles')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', self::USER_TYPE)
            ->where('model_has_roles.role_id', $roleId);
    }

    private function moveUser(int $userId, int $fromRoleId, int $toRoleId): void
    {
        $keys = ['model_type' => self::USER_TYPE, 'model_id' => $userId];

        DB::table('model_has_roles')->where($keys)->where('role_id', $fromRoleId)->delete();

        if (! DB::table('model_has_roles')->where($keys)->where('role_id', $toRoleId)->exists()) {
            DB::table('model_has_roles')->insert([...$keys, 'role_id' => $toRoleId]);
        }
    }
};
