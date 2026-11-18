<?php

namespace Tests\Feature;

use App\Models\FeedbackCase;
use App\Models\NotificationSetting;
use App\Models\Organization;
use App\Models\User;
use App\Support\PhoneNumber;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);
    }

    public function test_a_flagged_submission_puts_an_unread_alert_in_the_bell_of_case_handlers(): void
    {
        $this->submitLowScore();

        $this->actAs('admin@demohotel.test');
        $response = $this->getJson('/api/v1/notifications')->assertOk();
        $this->assertSame(1, $response->json('unread_count'));
        $this->assertSame('flagged_feedback', $response->json('data.0.kind'));
        $this->assertFalse($response->json('data.0.read'));

        $id = $response->json('data.0.id');
        $this->postJson("/api/v1/notifications/{$id}/read")->assertOk()->assertJsonPath('unread_count', 0);

        $this->actAs('superadmin@demohotel.test');
        $this->assertSame(1, $this->getJson('/api/v1/notifications')->json('unread_count'));
        $this->postJson('/api/v1/notifications/read-all')->assertOk()->assertJsonPath('unread_count', 0);
    }

    public function test_people_only_read_their_own_notifications(): void
    {
        $this->submitLowScore();

        $this->actAs('admin@demohotel.test');
        $id = $this->getJson('/api/v1/notifications')->json('data.0.id');

        $this->actAs('superadmin@demohotel.test');
        $this->postJson("/api/v1/notifications/{$id}/read")->assertOk();
        $this->actAs('admin@demohotel.test');
        $this->assertSame(1, $this->getJson('/api/v1/notifications')->json('unread_count'));
    }

    public function test_assigning_a_case_notifies_the_assignee_but_not_the_person_assigning_themselves(): void
    {
        $this->submitLowScore();
        $case = FeedbackCase::query()->firstOrFail();
        $staff = User::query()->where('email', 'staff@demohotel.test')->firstOrFail();

        $this->actAs('admin@demohotel.test');
        $this->patchJson("/api/v1/cases/{$case->id}", ['assigned_to' => $staff->id])->assertOk();

        $this->assertSame(1, $staff->unreadNotifications()->where('data->kind', 'case_assigned')->count());

        $admin = User::query()->where('email', 'admin@demohotel.test')->firstOrFail();
        $before = $admin->notifications()->count();
        $this->patchJson("/api/v1/cases/{$case->id}", ['assigned_to' => $admin->id])->assertOk();
        $this->assertSame($before, $admin->notifications()->count());
    }

    public function test_alert_recipients_and_country_code_are_saved_per_organization(): void
    {
        $this->actAs('superadmin@demohotel.test');

        $this->patchJson('/api/v1/settings/notifications', [
            'email_on_flagged' => true,
            'notify_emails' => ['gm@demohotel.test', 'duty@demohotel.test'],
        ])->assertOk();
        $this->assertSame(
            ['gm@demohotel.test', 'duty@demohotel.test'],
            NotificationSetting::query()->where('organization_id', 1)->value('notify_emails')
        );

        $this->patchJson('/api/v1/settings/notifications', ['notify_emails' => ['not-an-email']])->assertUnprocessable();

        $this->patchJson('/api/v1/settings/organization', ['default_country_code' => '+971'])->assertOk();
        $this->assertSame('971', Organization::query()->find(1)->default_country_code);
        $this->patchJson('/api/v1/settings/organization', ['default_country_code' => 'abc'])->assertUnprocessable();
    }

    public function test_whatsapp_numbers_get_the_organization_country_code(): void
    {
        $this->assertSame('923001112222', PhoneNumber::forWhatsApp('0300 111 2222', '92'));
        $this->assertSame('923001112222', PhoneNumber::forWhatsApp('+92 300 111 2222', '971'));
        $this->assertSame('971501234567', PhoneNumber::forWhatsApp('00971 50 123 4567', '92'));
        $this->assertSame('923001112222', PhoneNumber::forWhatsApp('923001112222', '92'));
        $this->assertSame('923001112222', PhoneNumber::forWhatsApp('300 111 2222', '92'));
        $this->assertSame('', PhoneNumber::forWhatsApp(null, '92'));
    }

    private function submitLowScore(): void
    {
        $payload = $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk()->json();
        $question = collect($payload['form']['questions'])->firstWhere('type', 'star') ?? $payload['form']['questions'][0];

        $this->postJson('/api/v1/f/demo-hotel/downtown/room-101/submit', [
            'customer_name' => 'Unhappy Guest',
            'customer_phone' => '0300 111 2222',
            'answers' => [[
                'question_id' => $question['id'],
                'option_id' => $question['options'][0]['id'] ?? null,
                'value' => 1,
                'free_text' => 'Poor',
            ]],
        ])->assertCreated();

        $this->assertSame(1, FeedbackCase::query()->count());
    }

    private function actAs(string $email): void
    {
        Sanctum::actingAs(User::query()->where('email', $email)->firstOrFail());
    }
}
