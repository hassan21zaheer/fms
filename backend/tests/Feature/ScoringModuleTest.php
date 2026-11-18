<?php

namespace Tests\Feature;

use App\Models\FeedbackCase;
use App\Models\Form;
use App\Models\FormCategory;
use App\Models\Question;
use App\Models\ScoringSetting;
use App\Models\Submission;
use App\Models\User;
use App\Services\ScoringService;
use Database\Seeders\FmsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScoringModuleTest extends TestCase
{
    use RefreshDatabase;

    private const SCALE = ['Excellent' => 100, 'Good' => 75, 'Average' => 50, 'Poor' => 25, 'Bad' => 0];

    private ScoringService $scoring;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(FmsSeeder::class);
        config(['fms.captcha_enabled' => false]);
        $this->scoring = app(ScoringService::class);
    }

    public function test_worked_example_scores_67_good_and_flags_the_low_category(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room', 25);
        $cleanliness = $this->category($form, 'Cleanliness', 25);
        $staff = $this->category($form, 'Staff', 20);
        $food = $this->category($form, 'Food', 15);
        $service = $this->category($form, 'Service', 15);

        $answers = [
            $this->answer($this->question($form, $room), 'Excellent'),
            $this->answer($this->question($form, $room), 'Good'),
            $this->answer($this->question($form, $cleanliness), 'Poor'),
            $this->answer($this->question($form, $staff), 'Excellent'),
            $this->answer($this->question($form, $food), 'Average'),
            $this->answer($this->question($form, $service), 'Good'),
        ];

        $result = $this->scoring->evaluate($form->fresh(), $this->settings(), $answers);

        $this->assertSame(67, $result['overall_score']);
        $this->assertSame('Good', $result['rating_band']);
        $this->assertTrue($result['is_flagged']);
        $this->assertCount(1, $result['flag_reasons']);
        $this->assertStringContainsString('Category Cleanliness scored 25', $result['flag_reasons'][0]);

        $byName = collect($result['category_scores'])->pluck('score', 'name');
        $this->assertSame(88, $byName['Room']);
        $this->assertSame(25, $byName['Cleanliness']);
        $this->assertSame(100, $byName['Staff']);
        $this->assertSame(50, $byName['Food']);
        $this->assertSame(75, $byName['Service']);
    }

    public function test_question_weights_are_applied_inside_a_category(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room', 100);

        $heavy = $this->question($form, $room, weight: 5);
        $light = $this->question($form, $room, weight: 1);

        $result = $this->scoring->evaluate($form->fresh(), $this->settings(), [
            $this->answer($heavy, 'Poor'),
            $this->answer($light, 'Excellent'),
        ]);

        // (25 x 5 + 100 x 1) / 6 = 37.5, rounded once at the end. The plain average would be 62.5.
        $this->assertSame(38, $result['overall_score']);
        $this->assertSame(38, $result['category_scores'][0]['score']);
    }

    public function test_a_category_without_scored_answers_is_left_out_and_weights_are_renormalized(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room', 50);
        $food = $this->category($form, 'Food', 50);

        $answered = $this->question($form, $room);
        $this->question($form, $food);
        $freeText = Question::query()->create([
            'organization_id' => 1, 'form_id' => $form->id, 'form_category_id' => $food->id,
            'text' => 'Comments', 'type' => 'text', 'weight' => 0,
        ]);

        $result = $this->scoring->evaluate($form->fresh(), $this->settings(), [
            $this->answer($answered, 'Good'),
            ['question_id' => $freeText->id, 'value' => 'Lovely stay'],
        ]);

        $this->assertSame(75, $result['overall_score']);
        $this->assertCount(1, $result['category_scores']);
        $this->assertSame(100.0, $result['category_scores'][0]['share']);
    }

    public function test_star_ratings_use_the_zero_to_hundred_scale(): void
    {
        $form = $this->makeForm();
        $category = $this->category($form, 'Room', 100);
        $stars = Question::query()->create([
            'organization_id' => 1, 'form_id' => $form->id, 'form_category_id' => $category->id,
            'text' => 'Stars', 'type' => 'star', 'weight' => 1,
        ]);

        foreach ([1 => 0, 2 => 25, 3 => 50, 4 => 75, 5 => 100] as $given => $expected) {
            $result = $this->scoring->evaluate($form->fresh(), $this->settings(), [
                ['question_id' => $stars->id, 'value' => $given],
            ]);
            $this->assertSame($expected, $result['overall_score'], "{$given} stars");
        }
    }

    public function test_each_flag_rule_can_be_switched_off(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room', 100);
        $critical = $this->question($form, $room, critical: true);
        $answers = [$this->answer($critical, 'Poor')];

        $all = $this->scoring->evaluate($form->fresh(), $this->settings(), $answers);
        $this->assertTrue($all['is_flagged']);
        $this->assertCount(3, $all['flag_reasons']);

        $none = $this->scoring->evaluate($form->fresh(), $this->settings([
            'flag_on_overall' => false,
            'flag_on_critical_question' => false,
            'flag_on_category' => false,
        ]), $answers);
        $this->assertFalse($none['is_flagged']);
        $this->assertSame([], $none['flag_reasons']);

        $criticalOnly = $this->scoring->evaluate($form->fresh(), $this->settings([
            'flag_on_overall' => false,
            'flag_on_category' => false,
        ]), $answers);
        $this->assertCount(1, $criticalOnly['flag_reasons']);
        $this->assertStringContainsString('Critical question', $criticalOnly['flag_reasons'][0]);
    }

    public function test_critical_limit_is_separate_from_the_overall_limit(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room', 100);
        $critical = $this->question($form, $room, critical: true);

        $result = $this->scoring->evaluate($form->fresh(), $this->settings([
            'flag_on_overall' => false,
            'flag_on_category' => false,
            'critical_threshold' => 20,
        ]), [$this->answer($critical, 'Poor')]);

        $this->assertFalse($result['is_flagged']);
    }

    public function test_case_priority_follows_the_overall_score(): void
    {
        $this->assertSame('urgent', $this->scoring->priorityFor(34));
        $this->assertSame('high', $this->scoring->priorityFor(35));
        $this->assertSame('high', $this->scoring->priorityFor(49));
        $this->assertSame('medium', $this->scoring->priorityFor(50));
        $this->assertSame('medium', $this->scoring->priorityFor(null));
    }

    public function test_a_flagged_submission_stores_category_scores_and_opens_a_case_with_priority(): void
    {
        $form = Form::query()->where('organization_id', 1)->orderBy('id')->firstOrFail();
        $payload = $this->getJson('/api/v1/f/demo-hotel/downtown/room-101')->assertOk()->json();

        $answers = collect($payload['form']['questions'])
            ->filter(fn ($question) => $question['type'] !== 'text')
            ->map(function ($question) {
                $worst = collect($question['options'] ?? [])->sortBy('score_value')->first();

                return [
                    'question_id' => $question['id'],
                    'option_id' => $worst['id'] ?? null,
                    'value' => match ($question['type']) {
                        'star' => 1, 'nps' => 0, 'yes_no' => 'no', default => null,
                    },
                    'free_text' => 'Needs work',
                ];
            })->values()->all();

        $this->postJson('/api/v1/f/demo-hotel/downtown/room-101/submit', ['answers' => $answers])->assertCreated();

        $submission = Submission::query()->where('form_id', $form->id)->latest('id')->firstOrFail();
        $this->assertTrue($submission->is_flagged);
        $this->assertNotEmpty($submission->category_scores);
        $this->assertSame('urgent', FeedbackCase::query()->where('submission_id', $submission->id)->value('priority'));
    }

    public function test_scoring_settings_can_be_read_and_saved_by_an_admin(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->getJson('/api/v1/scoring/settings')
            ->assertOk()
            ->assertJsonPath('recommended.flag_threshold', 60)
            ->assertJsonPath('priority_limits.urgent_below', 35);

        $this->patchJson('/api/v1/scoring/settings', $this->validSettingsPayload(['flag_threshold' => 70]))
            ->assertOk()
            ->assertJsonPath('data.flag_threshold', '70.00');
    }

    public function test_rating_bands_must_cover_zero_to_hundred_without_gaps_or_overlaps(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $gap = [
            ['label' => 'High', 'min' => 50, 'max' => 100],
            ['label' => 'Low', 'min' => 0, 'max' => 39],
        ];
        $this->patchJson('/api/v1/scoring/settings', $this->validSettingsPayload(['rating_bands' => $gap]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('rating_bands');

        $overlap = [
            ['label' => 'High', 'min' => 40, 'max' => 100],
            ['label' => 'Low', 'min' => 0, 'max' => 50],
        ];
        $this->patchJson('/api/v1/scoring/settings', $this->validSettingsPayload(['rating_bands' => $overlap]))
            ->assertStatus(422);
    }

    public function test_staff_cannot_open_the_scoring_module(): void
    {
        Sanctum::actingAs(User::query()->where('email', 'staff@demohotel.test')->firstOrFail());

        $this->getJson('/api/v1/scoring/settings')->assertForbidden();
    }

    public function test_category_weights_must_add_up_to_one_hundred(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room');
        $food = $this->category($form, 'Food');
        $this->question($form, $room);
        $this->question($form, $food);

        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $url = "/api/v1/scoring/forms/{$form->id}/category-weights";

        $this->putJson($url, ['weights' => [$room->id => 60, $food->id => 30]])
            ->assertStatus(422)
            ->assertJsonValidationErrors('weights');

        $this->putJson($url, ['weights' => [$room->id => 60, $food->id => 40]])->assertOk();

        $this->assertEquals(60, $room->fresh()->weight);
        $this->assertEquals(40, $food->fresh()->weight);
    }

    public function test_score_tester_returns_a_result_without_saving_anything(): void
    {
        $form = $this->makeForm();
        $room = $this->category($form, 'Room', 100);
        $question = $this->question($form, $room);
        $good = $question->options->firstWhere('label', 'Good');

        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $before = Submission::query()->count();

        $this->postJson("/api/v1/scoring/forms/{$form->id}/preview", [
            'answers' => [['question_id' => $question->id, 'option_id' => $good->id]],
        ])
            ->assertOk()
            ->assertJsonPath('overall_score', 75)
            ->assertJsonPath('rating_band', 'Good')
            ->assertJsonPath('is_flagged', false);

        $this->assertSame($before, Submission::query()->count());
    }

    public function test_question_weights_must_be_between_one_and_five(): void
    {
        $form = $this->makeForm();
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());
        $base = ['text' => 'Q', 'type' => 'star'];

        $this->postJson("/api/v1/forms/{$form->id}/questions", [...$base, 'weight' => 0])->assertStatus(422);
        $this->postJson("/api/v1/forms/{$form->id}/questions", [...$base, 'weight' => 6])->assertStatus(422);
        $this->postJson("/api/v1/forms/{$form->id}/questions", [...$base, 'weight' => 1.5])->assertCreated();
        $this->postJson("/api/v1/forms/{$form->id}/questions", ['text' => 'Notes', 'type' => 'text', 'weight' => 0])->assertCreated();
    }

    public function test_saving_guest_field_defaults_does_not_reset_scoring_rules(): void
    {
        ScoringSetting::query()->where('organization_id', 1)->update(['flag_threshold' => 72]);
        Sanctum::actingAs(User::query()->where('email', 'admin@demohotel.test')->firstOrFail());

        $this->patchJson('/api/v1/settings/scoring', ['customer_fields' => ['name' => 'required', 'phone' => 'hidden', 'email' => 'optional']])
            ->assertOk();

        $this->assertEquals(72, ScoringSetting::query()->where('organization_id', 1)->value('flag_threshold'));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validSettingsPayload(array $overrides = []): array
    {
        return [
            'flag_on_overall' => true,
            'flag_threshold' => 60,
            'flag_on_critical_question' => true,
            'critical_threshold' => 50,
            'flag_on_category' => true,
            'flag_category_threshold' => 50,
            'rating_bands' => ScoringSetting::defaults()['rating_bands'],
            ...$overrides,
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function settings(array $overrides = []): ScoringSetting
    {
        $settings = ScoringSetting::query()->where('organization_id', 1)->firstOrFail();
        $settings->fill($overrides);

        return $settings;
    }

    private function makeForm(): Form
    {
        return Form::query()->create(['organization_id' => 1, 'name' => 'Scoring test', 'is_active' => true]);
    }

    private function category(Form $form, string $name, ?float $weight = null): FormCategory
    {
        return FormCategory::query()->create([
            'organization_id' => 1, 'form_id' => $form->id, 'name' => $name, 'weight' => $weight,
        ]);
    }

    private function question(Form $form, FormCategory $category, float $weight = 1, bool $critical = false): Question
    {
        $question = Question::query()->create([
            'organization_id' => 1, 'form_id' => $form->id, 'form_category_id' => $category->id,
            'text' => 'Question '.Question::query()->count(), 'type' => 'single_choice',
            'weight' => $weight, 'is_critical' => $critical,
        ]);

        foreach (self::SCALE as $label => $score) {
            $question->options()->create(['label' => $label, 'score_value' => $score]);
        }

        return $question->load('options');
    }

    /**
     * @return array{question_id: int, option_id: int}
     */
    private function answer(Question $question, string $label): array
    {
        return [
            'question_id' => $question->id,
            'option_id' => $question->options->firstWhere('label', $label)->id,
        ];
    }
}
