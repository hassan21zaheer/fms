<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Location;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RecentFeedbackOrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_newest_feedback_is_listed_first_even_when_times_match(): void
    {
        $this->seed(FmsSeeder::class);
        $location = Location::query()->where('slug', 'room-101')->firstOrFail();
        $moment = now();

        $ids = collect([60, 70, 80])->map(fn (int $score) => Submission::query()->create([
            'organization_id' => 1, 'branch_id' => $location->branch_id, 'location_id' => $location->id,
            'form_id' => Form::query()->value('id'), 'overall_score' => $score, 'rating_band' => 'Good', 'submitted_at' => $moment,
        ])->id);

        Sanctum::actingAs(User::query()->where('email', 'superadmin@demohotel.test')->firstOrFail());

        $listed = collect($this->getJson('/api/v1/feedback')->assertOk()->json('data'))->pluck('id')->take(3)->all();

        $this->assertSame($ids->reverse()->values()->all(), $listed);
    }
}
