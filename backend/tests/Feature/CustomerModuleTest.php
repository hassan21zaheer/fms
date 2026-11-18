<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\FeedbackCase;
use App\Models\Form;
use App\Models\Location;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerModuleTest extends TestCase
{
    use RefreshDatabase;

    private Branch $downtown;

    private Branch $uptown;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);

        $this->downtown = Branch::query()->where('slug', 'downtown')->firstOrFail();
        $this->uptown = Branch::query()->create([
            'organization_id' => 1, 'name' => 'Uptown', 'slug' => 'uptown', 'is_active' => true,
        ]);
    }

    public function test_admin_adds_a_customer_and_the_phone_is_normalized(): void
    {
        $this->actAs('admin@demohotel.test');

        $this->postJson('/api/v1/customers', [
            'name' => 'Walk In',
            'phone' => '0300 111-2222',
            'email' => 'Walk.In@Example.com',
            'notes' => 'Prefers email',
        ])->assertCreated();

        $customer = Customer::query()->where('name', 'Walk In')->firstOrFail();
        $this->assertSame('03001112222', $customer->phone);
        $this->assertSame('walk.in@example.com', $customer->email);
        $this->assertSame('manual', $customer->source);
        $this->assertSame($this->downtown->id, $customer->branch_id);
        $this->assertSame(1, $customer->organization_id);
    }

    public function test_staff_cannot_add_edit_or_delete_customers(): void
    {
        $customer = $this->customer('Existing', '03005550000');
        $this->actAs('staff@demohotel.test');

        $this->postJson('/api/v1/customers', ['name' => 'Nope'])->assertForbidden();
        $this->patchJson("/api/v1/customers/{$customer->id}", ['name' => 'Changed'])->assertForbidden();
        $this->deleteJson("/api/v1/customers/{$customer->id}")->assertForbidden();
    }

    public function test_duplicate_phone_or_email_is_rejected_even_when_formatted_differently(): void
    {
        $this->customer('First', '03007778888', 'first@example.com');
        $this->actAs('admin@demohotel.test');

        $this->postJson('/api/v1/customers', ['name' => 'Second', 'phone' => '0300-777 8888'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');

        $this->postJson('/api/v1/customers', ['name' => 'Second', 'email' => 'FIRST@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_a_customer_needs_a_name_phone_or_email(): void
    {
        $this->actAs('admin@demohotel.test');

        $this->postJson('/api/v1/customers', ['notes' => 'just a note'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_list_shows_feedback_numbers_and_supports_search_and_filters(): void
    {
        $ali = $this->customer('Ali Guest', '03001230000', 'ali@example.com');
        $sara = $this->customer('Sara Only Phone', '03004560000');
        $this->submission($ali, $this->downtown, 80);
        $this->submission($ali, $this->downtown, 40, flagged: true);
        $this->actAs('owner@fms.test');

        $row = collect($this->getJson('/api/v1/customers?search=Ali')->assertOk()->json('data'))->firstWhere('id', $ali->id);
        $this->assertSame(2, $row['feedback_count']);
        $this->assertEquals(60, (int) round((float) $row['average_score']));
        $this->assertSame(1, $row['flagged_count']);

        $flagged = collect($this->getJson('/api/v1/customers?flagged=1')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($flagged->contains($ali->id));
        $this->assertFalse($flagged->contains($sara->id));

        $withEmail = collect($this->getJson('/api/v1/customers?has_email=1')->assertOk()->json('data'))->pluck('id');
        $this->assertFalse($withEmail->contains($sara->id));
    }

    public function test_branch_users_only_see_customers_from_their_branch_and_only_that_branchs_numbers(): void
    {
        $shared = $this->customer('Shared Guest', '03001110000');
        $this->submission($shared, $this->downtown, 90);
        $this->submission($shared, $this->uptown, 10, flagged: true);
        $uptownOnly = $this->customer('Uptown Only', '03002220000');
        $this->submission($uptownOnly, $this->uptown, 50);
        $addedByAdmin = Customer::query()->create([
            'organization_id' => 1, 'branch_id' => $this->downtown->id, 'name' => 'Added Here', 'phone' => '03003330000', 'source' => 'manual',
        ]);

        $this->actAs('staff@demohotel.test');
        $rows = collect($this->getJson('/api/v1/customers')->assertOk()->json('data'))->keyBy('id');

        $this->assertTrue($rows->has($shared->id));
        $this->assertTrue($rows->has($addedByAdmin->id));
        $this->assertFalse($rows->has($uptownOnly->id));
        $this->assertSame(1, $rows[$shared->id]['feedback_count']);
        $this->assertSame(0, $rows[$shared->id]['flagged_count']);

        $this->actAs('owner@fms.test');
        $all = collect($this->getJson('/api/v1/customers')->assertOk()->json('data'))->keyBy('id');
        $this->assertTrue($all->has($uptownOnly->id));
        $this->assertSame(2, $all[$shared->id]['feedback_count']);
    }

    public function test_profile_shows_stats_history_and_cases_and_respects_branch_limits(): void
    {
        $customer = $this->customer('Profile Guest', '03004440000', 'profile@example.com');
        $first = $this->submission($customer, $this->downtown, 70);
        $second = $this->submission($customer, $this->downtown, 30, flagged: true);
        FeedbackCase::query()->create([
            'organization_id' => 1, 'branch_id' => $this->downtown->id, 'submission_id' => $second->id,
            'status' => 'open', 'priority' => 'high',
        ]);
        $uptownOnly = $this->customer('Elsewhere', '03005550001');
        $this->submission($uptownOnly, $this->uptown, 60);

        $this->actAs('staff@demohotel.test');
        $this->getJson("/api/v1/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.stats.feedback_count', 2)
            ->assertJsonPath('data.stats.average_score', 50)
            ->assertJsonPath('data.stats.lowest_score', 30)
            ->assertJsonPath('data.stats.flagged_count', 1)
            ->assertJsonCount(2, 'data.submissions')
            ->assertJsonPath('data.cases.0.priority', 'high');

        $this->getJson("/api/v1/customers/{$uptownOnly->id}")->assertForbidden();
        $this->assertNotNull($first->id);
    }

    public function test_admin_can_edit_a_customer(): void
    {
        $customer = $this->customer('Old Name', '03006660000');
        $this->submission($customer, $this->downtown, 70);
        $this->actAs('admin@demohotel.test');

        $this->patchJson("/api/v1/customers/{$customer->id}", ['name' => 'New Name', 'phone' => '03006660000', 'notes' => 'VIP'])
            ->assertOk();

        $this->assertSame('New Name', $customer->fresh()->name);
        $this->assertSame('VIP', $customer->fresh()->notes);
    }

    public function test_only_a_superadmin_can_delete_and_feedback_is_kept(): void
    {
        $customer = $this->customer('To Delete', '03007770000');
        $submission = $this->submission($customer, $this->downtown, 75);

        $this->actAs('admin@demohotel.test');
        $this->deleteJson("/api/v1/customers/{$customer->id}")->assertForbidden();

        $this->actAs('owner@fms.test');
        $this->deleteJson("/api/v1/customers/{$customer->id}")->assertOk();

        $this->assertNull(Customer::query()->find($customer->id));
        $this->assertNull($submission->fresh()->customer_id);
        $this->assertNotNull($submission->fresh());
    }

    public function test_csv_export_contains_only_visible_customers(): void
    {
        $visible = $this->customer('Visible Guest', '03008880000');
        $this->submission($visible, $this->downtown, 88);
        $hidden = $this->customer('Hidden Guest', '03009990000');
        $this->submission($hidden, $this->uptown, 20);

        $this->actAs('staff@demohotel.test');
        $csv = $this->get('/api/v1/customers/export.csv')->assertOk()->streamedContent();

        $this->assertStringContainsString('feedback_count', $csv);
        $this->assertStringContainsString('Visible Guest', $csv);
        $this->assertStringNotContainsString('Hidden Guest', $csv);
    }

    public function test_a_guest_submission_matches_a_manually_added_customer(): void
    {
        $manual = Customer::query()->create([
            'organization_id' => 1, 'branch_id' => $this->downtown->id, 'name' => 'Manual Guest',
            'phone' => '03001112222', 'source' => 'manual',
        ]);
        $before = Customer::query()->count();

        $payload = $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk()->json();
        $question = collect($payload['form']['questions'])->firstWhere('type', 'star')
            ?? $payload['form']['questions'][0];

        $this->postJson('/api/v1/f/demo-hotel/downtown/room-101/submit', [
            'customer_name' => 'Manual Guest',
            'customer_phone' => '0300 111 2222',
            'answers' => [[
                'question_id' => $question['id'],
                'option_id' => $question['options'][0]['id'] ?? null,
                'value' => 5,
                'free_text' => 'Great',
            ]],
        ])->assertCreated();

        $this->assertSame($before, Customer::query()->count());
        $this->assertSame($manual->id, Submission::query()->latest('id')->value('customer_id'));
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());
    }

    private function customer(string $name, ?string $phone = null, ?string $email = null): Customer
    {
        return Customer::query()->create([
            'organization_id' => 1, 'name' => $name, 'phone' => $phone, 'email' => $email,
        ]);
    }

    private function submission(Customer $customer, Branch $branch, int $score, bool $flagged = false): Submission
    {
        $location = Location::query()->where('branch_id', $branch->id)->first()
            ?? Location::query()->create([
                'organization_id' => 1, 'branch_id' => $branch->id, 'name' => 'Lobby',
                'slug' => 'lobby-'.$branch->id, 'is_active' => true,
            ]);

        return Submission::query()->create([
            'organization_id' => 1,
            'branch_id' => $branch->id,
            'location_id' => $location->id,
            'form_id' => Form::query()->where('organization_id', 1)->value('id'),
            'customer_id' => $customer->id,
            'customer_name' => $customer->name,
            'overall_score' => $score,
            'rating_band' => 'Good',
            'is_flagged' => $flagged,
            'submitted_at' => now(),
        ]);
    }
}
