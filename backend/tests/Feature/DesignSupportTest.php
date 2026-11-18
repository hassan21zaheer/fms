<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\FeedbackCase;
use App\Models\Form;
use App\Models\FormCategory;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DesignSupportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);
    }

    public function test_opening_the_guest_form_counts_a_scan_of_the_location(): void
    {
        $location = Location::query()->where('slug', 'room-101')->firstOrFail();
        $this->assertSame(0, (int) $location->scans_count);

        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk();
        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk();

        $location->refresh();
        $this->assertSame(2, (int) $location->scans_count);
        $this->assertNotNull($location->last_scan_at);

        $this->actAs('admin@demohotel.test');
        $row = collect($this->getJson('/api/v1/locations')->assertOk()->json('data'))->firstWhere('id', $location->id);
        $this->assertSame(2, $row['scans_count']);
    }

    public function test_the_response_rate_counts_scans_in_the_chosen_period(): void
    {
        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk();
        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk();
        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk();
        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk();

        $this->assertSame(4, DB::table('location_scans')->count());

        $this->actAs('superadmin@demohotel.test');
        $today = now()->toDateString();

        $overview = $this->getJson("/api/v1/reports/overview?from={$today}&to={$today}")->assertOk();
        $this->assertSame(4, $overview->json('kpis.scans.value'));
        $this->assertNotNull($overview->json('kpis.response_rate_percent') ?? 0);

        $past = now()->subDays(20)->toDateString();
        $earlier = now()->subDays(10)->toDateString();
        $empty = $this->getJson("/api/v1/reports/overview?from={$past}&to={$earlier}")->assertOk();
        $this->assertSame(0, $empty->json('kpis.scans.value'));
        $this->assertNull($empty->json('kpis.response_rate_percent'));
    }

    public function test_translated_organization_wording_reaches_the_guest_messages(): void
    {
        $this->actAs('superadmin@demohotel.test');
        $organization = Organization::query()->findOrFail(1);
        $organization->update(['welcome_text' => 'Welcome', 'thank_you_text' => 'Thanks']);
        Form::query()->where('organization_id', 1)->update(['welcome_text' => null, 'thank_you_text' => null]);

        $this->postJson('/api/v1/translations', [
            'translatable_type' => 'organization', 'translatable_id' => 1, 'locale' => 'ur', 'field' => 'welcome_text', 'value' => 'خوش آمدید',
        ])->assertOk();

        $this->getJson('/api/v1/f/demo-hotel/downtown/room-101?locale=ur')
            ->assertOk()
            ->assertJsonPath('messages.welcome_text', 'خوش آمدید')
            ->assertJsonPath('messages.thank_you_text', 'Thanks');
    }

    public function test_company_details_can_be_saved_and_read_back(): void
    {
        $this->actAs('superadmin@demohotel.test');

        $this->patchJson('/api/v1/settings/organization', [
            'tagline' => 'Stay well', 'support_email' => 'help@demo.test', 'support_phone' => '0300 1112222', 'address' => '1 Main Road',
        ])->assertOk();

        $org = Organization::query()->findOrFail(1);
        $this->assertSame('Stay well', $org->tagline);
        $this->assertSame('help@demo.test', $org->support_email);

        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('organization.tagline', 'Stay well');
        $this->patchJson('/api/v1/settings/organization', ['support_email' => 'not-an-email'])->assertStatus(422);
    }

    public function test_categories_can_carry_an_icon_and_a_colour(): void
    {
        $this->actAs('admin@demohotel.test');
        $form = Form::query()->where('organization_id', 1)->orderBy('id')->firstOrFail();

        $created = $this->postJson("/api/v1/forms/{$form->id}/categories", ['name' => 'Pool', 'icon' => 'waves', 'color' => '#38bdf8'])
            ->assertCreated();
        $id = $created->json('data.id');

        $this->patchJson("/api/v1/categories/{$id}", ['color' => '#10b981'])->assertOk();

        $category = FormCategory::query()->findOrFail($id);
        $this->assertSame('waves', $category->icon);
        $this->assertSame('#10b981', $category->color);
    }

    public function test_branch_list_includes_room_and_table_counts_manager_and_average_score(): void
    {
        $downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        Location::query()->create(['organization_id' => 1, 'branch_id' => $downtown->id, 'name' => 'T1', 'slug' => 't1', 'type' => 'table', 'is_active' => true]);
        $location = Location::query()->where('branch_id', $downtown->id)->first();
        Submission::query()->create([
            'organization_id' => 1, 'branch_id' => $downtown->id, 'location_id' => $location->id,
            'form_id' => Form::query()->value('id'), 'overall_score' => 80, 'rating_band' => 'Excellent', 'submitted_at' => now(),
        ]);

        $this->actAs('superadmin@demohotel.test');
        $row = collect($this->getJson('/api/v1/branches')->assertOk()->json('data'))->firstWhere('id', $downtown->id);

        $this->assertSame(1, $row['tables_count']);
        $this->assertSame(80, $row['average_score']);
        $this->assertSame('Branch Admin', $row['manager_name']);
        $this->assertGreaterThanOrEqual(1, $row['rooms_count']);
    }

    public function test_a_pdf_with_every_qr_code_can_be_downloaded(): void
    {
        $this->actAs('admin@demohotel.test');

        $response = $this->get('/api/v1/locations/qr-sheet')->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));

        $this->actAs('staff@demohotel.test');
        $this->get('/api/v1/locations/qr-sheet')->assertForbidden();
    }

    public function test_cases_can_be_assigned_to_people_in_the_same_organization_only(): void
    {
        $downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $location = Location::query()->where('branch_id', $downtown->id)->firstOrFail();
        $submission = Submission::query()->create([
            'organization_id' => 1, 'branch_id' => $downtown->id, 'location_id' => $location->id,
            'form_id' => Form::query()->value('id'), 'overall_score' => 20, 'rating_band' => 'Critical', 'is_flagged' => true, 'submitted_at' => now(),
        ]);
        $case = FeedbackCase::query()->create([
            'organization_id' => 1, 'branch_id' => $downtown->id, 'submission_id' => $submission->id, 'status' => 'open', 'priority' => 'urgent',
        ]);
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();
        $otherOrg = Organization::query()->create(['name' => 'Elsewhere', 'slug' => 'elsewhere', 'status' => 'active']);
        $stranger = User::query()->create(['organization_id' => $otherOrg->id, 'name' => 'Stranger', 'email' => 'stranger@else.test', 'password' => 'password', 'is_active' => true]);

        $this->actAs('staff@demohotel.test');
        $people = collect($this->getJson('/api/v1/cases/assignees')->assertOk()->json('data'))->pluck('email');
        $this->assertTrue($people->contains('staff@demohotel.test'));
        $this->assertTrue($people->contains('superadmin@demohotel.test'));
        $this->assertFalse($people->contains('stranger@else.test'));
        $this->assertFalse($people->contains('owner@fms.test'));

        $this->patchJson("/api/v1/cases/{$case->id}", ['assigned_to' => $staff->id])->assertOk();
        $this->assertSame($staff->id, $case->fresh()->assigned_to);

        $this->patchJson("/api/v1/cases/{$case->id}", ['assigned_to' => $stranger->id])->assertStatus(422);
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());
    }
}
