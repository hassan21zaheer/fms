<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\FeedbackCase;
use App\Models\Form;
use App\Models\Location;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CaseStatusTabsTest extends TestCase
{
    use RefreshDatabase;

    private Branch $ownBranch;

    private Branch $otherBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);

        $admin = User::query()->where('email', 'admin@demohotel.test')->firstOrFail();
        $this->ownBranch = Branch::query()->findOrFail($admin->branch_id);
        $this->otherBranch = Branch::query()->create([
            'organization_id' => $this->ownBranch->organization_id,
            'name' => 'Uptown',
            'slug' => 'uptown',
            'is_active' => true,
        ]);

        $this->makeCase($this->ownBranch, 'open');
        $this->makeCase($this->ownBranch, 'open');
        $this->makeCase($this->ownBranch, 'in_progress');
        $this->makeCase($this->ownBranch, 'resolved');
        $this->makeCase($this->otherBranch, 'resolved');
    }

    public function test_cases_list_returns_counts_for_open_in_progress_and_resolved(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->getJson('/api/v1/cases?status=open')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('counts.open', 2)
            ->assertJsonPath('counts.in_progress', 1)
            ->assertJsonPath('counts.resolved', 1);
    }

    public function test_status_filter_only_returns_that_status(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());

        $statuses = collect($this->getJson('/api/v1/cases?status=in_progress')->assertOk()->json('data'))
            ->pluck('status')
            ->unique()
            ->all();

        $this->assertSame(['in_progress'], $statuses);
    }

    public function test_superadmin_counts_include_every_branch(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'owner@fms.test')->firstOrFail());

        $this->getJson('/api/v1/cases')->assertOk()->assertJsonPath('counts.resolved', 2);
    }

    public function test_branch_users_cannot_open_another_branchs_case(): void
    {
        $otherCase = FeedbackCase::query()->where('branch_id', $this->otherBranch->id)->firstOrFail();

        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());

        $this->getJson("/api/v1/cases/{$otherCase->id}")->assertForbidden();
    }

    private function makeCase(Branch $branch, string $status): FeedbackCase
    {
        $location = Location::query()->where('branch_id', $branch->id)->first()
            ?? Location::query()->create([
                'organization_id' => $branch->organization_id,
                'branch_id' => $branch->id,
                'name' => 'Lobby',
                'slug' => 'lobby-'.$branch->id,
                'is_active' => true,
            ]);

        $submission = Submission::query()->create([
            'organization_id' => $branch->organization_id,
            'branch_id' => $branch->id,
            'location_id' => $location->id,
            'form_id' => Form::query()->where('organization_id', $branch->organization_id)->value('id'),
            'customer_name' => 'Guest',
            'overall_score' => 20,
            'rating_band' => 'Critical',
            'is_flagged' => true,
            'submitted_at' => now(),
        ]);

        return FeedbackCase::query()->create([
            'organization_id' => $branch->organization_id,
            'branch_id' => $branch->id,
            'submission_id' => $submission->id,
            'status' => $status,
        ]);
    }
}
