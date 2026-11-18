<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->text('notes')->nullable()->after('email');
            // guest_form: created from a feedback submission, manual: added by a team member.
            $table->string('source', 20)->default('guest_form')->after('notes');
            // The branch of the team member who added the customer by hand (null for guest-form customers).
            $table->foreignId('branch_id')->nullable()->after('organization_id')->constrained()->nullOnDelete();
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permission = Permission::findOrCreate('manage customers');
        foreach (['superadmin', 'admin'] as $roleName) {
            Role::findOrCreate($roleName)->givePermissionTo($permission);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::query()->where('name', 'manage customers')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Schema::table('customers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
            $table->dropColumn(['notes', 'source']);
        });
    }
};
