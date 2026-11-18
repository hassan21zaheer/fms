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

class ReportsModuleTest extends TestCase
{
    use RefreshDatabase;

    private Branch $downtown;

    private Branch $uptown;

    private Location $downtownDesk;

    private Location $uptownDesk;

    private Location $emptyDesk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);

        $this->downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $this->uptown = Branch::query()->create(['organization_id' => 1, 'name' => 'Uptown', 'slug' => 'uptown', 'is_active' => true]);

        $this->downtownDesk = $this->location($this->downtown, 'Main Desk');
        $this->uptownDesk = $this->location($this->uptown, 'Uptown Desk');
        $this->emptyDesk = $this->location($this->downtown, 'Quiet Corner');

        $s1 = $this->submission($this->downtown, $this->downtownDesk, 80, false, now()->subDays(2), [['Room', 100, 1], ['Staff', 60, 1]]);
        $s2 = $this->submission($this->downtown, $this->downtownDesk, 40, true, now()->subDay(), [['Room', 20, 3], ['Staff', 60, 1]]);
        $s3 = $this->submission($this->uptown, $this->uptownDesk, 90, false, now()->subDays(3), [['Room', 90, 1]]);
        $this->submission($this->downtown, $this->downtownDesk, 70, false, now()->subDays(40), [['Room', 70, 1]]);

        $this->case($this->downtown, $s2, 'open', 'high', now()->subHours(3));
        $this->case($this->downtown, $s1, 'resolved', 'medium', now()->subDays(5), now()->subDays(2));
        $this->case($this->uptown, $s3, 'open', 'urgent', now()->subDays(10));
    }

    public function test_overview_shows_kpis_with_a_comparison_to_the_previous_period(): void
    {
        $this->actAs('owner@fms.test');

        $response = $this->getJson('/api/v1/reports/overview')->assertOk();

        $this->assertSame(3, $response->json('kpis.responses.value'));
        $this->assertSame(1, $response->json('kpis.responses.previous'));
        $this->assertEquals(200.0, $response->json('kpis.responses.change_percent'));
        $this->assertSame(70, $response->json('kpis.average_score.value'));
        $this->assertSame(1, $response->json('kpis.flagged.value'));
        $this->assertEquals(33.3, $response->json('kpis.flagged.rate_percent'));
        $this->assertSame(2, $response->json('kpis.open_cases'));
        $this->assertSame(1, $response->json('kpis.resolved_cases'));
        $this->assertEquals(72.0, $response->json('kpis.avg_resolution_hours'));
        $this->assertSame(3, collect($response->json('trend'))->sum('responses'));
        $this->assertCount(30, $response->json('trend'));

        $bands = collect($response->json('bands'))->pluck('count', 'label');
        $this->assertSame(2, $bands['Excellent']);
        $this->assertSame(1, $bands['Needs Attention']);
    }

    public function test_the_branch_filter_and_date_range_narrow_the_numbers(): void
    {
        $this->actAs('owner@fms.test');

        $this->getJson("/api/v1/reports/overview?branch_id={$this->downtown->id}")
            ->assertOk()->assertJsonPath('kpis.responses.value', 2);

        $from = now()->subDays(45)->toDateString();
        $to = now()->subDays(35)->toDateString();
        $this->getJson("/api/v1/reports/overview?from={$from}&to={$to}")
            ->assertOk()->assertJsonPath('kpis.responses.value', 1);
    }

    public function test_a_branch_admin_only_sees_their_own_branch(): void
    {
        $this->actAs('admin@demohotel.test');

        $this->getJson('/api/v1/reports/overview')->assertOk()->assertJsonPath('kpis.responses.value', 2);
        $this->getJson("/api/v1/reports/overview?branch_id={$this->uptown->id}")->assertOk()->assertJsonPath('kpis.responses.value', 2);

        $names = collect($this->getJson('/api/v1/reports/branches')->assertOk()->json('branches'))->pluck('name');
        $this->assertSame(['Downtown'], $names->all());

        $filters = collect($this->getJson('/api/v1/reports/filters')->assertOk()->json('branches'))->pluck('name');
        $this->assertSame(['Downtown'], $filters->all());
    }

    public function test_category_scores_are_weighted_and_compared_with_the_previous_period(): void
    {
        $this->actAs('owner@fms.test');

        $rows = collect($this->getJson('/api/v1/reports/categories')->assertOk()->json('categories'))->keyBy('category');

        $this->assertSame(50, $rows['Room']['average_score']);
        $this->assertSame(60, $rows['Staff']['average_score']);
        $this->assertSame(70, $rows['Room']['previous_score']);
        $this->assertSame(-20, $rows['Room']['change']);
        $this->assertSame('Room', $this->getJson('/api/v1/reports/categories')->json('categories.0.category'));

        $questions = $this->getJson('/api/v1/reports/categories')->json('questions');
        $this->assertNotEmpty($questions);
        $this->assertLessThanOrEqual(15, count($questions));
    }

    public function test_branch_comparison_includes_flag_rate_cases_and_resolution_time(): void
    {
        $this->actAs('owner@fms.test');

        $rows = collect($this->getJson('/api/v1/reports/branches')->assertOk()->json('branches'))->keyBy('name');

        $this->assertSame(2, $rows['Downtown']['responses']);
        $this->assertSame(60, $rows['Downtown']['average_score']);
        $this->assertSame(1, $rows['Downtown']['flagged']);
        $this->assertEquals(50.0, $rows['Downtown']['flag_rate_percent']);
        $this->assertSame(1, $rows['Downtown']['open_cases']);
        $this->assertSame(1, $rows['Downtown']['resolved_cases']);
        $this->assertEquals(72.0, $rows['Downtown']['avg_resolution_hours']);
        $this->assertSame(90, $rows['Uptown']['average_score']);
        $this->assertSame(1, $rows['Uptown']['open_cases']);

        $this->assertSame('Uptown', $this->getJson('/api/v1/reports/branches')->json('branches.0.name'));
    }

    public function test_branches_without_feedback_still_appear(): void
    {
        $empty = Branch::query()->create(['organization_id' => 1, 'name' => 'Silent', 'slug' => 'silent', 'is_active' => true]);
        $this->actAs('owner@fms.test');

        $row = collect($this->getJson('/api/v1/reports/branches')->json('branches'))->firstWhere('id', $empty->id);

        $this->assertSame(0, $row['responses']);
        $this->assertNull($row['average_score']);
        $this->assertNull($row['flag_rate_percent']);
    }

    public function test_location_report_lists_every_location_with_its_numbers(): void
    {
        $this->actAs('owner@fms.test');

        $rows = collect($this->getJson('/api/v1/reports/locations')->assertOk()->json('locations'))->keyBy('name');

        $this->assertSame(2, $rows['Main Desk']['responses']);
        $this->assertSame(60, $rows['Main Desk']['average_score']);
        $this->assertSame(1, $rows['Main Desk']['flagged']);
        $this->assertSame(0, $rows['Quiet Corner']['responses']);
        $this->assertNull($rows['Quiet Corner']['average_score']);
        $this->assertSame('Downtown', $rows['Main Desk']['branch_name']);

        $one = $this->getJson("/api/v1/reports/locations?location_id={$this->uptownDesk->id}")->json('locations');
        $this->assertCount(1, $one);
    }

    public function test_cases_summary_counts_status_priority_aging_and_resolution(): void
    {
        $this->actAs('owner@fms.test');

        $response = $this->getJson('/api/v1/reports/cases')->assertOk();

        $this->assertSame(3, $response->json('total'));
        $this->assertSame(['open' => 2, 'in_progress' => 0, 'resolved' => 1], $response->json('by_status'));
        $this->assertSame(['urgent' => 1, 'high' => 1, 'medium' => 1], $response->json('by_priority'));
        $this->assertEquals(72.0, $response->json('avg_resolution_hours'));
        $this->assertEquals(33.3, $response->json('resolution_rate_percent'));
        $this->assertSame(2, $response->json('unresolved_now'));
        $this->assertSame(10, $response->json('oldest_unresolved_days'));

        $aging = collect($response->json('aging'))->pluck('count', 'label');
        $this->assertSame(1, $aging['Over 7 days']);
        $this->assertSame(1, $aging['Under 1 day']);
        $this->assertCount(2, $response->json('by_branch'));
    }

    public function test_staff_can_open_the_case_numbers_for_their_branch_but_not_the_other_reports(): void
    {
        $this->actAs('staff@demohotel.test');

        $this->getJson('/api/v1/reports/cases')->assertOk()->assertJsonPath('total', 2);
        $this->getJson('/api/v1/reports/filters')->assertOk();
        $this->getJson('/api/v1/reports/overview')->assertForbidden();
        $this->getJson('/api/v1/reports/categories')->assertForbidden();
        $this->getJson('/api/v1/reports/branches')->assertForbidden();
        $this->getJson('/api/v1/reports/locations')->assertForbidden();
    }

    public function test_the_summary_report_works_with_the_portable_resolution_time(): void
    {
        $this->actAs('admin@demohotel.test');

        $this->getJson('/api/v1/reports/summary')->assertOk()->assertJsonPath('case_resolution.resolved_cases', 1);
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());
    }

    private function location(Branch $branch, string $name): Location
    {
        return Location::query()->create([
            'organization_id' => 1, 'branch_id' => $branch->id, 'name' => $name,
            'slug' => str($name)->slug()->toString(), 'type' => 'counter', 'is_active' => true,
        ]);
    }

    /**
     * @param  array<int, array{0: string, 1: int, 2: int}>  $answers  category, score, weight
     */
    private function submission(Branch $branch, Location $location, int $score, bool $flagged, $when, array $answers): Submission
    {
        $submission = Submission::query()->create([
            'organization_id' => 1,
            'branch_id' => $branch->id,
            'location_id' => $location->id,
            'form_id' => Form::query()->where('organization_id', 1)->value('id'),
            'customer_name' => 'Guest',
            'overall_score' => $score,
            'rating_band' => $score >= 80 ? 'Excellent' : ($score >= 60 ? 'Good' : ($score >= 40 ? 'Needs Attention' : 'Critical')),
            'is_flagged' => $flagged,
            'submitted_at' => $when,
        ]);

        foreach ($answers as [$category, $answerScore, $weight]) {
            $submission->answers()->create([
                'question_text_snapshot' => "How was the {$category}?",
                'question_type_snapshot' => 'single_choice',
                'score_snapshot' => $answerScore,
                'weight_snapshot' => $weight,
                'category_name_snapshot' => $category,
            ]);
        }

        return $submission;
    }

    private function case(Branch $branch, Submission $submission, string $status, string $priority, $created, $resolved = null): FeedbackCase
    {
        $case = FeedbackCase::query()->create([
            'organization_id' => 1, 'branch_id' => $branch->id, 'submission_id' => $submission->id,
            'status' => $status, 'priority' => $priority,
        ]);
        $case->forceFill(['created_at' => $created, 'resolved_at' => $resolved])->save();

        return $case;
    }
}
