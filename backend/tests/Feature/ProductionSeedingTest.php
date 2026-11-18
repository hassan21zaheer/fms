<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProductionSeedingTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_seeding_creates_no_demo_accounts_and_no_default_password(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->runSeeder();

        $this->assertSame(0, Organization::query()->count());
        $this->assertSame(['owner@fms.test'], User::query()->pluck('email')->all());

        $owner = User::query()->firstOrFail();
        $this->assertTrue($owner->hasRole('owner'));
        $this->assertFalse(Hash::check('password', $owner->password));
    }

    public function test_seeding_again_in_production_does_not_reset_the_owner(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->runSeeder();
        $hash = User::query()->firstOrFail()->password;

        $this->runSeeder();

        $this->assertSame($hash, User::query()->firstOrFail()->password);
    }

    private function runSeeder(): void
    {
        $this->app->make(FmsSeeder::class)->run();
    }

    public function test_local_seeding_still_creates_the_demo_accounts(): void
    {
        $this->runSeeder();

        $this->assertTrue(User::query()->where('email', 'superadmin@demohotel.test')->exists());
    }
}
