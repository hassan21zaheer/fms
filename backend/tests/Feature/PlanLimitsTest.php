<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PlanLimitsTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);
        $this->organization = Organization::query()->findOrFail(1);
    }

    public function test_the_location_limit_of_the_plan_is_enforced(): void
    {
        $this->organization->plan()->update(['location_limit' => 6]);
        $branch = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $existing = Location::query()->where('organization_id', 1)->count();
        $this->actAs('admin@demohotel.test');

        for ($i = $existing; $i < 6; $i++) {
            $this->postJson('/api/v1/locations', ['branch_id' => $branch->id, 'name' => "Desk {$i}", 'type' => 'counter'])->assertCreated();
        }

        $this->postJson('/api/v1/locations', ['branch_id' => $branch->id, 'name' => 'One too many', 'type' => 'counter'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'Location limit reached (6)'));
    }

    public function test_an_unlimited_plan_has_no_location_limit(): void
    {
        $this->organization->plan()->update(['location_limit' => null]);
        $branch = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $this->actAs('admin@demohotel.test');

        foreach (range(1, 3) as $i) {
            $this->postJson('/api/v1/locations', ['branch_id' => $branch->id, 'name' => "Free {$i}", 'type' => 'other'])->assertCreated();
        }
    }

    public function test_the_branch_limit_is_still_enforced(): void
    {
        $this->organization->update(['branch_limit' => 1]);
        $this->actAs('owner@fms.test');

        $this->postJson('/api/v1/branches', ['organization_id' => 1, 'name' => 'Second'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'Branch limit reached (1)'));
    }

    public function test_an_expired_plan_blocks_new_setup_but_not_guest_feedback(): void
    {
        $this->organization->update(['plan_expires_at' => now()->subDay(), 'branch_limit' => 10]);
        $branch = Branch::query()->where('slug', 'downtown')->firstOrFail();

        $this->actAs('owner@fms.test');
        $this->postJson('/api/v1/branches', ['organization_id' => 1, 'name' => 'Late Branch'])->assertStatus(422);

        $this->actAs('admin@demohotel.test');
        $this->postJson('/api/v1/locations', ['branch_id' => $branch->id, 'name' => 'Late Desk', 'type' => 'other'])->assertStatus(422);
        $this->postJson('/api/v1/forms', ['name' => 'Late Form'])->assertStatus(422);
        $this->postJson('/api/v1/users', [
            'name' => 'Late Staff', 'email' => 'late@demohotel.test', 'password' => 'password123', 'role' => 'staff',
        ])->assertStatus(422)->assertJsonPath('message', fn ($message) => str_contains($message, 'expired'));

        $payload = $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk()->json();
        $question = collect($payload['form']['questions'])->firstWhere('type', 'star') ?? $payload['form']['questions'][0];
        $this->postJson('/api/v1/f/demo-hotel/downtown/room-101/submit', [
            'customer_name' => 'Still Welcome',
            'answers' => [['question_id' => $question['id'], 'option_id' => $question['options'][0]['id'] ?? null, 'value' => 5, 'free_text' => 'ok']],
        ])->assertCreated();
    }

    public function test_renewing_the_plan_unblocks_setup(): void
    {
        $this->organization->update(['plan_expires_at' => now()->subDay(), 'branch_limit' => 10]);
        $this->actAs('owner@fms.test');

        $this->postJson('/api/v1/branches', ['organization_id' => 1, 'name' => 'Blocked'])->assertStatus(422);

        $this->patchJson('/api/v1/organizations/1', ['plan_expires_at' => now()->addYear()->toDateString()])
            ->assertOk()
            ->assertJsonPath('plan_status.expired', false);

        $this->postJson('/api/v1/branches', ['organization_id' => 1, 'name' => 'Unblocked'])->assertCreated();
    }

    public function test_a_plan_change_cannot_drop_below_what_is_already_in_use(): void
    {
        $tiny = Plan::query()->create(['name' => 'Tiny', 'slug' => 'tiny', 'price_monthly' => 1, 'branch_limit' => 1, 'location_limit' => 1, 'is_active' => true]);
        Branch::query()->create(['organization_id' => 1, 'name' => 'Extra', 'slug' => 'extra', 'is_active' => true]);
        $this->actAs('owner@fms.test');

        $this->patchJson('/api/v1/organizations/1', ['plan_id' => $tiny->id])->assertStatus(422);
        $this->patchJson('/api/v1/organizations/1', ['branch_limit' => 1])->assertStatus(422);
    }

    public function test_the_organization_workspace_shows_usage_plan_status_admins_and_branches(): void
    {
        $this->actAs('owner@fms.test');

        $response = $this->getJson('/api/v1/organizations/1')->assertOk();

        $this->assertSame(1, $response->json('usage.branches.used'));
        $this->assertSame(3, $response->json('usage.branches.limit'));
        $this->assertSame(50, $response->json('usage.locations.limit'));
        $this->assertFalse($response->json('plan_status.expired'));
        $this->assertSame('admin@demohotel.test', $response->json('admins.0.email'));
        $this->assertSame('Downtown', $response->json('branches.0.name'));
        $this->assertGreaterThan(0, $response->json('branches.0.members_count'));

        $this->actAs('admin@demohotel.test');
        $this->getJson('/api/v1/organizations/1')->assertForbidden();
    }

    public function test_the_plans_list_shows_how_many_organizations_use_each_plan(): void
    {
        $this->actAs('owner@fms.test');

        $rows = collect($this->getJson('/api/v1/plans')->assertOk()->json('data'))->keyBy('slug');
        $this->assertSame(1, $rows['starter']['organizations_count']);
    }

    public function test_branch_management_can_no_longer_be_given_to_branch_admins(): void
    {
        $this->actAs('owner@fms.test');
        $admin = Role::findByName('admin', 'web')->permissions->pluck('name')->all();

        $this->putJson('/api/v1/team/roles/admin/permissions', ['permissions' => [...$admin, 'manage branches']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('permissions');
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());
    }
}
