<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
    }

    public function test_only_four_roles_exist(): void
    {
        $this->assertEqualsCanonicalizing(
            ['owner', 'superadmin', 'admin', 'staff'],
            Role::query()->pluck('name')->all()
        );
    }

    public function test_owner_can_manage_organizations_and_see_every_organization(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'owner@fms.test')->firstOrFail());

        $this->getJson('/api/v1/organizations')->assertOk();
        $this->getJson('/api/v1/plans')->assertOk();
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('role', 'owner');
    }

    public function test_branch_admin_cannot_manage_organizations_or_plans(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->getJson('/api/v1/organizations')->assertForbidden();
        $this->getJson('/api/v1/plans')->assertForbidden();
        $this->getJson('/api/v1/users')->assertOk();
    }

    public function test_branch_admin_cannot_create_a_superadmin(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->postJson('/api/v1/users', [
            'name' => 'Sneaky',
            'email' => 'sneaky@demohotel.test',
            'password' => 'password',
            'role' => 'superadmin',
        ])->assertForbidden();
    }

    public function test_staff_can_see_feedback_but_not_manage_users_or_forms(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());

        $this->getJson('/api/v1/feedback')->assertOk();
        $this->getJson('/api/v1/users')->assertForbidden();
        $this->getJson('/api/v1/forms')->assertForbidden();
    }

    public function test_signup_creates_an_organization_superadmin_not_an_owner(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'organization_name' => 'Cafe Test',
            'name' => 'Cafe Owner',
            'email' => 'owner@cafe.test',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertCreated();

        $user = User::query()->where('email', 'owner@cafe.test')->firstOrFail();

        $this->assertTrue($user->hasRole('superadmin'));
        $this->assertFalse($user->hasRole('owner'));
        $this->assertNotNull($user->organization_id);
        $this->assertNull($user->branch_id);
    }

    public function test_owner_creating_an_organization_makes_its_first_user_a_superadmin(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'owner@fms.test')->firstOrFail());

        $this->postJson('/api/v1/organizations', [
            'name' => 'Spa Test',
            'superadmin_name' => 'Spa Superadmin',
            'superadmin_email' => 'admin@spa.test',
            'superadmin_password' => 'password123',
        ])->assertCreated()->assertJsonPath('superadmin.email', 'admin@spa.test');

        $user = User::query()->where('email', 'admin@spa.test')->firstOrFail();

        $this->assertTrue($user->hasRole('superadmin'));
        $this->assertFalse($user->hasRole('owner'));
        $this->assertNotNull($user->organization_id);
        $this->assertNull($user->branch_id);
    }
}
