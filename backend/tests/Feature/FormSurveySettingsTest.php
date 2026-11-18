<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormCategory;
use App\Models\Organization;
use App\Models\Question;
use App\Models\ScoringSetting;
use App\Models\Submission;
use App\Models\User;
use App\Services\ScoringService;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FormSurveySettingsTest extends TestCase
{
    use RefreshDatabase;

    private const PUBLIC_URL = '/api/v1/f/demo-hotel/downtown/room-101';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);
    }

    public function test_admin_can_save_customer_fields_extra_fields_and_wording(): void
    {
        $form = $this->demoForm();
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->patchJson("/api/v1/forms/{$form->id}", [
            'customer_fields' => ['name' => 'required', 'phone' => 'hidden', 'email' => 'optional'],
            'extra_fields' => [
                ['label' => 'Room number', 'type' => 'text', 'mode' => 'required'],
                ['label' => 'Meal', 'type' => 'dropdown', 'mode' => 'optional', 'options' => ['Breakfast', 'Dinner']],
            ],
            'welcome_title' => 'Hello there',
            'thank_you_text' => 'See you soon!',
        ])->assertOk();

        $form->refresh();

        $this->assertSame('required', $form->customer_fields['name']);
        $this->assertSame('room_number', $form->extra_fields[0]['key']);
        $this->assertSame(['Breakfast', 'Dinner'], $form->extra_fields[1]['options']);
        $this->assertSame('Hello there', $form->welcome_title);
    }

    public function test_dropdown_extra_field_needs_at_least_two_choices(): void
    {
        $form = $this->demoForm();
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->patchJson("/api/v1/forms/{$form->id}", [
            'extra_fields' => [['label' => 'Meal', 'type' => 'dropdown', 'mode' => 'optional', 'options' => ['Only one']]],
        ])->assertStatus(422);
    }

    public function test_guest_form_uses_the_forms_own_fields_and_wording(): void
    {
        $form = $this->demoForm();
        $form->update([
            'customer_fields' => ['name' => 'required', 'phone' => 'hidden', 'email' => 'optional'],
            'extra_fields' => [['key' => 'room', 'label' => 'Room', 'type' => 'text', 'mode' => 'optional', 'options' => []]],
            'welcome_title' => 'Welcome aboard',
        ]);

        $this->getJson(self::PUBLIC_URL)
            ->assertOk()
            ->assertJsonPath('customer_fields.phone', 'hidden')
            ->assertJsonPath('customer_fields.name', 'required')
            ->assertJsonPath('extra_fields.0.label', 'Room')
            ->assertJsonPath('messages.welcome_title', 'Welcome aboard')
            ->assertJsonPath('messages.thank_you_title', 'Thank you');
    }

    public function test_guest_form_falls_back_to_the_organization_wording(): void
    {
        Organization::query()->where('slug', 'demo-hotel')->update(['welcome_text' => 'Org welcome']);

        $this->getJson(self::PUBLIC_URL)
            ->assertOk()
            ->assertJsonPath('messages.welcome_text', 'Org welcome');
    }

    public function test_required_extra_field_is_enforced_and_answers_are_saved(): void
    {
        $form = $this->demoForm();
        $form->update([
            'extra_fields' => [['key' => 'room', 'label' => 'Room', 'type' => 'text', 'mode' => 'required', 'options' => []]],
            'thank_you_title' => 'Cheers',
            'thank_you_text' => 'Come back soon',
        ]);

        $payload = $this->getJson(self::PUBLIC_URL)->assertOk()->json();
        $question = collect($payload['form']['questions'])->firstWhere('type', 'star')
            ?? $payload['form']['questions'][0];

        $answer = [
            'question_id' => $question['id'],
            'option_id' => $question['options'][0]['id'] ?? null,
            'value' => 5,
        ];

        $this->postJson(self::PUBLIC_URL.'/submit', ['answers' => [$answer]])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Room is required.');

        $this->postJson(self::PUBLIC_URL.'/submit', [
            'customer_extra' => ['room' => '204'],
            'answers' => [$answer],
        ])
            ->assertCreated()
            ->assertJsonPath('title', 'Cheers')
            ->assertJsonPath('message', 'Come back soon');

        $saved = Submission::query()->latest('id')->firstOrFail();
        $this->assertSame('204', $saved->customer_extra[0]['value']);
        $this->assertSame('Room', $saved->customer_extra[0]['label']);
    }

    public function test_category_weights_change_the_overall_score_and_blank_weights_do_not(): void
    {
        $form = Form::query()->create(['organization_id' => 1, 'name' => 'Weights', 'is_active' => true]);
        $categoryA = FormCategory::query()->create(['organization_id' => 1, 'form_id' => $form->id, 'name' => 'A']);
        $categoryB = FormCategory::query()->create(['organization_id' => 1, 'form_id' => $form->id, 'name' => 'B']);

        $good = Question::query()->create([
            'organization_id' => 1, 'form_id' => $form->id, 'form_category_id' => $categoryA->id,
            'text' => 'Good one', 'type' => 'star', 'weight' => 1,
        ]);
        $bad = Question::query()->create([
            'organization_id' => 1, 'form_id' => $form->id, 'form_category_id' => $categoryB->id,
            'text' => 'Bad one', 'type' => 'star', 'weight' => 3,
        ]);

        $answers = [
            ['question_id' => $good->id, 'value' => 5],
            ['question_id' => $bad->id, 'value' => 1],
        ];
        $settings = ScoringSetting::query()->firstOrFail();
        $scoring = app(ScoringService::class);

        $plain = $scoring->evaluate($form->fresh(), $settings, $answers);
        $this->assertEquals(25.0, $plain['overall_score']);

        $categoryA->update(['weight' => 3]);
        $categoryB->update(['weight' => 1]);

        $weighted = $scoring->evaluate($form->fresh(), $settings, $answers);
        $this->assertEquals(75.0, $weighted['overall_score']);
    }

    public function test_question_library_is_open_to_form_managers_only(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $this->getJson('/api/v1/templates/library')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'group', 'text', 'type', 'category', 'weight', 'options']]]);

        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());
        $this->getJson('/api/v1/templates/library')->assertForbidden();
    }

    private function demoForm(): Form
    {
        return Form::query()->where('organization_id', 1)->orderBy('id')->firstOrFail();
    }
}
