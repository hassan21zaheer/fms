<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class TeamModuleTest extends TestCase
{
    use RefreshDatabase;

    private Branch $downtown;

    private Branch $uptown;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);

        $this->downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $this->uptown = Branch::query()->create([
            'organization_id' => 1, 'name' => 'Uptown', 'slug' => 'uptown', 'is_active' => true,
        ]);
    }

    public function test_member_list_shows_branch_status_and_supports_filters(): void
    {
        $this->actAs('owner@fms.test');

        $rows = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->keyBy('email');
        $this->assertSame('Downtown', $rows['admin@demohotel.test']['branch_name']);
        $this->assertSame('staff', $rows['staff@demohotel.test']['role']);

        $staffOnly = collect($this->getJson('/api/v1/users?role=staff')->assertOk()->json('data'))->pluck('email');
        $this->assertTrue($staffOnly->contains('staff@demohotel.test'));
        $this->assertFalse($staffOnly->contains('admin@demohotel.test'));

        $found = $this->getJson('/api/v1/users?search=owner')->assertOk()->json('data');
        $this->assertCount(1, $found);
    }

    public function test_a_branch_admin_only_manages_people_in_their_branch(): void
    {
        $other = $this->makeUser('staff', $this->uptown->id);
        $this->actAs('admin@demohotel.test');

        $emails = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('email');
        $this->assertTrue($emails->contains('staff@demohotel.test'));
        $this->assertFalse($emails->contains($other->email));
        $this->assertFalse($emails->contains('owner@fms.test'));

        $this->patchJson("/api/v1/users/{$other->id}", ['name' => 'Hacked'])->assertForbidden();
        $this->postJson("/api/v1/users/{$other->id}/password", ['password' => 'newpassword1'])->assertForbidden();
    }

    public function test_an_organization_wide_admin_sees_every_branch(): void
    {
        $orgAdmin = $this->makeUser('admin', null);
        $uptownStaff = $this->makeUser('staff', $this->uptown->id);
        Sanctum::actingAs($orgAdmin);

        $emails = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('email');
        $this->assertTrue($emails->contains($uptownStaff->email));
        $this->assertTrue($emails->contains('staff@demohotel.test'));
    }

    public function test_a_branch_admin_adds_staff_into_their_own_branch_only(): void
    {
        $this->actAs('admin@demohotel.test');

        $this->postJson('/api/v1/users', [
            'name' => 'New Staff', 'email' => 'New.Staff@Demohotel.test', 'phone' => '0300 5550000',
            'password' => 'password123', 'role' => 'staff', 'branch_id' => $this->uptown->id,
        ])->assertCreated();

        $member = User::query()->where('email', 'new.staff@demohotel.test')->firstOrFail();
        $this->assertSame($this->downtown->id, $member->branch_id);
        $this->assertTrue($member->hasRole('staff'));
        $this->assertSame(1, $member->organization_id);

        $this->postJson('/api/v1/users', [
            'name' => 'Sneaky', 'email' => 'sneaky@demohotel.test', 'password' => 'password123', 'role' => 'superadmin',
        ])->assertForbidden();

        $this->postJson('/api/v1/users', [
            'name' => 'Duplicate', 'email' => 'new.staff@demohotel.test', 'password' => 'password123', 'role' => 'staff',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_an_owner_can_add_another_owner_and_branches_must_match_the_organization(): void
    {
        $otherOrg = Organization::query()->create(['name' => 'Other Org', 'slug' => 'other-org', 'status' => 'active']);
        $foreignBranch = Branch::query()->create([
            'organization_id' => $otherOrg->id, 'name' => 'Foreign', 'slug' => 'foreign', 'is_active' => true,
        ]);
        $this->actAs('owner@fms.test');

        $this->postJson('/api/v1/users', [
            'name' => 'Second Boss', 'email' => 'boss2@fms.test', 'password' => 'password123', 'role' => 'owner',
        ])->assertCreated();

        $boss = User::query()->where('email', 'boss2@fms.test')->firstOrFail();
        $this->assertNull($boss->organization_id);
        $this->assertNull($boss->branch_id);

        $this->postJson('/api/v1/users', [
            'organization_id' => 1, 'name' => 'Wrong Branch', 'email' => 'wrong@demohotel.test',
            'password' => 'password123', 'role' => 'staff', 'branch_id' => $foreignBranch->id,
        ])->assertStatus(422)->assertJsonValidationErrors('branch_id');
    }

    public function test_roles_and_branches_can_be_changed_but_not_your_own_role(): void
    {
        $orgAdmin = $this->makeUser('admin', null);
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();
        Sanctum::actingAs($orgAdmin);

        $this->patchJson("/api/v1/users/{$staff->id}", ['role' => 'admin', 'branch_id' => $this->uptown->id])->assertOk();
        $staff->refresh();
        $this->assertTrue($staff->hasRole('admin'));
        $this->assertSame($this->uptown->id, $staff->branch_id);

        $this->patchJson("/api/v1/users/{$orgAdmin->id}", ['role' => 'staff'])->assertStatus(422);
        $this->patchJson("/api/v1/users/{$orgAdmin->id}", ['is_active' => false])->assertStatus(422);
    }

    public function test_deactivating_a_member_signs_them_out_everywhere(): void
    {
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();
        $staff->createToken('admin');
        $staff->createToken('admin');
        $this->assertSame(2, $staff->tokens()->count());

        $this->actAs('admin@demohotel.test');
        $this->patchJson("/api/v1/users/{$staff->id}", ['is_active' => false])->assertOk();

        $this->assertFalse($staff->fresh()->is_active);
        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_resetting_a_password_replaces_it_and_signs_the_member_out(): void
    {
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();
        $staff->createToken('admin');

        $admin = User::query()->where('email', 'admin@demohotel.test')->firstOrFail();
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/users/{$staff->id}/password", ['password' => 'short'])->assertStatus(422);
        $this->postJson("/api/v1/users/{$staff->id}/password", ['password' => 'brandnewpass1'])->assertOk();
        $this->postJson("/api/v1/users/{$admin->id}/password", ['password' => 'brandnewpass1'])->assertStatus(422);

        $this->assertTrue(Hash::check('brandnewpass1', $staff->fresh()->password));
        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_sessions_can_be_revoked_and_shown(): void
    {
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();
        $staff->createToken('admin');
        $this->actAs('admin@demohotel.test');

        $this->getJson("/api/v1/users/{$staff->id}")
            ->assertOk()
            ->assertJsonPath('data.sessions_count', 1)
            ->assertJsonCount(1, 'data.sessions')
            ->assertJsonFragment(['view feedback']);

        $this->postJson("/api/v1/users/{$staff->id}/sessions/revoke")->assertOk();
        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_only_a_superadmin_can_delete_a_member(): void
    {
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();

        $this->actAs('admin@demohotel.test');
        $this->deleteJson("/api/v1/users/{$staff->id}")->assertForbidden();

        $this->actAs('owner@fms.test');
        $this->deleteJson('/api/v1/users/'.User::query()->where('email', 'owner@fms.test')->value('id'))->assertStatus(422);
        $this->deleteJson("/api/v1/users/{$staff->id}")->assertOk();
        $this->assertNull(User::query()->find($staff->id));
    }

    public function test_last_login_is_recorded_when_someone_signs_in(): void
    {
        $this->assertNull(User::query()->where('email', 'staff@demohotel.test')->value('last_login_at'));

        $this->postJson('/api/v1/auth/login', ['email' => 'staff@demohotel.test', 'password' => 'password'])->assertOk();

        $this->assertNotNull(User::query()->where('email', 'staff@demohotel.test')->value('last_login_at'));
    }

    public function test_team_options_follow_the_signed_in_role(): void
    {
        $this->actAs('admin@demohotel.test');
        $this->getJson('/api/v1/team/options')
            ->assertOk()
            ->assertJsonPath('branch_locked', true)
            ->assertJsonCount(1, 'branches')
            ->assertJsonCount(2, 'roles');

        $this->actAs('owner@fms.test');
        $this->getJson('/api/v1/team/options')
            ->assertOk()
            ->assertJsonPath('branch_locked', false)
            ->assertJsonCount(4, 'roles');
    }

    public function test_roles_tab_lists_four_roles_with_member_counts(): void
    {
        $this->actAs('owner@fms.test');

        $response = $this->getJson('/api/v1/team/roles')->assertOk()->assertJsonPath('can_edit', true);
        $roles = collect($response->json('roles'))->keyBy('name');

        $this->assertCount(4, $roles);
        $this->assertTrue($roles['owner']['locked']);
        $this->assertFalse($roles['superadmin']['locked']);
        $this->assertSame(1, $roles['owner']['member_count']);
        $this->assertContains('manage users', $roles['admin']['permissions']);
        $this->assertCount(13, $response->json('catalog'));

        $this->actAs('admin@demohotel.test');
        $this->getJson('/api/v1/team/roles')->assertOk()->assertJsonPath('can_edit', false);
    }

    public function test_a_superadmin_can_change_role_permissions_and_it_takes_effect(): void
    {
        $this->actAs('staff@demohotel.test');
        $this->getJson('/api/v1/reports/export.csv')->assertForbidden();

        $this->actAs('owner@fms.test');
        $defaults = Role::findByName('staff', 'web')->permissions->pluck('name')->all();
        $this->putJson('/api/v1/team/roles/staff/permissions', ['permissions' => [...$defaults, 'view reports']])->assertOk();

        $this->actAs('staff@demohotel.test');
        $this->getJson('/api/v1/reports/export.csv')->assertOk();

        $this->actAs('owner@fms.test');
        $this->postJson('/api/v1/team/roles/staff/reset')->assertOk();

        $this->actAs('staff@demohotel.test');
        $this->getJson('/api/v1/reports/export.csv')->assertForbidden();
    }

    public function test_role_permission_changes_are_limited_and_protected(): void
    {
        $this->actAs('owner@fms.test');
        $admin = Role::findByName('admin', 'web')->permissions->pluck('name')->all();

        $this->putJson('/api/v1/team/roles/admin/permissions', ['permissions' => [...$admin, 'manage organizations']])
            ->assertStatus(422)->assertJsonValidationErrors('permissions');

        $this->putJson('/api/v1/team/roles/staff/permissions', ['permissions' => ['manage cases']])
            ->assertStatus(422)->assertJsonValidationErrors('permissions');

        $this->putJson('/api/v1/team/roles/owner/permissions', ['permissions' => ['view feedback']])->assertStatus(422);

        $this->actAs('admin@demohotel.test');
        $this->putJson('/api/v1/team/roles/staff/permissions', ['permissions' => ['view feedback']])->assertForbidden();
    }

    public function test_staff_cannot_open_the_team_module(): void
    {
        $this->actAs('staff@demohotel.test');

        $this->getJson('/api/v1/users')->assertForbidden();
        $this->getJson('/api/v1/team/roles')->assertForbidden();
        $this->getJson('/api/v1/team/options')->assertForbidden();
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());
    }

    private function makeUser(string $role, ?int $branchId): User
    {
        $user = User::query()->create([
            'organization_id' => 1,
            'branch_id' => $branchId,
            'name' => ucfirst($role).' '.uniqid(),
            'email' => uniqid($role.'-').'@demohotel.test',
            'password' => 'password',
            'is_active' => true,
        ]);
        $user->assignRole($role);

        return $user;
    }
}
