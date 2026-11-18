<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Form;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class OwnerSuperadminSplitTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $superadmin;

    private Organization $otherOrganization;

    private User $otherSuperadmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);

        $this->owner = User::query()->where('email', 'owner@fms.test')->firstOrFail();
        $this->superadmin = User::query()->where('email', 'superadmin@demohotel.test')->firstOrFail();

        $this->otherOrganization = Organization::query()->create([
            'name' => 'Other Org', 'slug' => 'other-org', 'status' => 'active',
            'plan_id' => Plan::query()->value('id'), 'branch_limit' => 3, 'plan_expires_at' => now()->addYear(),
        ]);
        $this->otherSuperadmin = $this->makeUser('superadmin', $this->otherOrganization->id, null, 'boss@other.test');
    }

    public function test_the_seeded_accounts_have_the_right_level(): void
    {
        $this->assertTrue($this->owner->hasRole('owner'));
        $this->assertNull($this->owner->organization_id);

        $this->assertTrue($this->superadmin->hasRole('superadmin'));
        $this->assertSame(1, $this->superadmin->organization_id);
        $this->assertNull($this->superadmin->branch_id);

        $counts = collect(['owner', 'superadmin', 'admin', 'staff'])
            ->mapWithKeys(fn ($role) => [$role => Role::findByName($role, 'web')->permissions->count()]);
        $this->assertSame(13, $counts['owner']);
        $this->assertSame(11, $counts['superadmin']);
        $this->assertSame(10, $counts['admin']);
        $this->assertSame(3, $counts['staff']);

        $superadminPermissions = Role::findByName('superadmin', 'web')->permissions->pluck('name');
        $this->assertTrue($superadminPermissions->contains('manage branches'));
        $this->assertFalse($superadminPermissions->contains('manage organizations'));
        $this->assertFalse($superadminPermissions->contains('manage plans'));
    }

    public function test_the_owner_migration_moves_the_old_accounts_to_the_new_roles(): void
    {
        $legacyOwner = User::query()->create([
            'organization_id' => null, 'name' => 'Legacy', 'email' => 'legacy@fms.test', 'password' => 'password', 'is_active' => true,
        ]);
        $legacyOwner->assignRole('superadmin');
        $orgWideAdmin = $this->makeUser('admin', 1, null, 'wide@demohotel.test');
        $branchAdmin = User::query()->where('email', 'admin@demohotel.test')->firstOrFail();
        $this->owner->syncRoles(['superadmin']);
        $this->superadmin->syncRoles(['admin']);

        (require database_path('migrations/2026_11_13_050254_split_owner_and_superadmin_roles.php'))->up();

        $this->assertTrue($this->owner->fresh()->hasRole('owner'));
        $this->assertFalse($this->owner->fresh()->hasRole('superadmin'));
        $this->assertTrue($legacyOwner->fresh()->hasRole('owner'));
        $this->assertTrue($this->superadmin->fresh()->hasRole('superadmin'));
        $this->assertTrue($orgWideAdmin->fresh()->hasRole('superadmin'));
        $this->assertTrue($branchAdmin->fresh()->hasRole('admin'));
        $this->assertFalse($branchAdmin->fresh()->hasRole('superadmin'));
        $this->assertTrue(User::query()->where('email', 'staff@demohotel.test')->firstOrFail()->hasRole('staff'));
    }

    public function test_a_superadmin_creates_branches_in_their_own_organization(): void
    {
        $this->actAs($this->superadmin);

        $this->postJson('/api/v1/branches', ['name' => 'Uptown', 'city' => 'Lahore'])->assertCreated();
        $this->assertSame(1, Branch::query()->where('slug', 'uptown')->value('organization_id'));

        // An organization_id in the request cannot move the branch to another organization.
        $this->postJson('/api/v1/branches', ['organization_id' => $this->otherOrganization->id, 'name' => 'Sneaky'])->assertCreated();
        $this->assertSame(1, Branch::query()->where('slug', 'sneaky')->value('organization_id'));
        $this->assertSame(0, Branch::query()->where('organization_id', $this->otherOrganization->id)->count());

        $names = collect($this->getJson('/api/v1/branches')->assertOk()->json('data'))->pluck('name');
        $this->assertTrue($names->contains('Uptown'));
        $this->assertTrue($names->contains('Downtown'));
    }

    public function test_the_plan_limits_still_apply_to_a_superadmin(): void
    {
        Organization::query()->whereKey(1)->update(['branch_limit' => 1]);
        $this->actAs($this->superadmin);

        $this->postJson('/api/v1/branches', ['name' => 'One too many'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'Branch limit reached'));

        Organization::query()->whereKey(1)->update(['branch_limit' => 5, 'plan_expires_at' => now()->subDay()]);
        $this->postJson('/api/v1/branches', ['name' => 'Too late'])->assertStatus(422);
    }

    public function test_a_superadmin_cannot_manage_organizations_plans_or_role_permissions(): void
    {
        $this->actAs($this->superadmin);

        $this->getJson('/api/v1/organizations')->assertForbidden();
        $this->postJson('/api/v1/organizations', [
            'name' => 'Nope', 'superadmin_name' => 'X', 'superadmin_email' => 'x@nope.test', 'superadmin_password' => 'password123',
        ])->assertForbidden();
        $this->patchJson('/api/v1/organizations/1', ['plan_expires_at' => now()->addYear()->toDateString()])->assertForbidden();
        $this->postJson('/api/v1/organizations/1/suspend')->assertForbidden();
        $this->getJson('/api/v1/plans')->assertForbidden();
        $this->postJson('/api/v1/plans', ['name' => 'Free'])->assertForbidden();

        $this->putJson('/api/v1/team/roles/staff/permissions', ['permissions' => ['view feedback']])->assertForbidden();
        $this->postJson('/api/v1/team/roles/staff/reset')->assertForbidden();
        $this->getJson('/api/v1/team/roles')->assertOk()->assertJsonPath('can_edit', false);
    }

    public function test_a_superadmin_sees_only_their_own_organization_workspace(): void
    {
        $this->actAs($this->superadmin);

        $this->getJson('/api/v1/organizations/1')
            ->assertOk()
            ->assertJsonPath('usage.branches.limit', 3);
        $this->getJson("/api/v1/organizations/{$this->otherOrganization->id}")->assertForbidden();

        $this->actAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $this->getJson('/api/v1/organizations/1')->assertForbidden();

        $this->actAs($this->owner);
        $this->getJson("/api/v1/organizations/{$this->otherOrganization->id}")->assertOk();
    }

    public function test_the_owner_creating_an_organization_creates_its_superadmin(): void
    {
        $this->actAs($this->owner);

        $this->postJson('/api/v1/organizations', [
            'name' => 'Fresh Cafe', 'superadmin_name' => 'Cafe Boss', 'superadmin_email' => 'boss@fresh.test', 'superadmin_password' => 'password123',
        ])->assertCreated()->assertJsonPath('superadmin.email', 'boss@fresh.test');

        $boss = User::query()->where('email', 'boss@fresh.test')->firstOrFail();
        $this->assertTrue($boss->hasRole('superadmin'));
        $this->assertNull($boss->branch_id);
        $this->assertNotNull($boss->organization_id);
    }

    public function test_superadmins_build_their_team_but_cannot_create_owners(): void
    {
        $this->actAs($this->superadmin);

        foreach (['superadmin', 'admin', 'staff'] as $role) {
            $this->postJson('/api/v1/users', [
                'name' => ucfirst($role), 'email' => "{$role}.new@demohotel.test", 'password' => 'password123', 'role' => $role,
                'branch_id' => Branch::query()->where('slug', 'downtown')->value('id'),
            ])->assertCreated();
        }

        $this->assertNull(User::query()->where('email', 'superadmin.new@demohotel.test')->value('branch_id'));
        $this->assertSame(1, User::query()->where('email', 'admin.new@demohotel.test')->value('organization_id'));

        $this->postJson('/api/v1/users', [
            'name' => 'Boss', 'email' => 'boss@demohotel.test', 'password' => 'password123', 'role' => 'owner',
        ])->assertForbidden();

        $roles = collect($this->getJson('/api/v1/team/options')->assertOk()->json('roles'))->pluck('value')->all();
        $this->assertSame(['superadmin', 'admin', 'staff'], $roles);
    }

    public function test_the_hierarchy_protects_higher_roles(): void
    {
        $branchAdmin = User::query()->where('email', 'admin@demohotel.test')->firstOrFail();

        $this->actAs($branchAdmin);
        $this->postJson('/api/v1/users', [
            'name' => 'X', 'email' => 'x@demohotel.test', 'password' => 'password123', 'role' => 'superadmin',
        ])->assertForbidden();
        $this->patchJson("/api/v1/users/{$this->superadmin->id}", ['name' => 'Hacked'])->assertForbidden();

        $this->actAs($this->superadmin);
        $this->getJson("/api/v1/users/{$this->owner->id}")->assertForbidden();
        $this->patchJson("/api/v1/users/{$this->owner->id}", ['name' => 'Hacked'])->assertForbidden();
        $this->deleteJson("/api/v1/users/{$this->owner->id}")->assertForbidden();
        $this->getJson("/api/v1/users/{$this->otherSuperadmin->id}")->assertForbidden();

        $emails = collect($this->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('email');
        $this->assertFalse($emails->contains('owner@fms.test'));
        $this->assertFalse($emails->contains('boss@other.test'));
    }

    public function test_a_superadmin_can_delete_staff_but_not_another_superadmin_or_an_owner(): void
    {
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();
        $colleague = $this->makeUser('superadmin', 1, null, 'colleague@demohotel.test');

        $this->actAs($this->superadmin);
        $this->deleteJson("/api/v1/users/{$colleague->id}")->assertForbidden();
        $this->deleteJson("/api/v1/users/{$staff->id}")->assertOk();
        $this->deleteJson("/api/v1/users/{$this->superadmin->id}")->assertStatus(422);

        $this->actAs($this->owner);
        $this->deleteJson("/api/v1/users/{$colleague->id}")->assertOk();
    }

    public function test_the_owner_cannot_be_demoted_or_removed_as_the_last_owner_and_can_add_owners(): void
    {
        $this->actAs($this->owner);

        $this->patchJson("/api/v1/users/{$this->owner->id}", ['role' => 'superadmin'])->assertStatus(422);
        $this->deleteJson("/api/v1/users/{$this->owner->id}")->assertStatus(422);

        $this->postJson('/api/v1/users', [
            'name' => 'Second Owner', 'email' => 'owner2@fms.test', 'password' => 'password123', 'role' => 'owner',
        ])->assertCreated();
        $second = User::query()->where('email', 'owner2@fms.test')->firstOrFail();
        $this->assertNull($second->organization_id);

        $this->patchJson("/api/v1/users/{$second->id}", ['is_active' => false])->assertOk();
    }

    public function test_a_superadmin_sees_every_branch_of_their_organization_but_nothing_else(): void
    {
        $uptown = Branch::query()->create(['organization_id' => 1, 'name' => 'Uptown', 'slug' => 'uptown', 'is_active' => true]);
        $downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $own = $this->submission(1, $downtown, 'Downtown Guest');
        $other = $this->submission(1, $uptown, 'Uptown Guest');
        $foreign = $this->foreignSubmission();

        $this->actAs($this->superadmin);
        $ids = collect($this->getJson('/api/v1/feedback')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($own->id));
        $this->assertTrue($ids->contains($other->id));
        $this->assertFalse($ids->contains($foreign->id));
        $this->getJson("/api/v1/feedback/{$foreign->id}")->assertForbidden();
        $this->getJson('/api/v1/reports/overview')->assertOk()->assertJsonPath('kpis.responses.value', 2);

        $this->actAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $adminIds = collect($this->getJson('/api/v1/feedback')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($adminIds->contains($own->id));
        $this->assertFalse($adminIds->contains($other->id));

        $this->actAs($this->otherSuperadmin);
        $this->getJson("/api/v1/feedback/{$own->id}")->assertForbidden();
        $this->assertSame(1, $this->getJson('/api/v1/feedback')->assertOk()->json('total'));
    }

    public function test_the_dashboard_matches_each_level(): void
    {
        $this->actAs($this->owner);
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('role', 'owner')->assertJsonStructure(['platform' => ['organizations_count']]);

        $this->actAs($this->superadmin);
        $response = $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('role', 'superadmin');
        $this->assertArrayHasKey('branch_comparison', $response->json());
        $this->assertArrayNotHasKey('platform', $response->json());
    }

    public function test_superadmins_can_delete_customers_but_branch_admins_cannot(): void
    {
        $customer = Customer::query()->create(['organization_id' => 1, 'name' => 'To Remove', 'phone' => '03000000001']);
        $downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $this->submission(1, $downtown, 'To Remove', $customer);

        $this->actAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $this->deleteJson("/api/v1/customers/{$customer->id}")->assertForbidden();

        $this->actAs($this->superadmin);
        $this->deleteJson("/api/v1/customers/{$customer->id}")->assertOk();
    }

    public function test_only_the_owner_edits_role_permissions_within_the_limits(): void
    {
        $this->actAs($this->owner);
        $admin = Role::findByName('admin', 'web')->permissions->pluck('name')->all();
        $superadmin = Role::findByName('superadmin', 'web')->permissions->pluck('name')->all();

        $this->putJson('/api/v1/team/roles/admin/permissions', ['permissions' => [...$admin, 'manage branches']])->assertStatus(422);
        $this->putJson('/api/v1/team/roles/superadmin/permissions', ['permissions' => [...$superadmin, 'manage plans']])->assertStatus(422);
        $this->putJson('/api/v1/team/roles/superadmin/permissions', ['permissions' => array_values(array_diff($superadmin, ['manage branches']))])->assertStatus(422);
        $this->putJson('/api/v1/team/roles/owner/permissions', ['permissions' => ['view feedback']])->assertStatus(422);

        $without = array_values(array_diff($superadmin, ['manage customers']));
        $this->putJson('/api/v1/team/roles/superadmin/permissions', ['permissions' => $without])->assertOk();

        $this->actAs($this->superadmin);
        $this->postJson('/api/v1/customers', ['name' => 'Blocked'])->assertForbidden();

        $this->actAs($this->owner);
        $this->postJson('/api/v1/team/roles/superadmin/reset')->assertOk();
        $this->actAs($this->superadmin);
        $this->postJson('/api/v1/customers', ['name' => 'Allowed'])->assertCreated();
    }

    private function actAs(User $user): void
    {
        Sanctum::actingAs($user);
    }

    private function makeUser(string $role, ?int $organizationId, ?int $branchId, string $email): User
    {
        $user = User::query()->create([
            'organization_id' => $organizationId, 'branch_id' => $branchId, 'name' => ucfirst($role).' '.uniqid(),
            'email' => $email, 'password' => 'password', 'is_active' => true,
        ]);
        $user->assignRole($role);

        return $user;
    }

    private function submission(int $organizationId, Branch $branch, string $name, ?Customer $customer = null): Submission
    {
        $location = Location::query()->where('branch_id', $branch->id)->first()
            ?? Location::query()->create([
                'organization_id' => $organizationId, 'branch_id' => $branch->id, 'name' => 'Desk '.$branch->id,
                'slug' => 'desk-'.$branch->id, 'type' => 'counter', 'is_active' => true,
            ]);

        return Submission::query()->create([
            'organization_id' => $organizationId,
            'branch_id' => $branch->id,
            'location_id' => $location->id,
            'form_id' => Form::query()->where('organization_id', 1)->value('id'),
            'customer_id' => $customer?->id,
            'customer_name' => $name,
            'overall_score' => 80,
            'rating_band' => 'Excellent',
            'submitted_at' => now(),
        ]);
    }

    private function foreignSubmission(): Submission
    {
        $branch = Branch::query()->create([
            'organization_id' => $this->otherOrganization->id, 'name' => 'Foreign', 'slug' => 'foreign', 'is_active' => true,
        ]);
        $location = Location::query()->create([
            'organization_id' => $this->otherOrganization->id, 'branch_id' => $branch->id, 'name' => 'Foreign Desk',
            'slug' => 'foreign-desk', 'type' => 'counter', 'is_active' => true,
        ]);
        $form = Form::query()->create(['organization_id' => $this->otherOrganization->id, 'name' => 'Foreign form', 'is_active' => true]);

        return Submission::query()->create([
            'organization_id' => $this->otherOrganization->id, 'branch_id' => $branch->id, 'location_id' => $location->id,
            'form_id' => $form->id, 'customer_name' => 'Foreign Guest', 'overall_score' => 70, 'rating_band' => 'Good',
            'submitted_at' => now(),
        ]);
    }
}
