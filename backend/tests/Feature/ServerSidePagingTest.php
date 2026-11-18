<?php

namespace Tests\Feature;

use App\Models\FeedbackCase;
use App\Models\Form;
use App\Models\Location;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServerSidePagingTest extends TestCase
{
    use RefreshDatabase;

    private Location $location;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        $this->location = Location::query()->where('slug', 'room-101')->firstOrFail();
        Sanctum::actingAs(User::query()->where('email', 'superadmin@demohotel.test')->firstOrFail());
    }

    public function test_feedback_pages_reach_records_beyond_the_first_two_hundred(): void
    {
        foreach (range(1, 230) as $i) {
            $this->submission('Guest '.$i, 50 + ($i % 40), '0300'.str_pad((string) $i, 7, '0', STR_PAD_LEFT));
        }

        $first = $this->getJson('/api/v1/feedback?per_page=12&page=1')->assertOk();
        $this->assertSame(230, $first->json('total'));
        $this->assertSame(20, $first->json('last_page'));

        $last = $this->getJson('/api/v1/feedback?per_page=12&page=20')->assertOk();
        $this->assertCount(2, $last->json('data'));
    }

    public function test_feedback_search_sort_and_score_filters_run_on_the_server(): void
    {
        $this->submission('Amina Khan', 90, '03001111111');
        $this->submission('Bilal Ahmed', 30, '03002222222');
        $this->submission('Chloe Rae', 65, '03003333333', 'chloe@example.test');

        $byName = $this->getJson('/api/v1/feedback?search=bilal')->assertOk();
        $this->assertSame(['Bilal Ahmed'], collect($byName->json('data'))->pluck('customer_name')->all());

        $byPhone = $this->getJson('/api/v1/feedback?search=3003333')->assertOk();
        $this->assertSame(['Chloe Rae'], collect($byPhone->json('data'))->pluck('customer_name')->all());

        $byEmail = $this->getJson('/api/v1/feedback?search=chloe@example')->assertOk();
        $this->assertSame(1, $byEmail->json('total'));

        $lowest = $this->getJson('/api/v1/feedback?sort=score_low')->assertOk();
        $this->assertSame('Bilal Ahmed', $lowest->json('data.0.customer_name'));

        $highest = $this->getJson('/api/v1/feedback?sort=score_high')->assertOk();
        $this->assertSame('Amina Khan', $highest->json('data.0.customer_name'));

        $good = $this->getJson('/api/v1/feedback?score_min=60&score_below=80')->assertOk();
        $this->assertSame(['Chloe Rae'], collect($good->json('data'))->pluck('customer_name')->all());

        $byNumber = $this->getJson('/api/v1/feedback?search=FB-'.str_pad((string) Submission::query()->min('id'), 6, '0', STR_PAD_LEFT))->assertOk();
        $this->assertSame(1, $byNumber->json('total'));
    }

    public function test_case_lists_filter_by_search_priority_and_status_with_counts(): void
    {
        $urgent = $this->flaggedCase('Dina Shah', 'urgent');
        $this->flaggedCase('Eli Moon', 'high');

        $found = $this->getJson('/api/v1/cases?search=dina')->assertOk();
        $this->assertSame([$urgent->id], collect($found->json('data'))->pluck('id')->all());

        $byRoom = $this->getJson('/api/v1/cases?search=Room 101')->assertOk();
        $this->assertSame(2, $byRoom->json('total'));

        $byCaseNumber = $this->getJson('/api/v1/cases?search=CASE-'.(1000 + $urgent->id))->assertOk();
        $this->assertSame([$urgent->id], collect($byCaseNumber->json('data'))->pluck('id')->all());

        $high = $this->getJson('/api/v1/cases?priority=high')->assertOk();
        $this->assertSame(1, $high->json('total'));

        $this->getJson('/api/v1/cases?status=resolved')->assertOk()->assertJsonPath('total', 0);
        $this->assertSame(2, $this->getJson('/api/v1/cases?status=open')->json('counts.open'));
    }

    public function test_the_dashboard_counts_unassigned_cases_and_waiting_guests_in_the_database(): void
    {
        $this->flaggedCase('Fay Noor', 'urgent');
        $assigned = $this->flaggedCase('Gus Lane', 'high');
        $assigned->update(['assigned_to' => User::query()->where('email', 'admin@demohotel.test')->value('id')]);
        $resolved = $this->flaggedCase('Hana Ray', 'high');
        $resolved->update(['status' => 'resolved']);

        $stats = $this->getJson('/api/v1/dashboard')->assertOk()->json('stats');

        $this->assertSame(2, $stats['open_cases']);
        $this->assertSame(1, $stats['unassigned_cases']);
        $this->assertSame(2, $stats['waiting_customers']);
    }

    private function submission(string $name, int $score, string $phone, ?string $email = null): Submission
    {
        return Submission::query()->create([
            'organization_id' => 1, 'branch_id' => $this->location->branch_id, 'location_id' => $this->location->id,
            'form_id' => Form::query()->value('id'), 'customer_name' => $name, 'customer_phone' => $phone, 'customer_email' => $email,
            'overall_score' => $score, 'rating_band' => 'Good', 'submitted_at' => now(),
        ]);
    }

    private function flaggedCase(string $name, string $priority): FeedbackCase
    {
        $submission = $this->submission($name, 20, '0300'.random_int(1000000, 9999999));
        $submission->update(['is_flagged' => true]);

        return FeedbackCase::query()->create([
            'organization_id' => 1, 'branch_id' => $submission->branch_id, 'submission_id' => $submission->id,
            'status' => 'open', 'priority' => $priority,
        ]);
    }
}
