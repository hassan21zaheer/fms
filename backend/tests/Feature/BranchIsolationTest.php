<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Location;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BranchIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Branch $uptown;

    private Location $uptownLocation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);

        $this->uptown = Branch::query()->create([
            'organization_id' => 1, 'name' => 'Uptown', 'slug' => 'uptown', 'is_active' => true,
        ]);
        $this->uptownLocation = Location::query()->create([
            'organization_id' => 1, 'branch_id' => $this->uptown->id, 'name' => 'Uptown Desk',
            'slug' => 'uptown-desk', 'type' => 'counter', 'is_active' => true,
        ]);
    }

    public function test_a_branch_admin_cannot_create_a_location_in_another_branch(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->postJson('/api/v1/locations', [
            'branch_id' => $this->uptown->id, 'name' => 'Sneaky Desk', 'type' => 'other',
        ])->assertForbidden();

        $downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $this->postJson('/api/v1/locations', [
            'branch_id' => $downtown->id, 'name' => 'Own Desk', 'type' => 'other',
        ])->assertCreated();
    }

    public function test_a_branch_admin_cannot_edit_or_use_qr_codes_of_another_branchs_location(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->patchJson("/api/v1/locations/{$this->uptownLocation->id}", ['name' => 'Renamed'])->assertForbidden();
        $this->deleteJson("/api/v1/locations/{$this->uptownLocation->id}")->assertForbidden();
        $this->postJson("/api/v1/locations/{$this->uptownLocation->id}/qr")->assertForbidden();
        $this->get("/api/v1/locations/{$this->uptownLocation->id}/qr/download")->assertForbidden();
    }

    public function test_a_superadmin_can_manage_locations_in_any_branch(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'owner@fms.test')->firstOrFail());

        $this->patchJson("/api/v1/locations/{$this->uptownLocation->id}", ['name' => 'Renamed'])->assertOk();
    }

    public function test_the_same_phone_in_a_different_format_is_caught_as_a_duplicate(): void
    {
        $payload = $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk()->json();
        $question = collect($payload['form']['questions'])->firstWhere('type', 'star')
            ?? $payload['form']['questions'][0];

        $answers = [[
            'question_id' => $question['id'],
            'option_id' => $question['options'][0]['id'] ?? null,
            'value' => 5,
            'free_text' => 'Nice',
        ]];

        $this->postJson('/api/v1/f/demo-hotel/downtown/room-101/submit', [
            'customer_name' => 'Dup Guest', 'customer_phone' => '0300 555 1234', 'answers' => $answers,
        ])->assertCreated();

        $this->postJson('/api/v1/f/demo-hotel/downtown/room-101/submit', [
            'customer_name' => 'Dup Guest', 'customer_phone' => '0300-555-1234', 'answers' => $answers,
        ])->assertStatus(422)->assertJsonPath('message', fn ($message) => str_contains($message, 'Duplicate'));

        $this->assertSame('03005551234', Submission::query()->latest('id')->value('customer_phone'));
    }
}
