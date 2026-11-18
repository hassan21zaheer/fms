<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Form;
use App\Models\Location;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FeedbackExportTest extends TestCase
{
    use RefreshDatabase;

    private Submission $ownBranchSubmission;

    private Submission $otherBranchSubmission;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);

        $admin = User::query()->where('email', 'admin@demohotel.test')->firstOrFail();
        $otherBranch = Branch::query()->create([
            'organization_id' => $admin->organization_id,
            'name' => 'Uptown',
            'slug' => 'uptown',
            'is_active' => true,
        ]);

        $this->ownBranchSubmission = $this->makeSubmission($admin->branch_id, 'Own Branch Guest');
        $this->otherBranchSubmission = $this->makeSubmission($otherBranch->id, 'Other Branch Guest');
    }

    public function test_every_role_can_export_the_feedback_table_as_csv_and_pdf(): void
    {
        foreach (['owner@fms.test', 'admin@demohotel.test', 'staff@demohotel.test'] as $email) {
            Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());

            $csv = $this->get('/api/v1/feedback/export.csv');
            $csv->assertOk();
            $this->assertStringContainsString('customer_name', $csv->streamedContent());

            $this->get('/api/v1/feedback/export.pdf')->assertOk()->assertHeader('content-type', 'application/pdf');
        }
    }

    public function test_branch_users_only_export_their_own_branch(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());

        $content = $this->get('/api/v1/feedback/export.csv')->streamedContent();

        $this->assertStringContainsString('Own Branch Guest', $content);
        $this->assertStringNotContainsString('Other Branch Guest', $content);
    }

    public function test_superadmin_exports_every_branch(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'owner@fms.test')->firstOrFail());

        $content = $this->get('/api/v1/feedback/export.csv')->streamedContent();

        $this->assertStringContainsString('Own Branch Guest', $content);
        $this->assertStringContainsString('Other Branch Guest', $content);
    }

    public function test_single_record_export_respects_branch_access(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());

        $this->get("/api/v1/feedback/{$this->ownBranchSubmission->id}/export.csv")->assertOk();
        $this->get("/api/v1/feedback/{$this->ownBranchSubmission->id}/export.pdf")->assertOk();
        $this->get("/api/v1/feedback/{$this->otherBranchSubmission->id}/export.csv")->assertForbidden();
        $this->get("/api/v1/feedback/{$this->otherBranchSubmission->id}/export.pdf")->assertForbidden();
    }

    private function makeSubmission(int $branchId, string $customerName): Submission
    {
        $branch = Branch::query()->findOrFail($branchId);
        $location = Location::query()->where('branch_id', $branchId)->first()
            ?? Location::query()->create([
                'organization_id' => $branch->organization_id,
                'branch_id' => $branchId,
                'name' => 'Lobby',
                'slug' => 'lobby-'.$branchId,
                'is_active' => true,
            ]);

        return Submission::query()->create([
            'organization_id' => $branch->organization_id,
            'branch_id' => $branchId,
            'location_id' => $location->id,
            'form_id' => Form::query()->where('organization_id', $branch->organization_id)->value('id'),
            'customer_name' => $customerName,
            'overall_score' => 80,
            'rating_band' => 'Excellent',
            'submitted_at' => now(),
        ]);
    }
}
