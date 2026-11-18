<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CaptchaService;
use App\Services\FeedbackSubmissionService;
use App\Services\TranslationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

class PublicFormController extends Controller
{
    public function __construct(
        private FeedbackSubmissionService $submissions,
        private CaptchaService $captcha,
        private TranslationService $translations
    ) {}

    public function show(Request $request, string $org, string $branch, string $location): JsonResponse
    {
        $ctx = $this->submissions->resolveContext($org, $branch, $location);
        $captcha = $this->captcha->enabled() ? $this->captcha->challenge() : null;

        // Count every open of the guest form as a scan of this location's QR code.
        $ctx['location']->newQuery()->whereKey($ctx['location']->id)->update([
            'scans_count' => DB::raw('scans_count + 1'),
            'last_scan_at' => now(),
        ]);

        DB::table('location_scans')->insert([
            'organization_id' => $ctx['location']->organization_id,
            'branch_id' => $ctx['location']->branch_id,
            'location_id' => $ctx['location']->id,
            'scanned_at' => now(),
        ]);

        $payload = [
            'organization' => [
                'name' => $ctx['organization']->name,
                'slug' => $ctx['organization']->slug,
                'logo_path' => $ctx['organization']->logo_path,
                'logo_url' => $ctx['organization']->logo_path
                    ? Storage::disk('public')->url($ctx['organization']->logo_path)
                    : null,
                'primary_color' => $ctx['organization']->primary_color,
                'secondary_color' => $ctx['organization']->secondary_color,
                'welcome_text' => $ctx['organization']->welcome_text,
                'thank_you_text' => $ctx['organization']->thank_you_text,
                'language' => $ctx['organization']->language,
                'default_locale' => $ctx['organization']->default_locale,
                'rtl_enabled' => $ctx['organization']->rtl_enabled,
                'privacy_note' => $ctx['organization']->privacy_note,
                'allow_anonymous' => $ctx['organization']->allow_anonymous,
            ],
            'branch' => [
                'name' => $ctx['branch']->name,
                'slug' => $ctx['branch']->slug,
            ],
            'location' => [
                'name' => $ctx['location']->name,
                'slug' => $ctx['location']->slug,
                'type' => $ctx['location']->type,
            ],
            'customer_fields' => $this->submissions->customerFieldsFor($ctx['form'], $ctx['settings']),
            'extra_fields' => $ctx['form']->extra_fields ?? [],
            'messages' => $this->messagesFor($ctx['form'], $ctx['organization']),
            'form_resolution' => [
                'mode' => $ctx['form']->getAttribute('resolution_mode'),
                'applied_overrides_count' => $ctx['form']->getAttribute('applied_overrides_count') ?? 0,
            ],
            'captcha' => $captcha ? ['enabled' => true, ...$captcha] : ['enabled' => false],
            'form' => [
                'id' => $ctx['form']->id,
                'name' => $ctx['form']->name,
                'categories' => $ctx['form']->categories,
                'questions' => $ctx['form']->questions->map(fn ($q) => [
                    'id' => $q->id,
                    'text' => $q->text,
                    'type' => $q->type,
                    'is_required' => $q->is_required,
                    'sort_order' => $q->sort_order,
                    'weight' => $q->weight,
                    'form_category_id' => $q->form_category_id,
                    'follow_up_on_low' => $q->follow_up_on_low,
                    'low_score_threshold' => $q->low_score_threshold,
                    'has_branch_override' => (bool) $q->getAttribute('has_branch_override'),
                    'options' => $q->options->map(fn ($o) => [
                        'id' => $o->id,
                        'label' => $o->label,
                        'score_value' => $o->score_value,
                        'sort_order' => $o->sort_order,
                    ]),
                ]),
            ],
        ];

        $locale = $request->query('locale', $ctx['organization']->default_locale ?: $ctx['organization']->language);
        $payload = $this->translations->applyToFormPayload($ctx['organization'], $payload, $locale);

        // The wording guests see falls back to the organization's text, so carry its translation over.
        if (blank($ctx['form']->welcome_text) && filled($payload['organization']['welcome_text'] ?? null)) {
            $payload['messages']['welcome_text'] = $payload['organization']['welcome_text'];
        }
        if (blank($ctx['form']->thank_you_text) && filled($payload['organization']['thank_you_text'] ?? null)) {
            $payload['messages']['thank_you_text'] = $payload['organization']['thank_you_text'];
        }

        return response()->json($payload);
    }

    public function submit(Request $request, string $org, string $branch, string $location): JsonResponse
    {
        $payload = $request->validate([
            'customer_name' => ['nullable', 'string', 'max:120'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'customer_email' => ['nullable', 'email', 'max:120'],
            'customer_extra' => ['nullable', 'array'],
            'customer_extra.*' => ['nullable', 'string', 'max:255'],
            'captcha_id' => ['nullable', 'string'],
            'captcha_answer' => ['nullable', 'string'],
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.option_id' => ['nullable', 'integer'],
            'answers.*.value' => ['nullable'],
            'answers.*.free_text' => ['nullable', 'string'],
        ]);

        try {
            $this->captcha->assertValid($payload['captcha_id'] ?? null, $payload['captcha_answer'] ?? null);
            $ctx = $this->submissions->resolveContext($org, $branch, $location);
            $submission = $this->submissions->submit(
                $ctx['organization'],
                $ctx['branch'],
                $ctx['location'],
                $ctx['form'],
                $ctx['settings'],
                $payload,
                $request->ip(),
                $request->userAgent()
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => $this->messagesFor($ctx['form'], $ctx['organization'])['thank_you_text'],
            'title' => $this->messagesFor($ctx['form'], $ctx['organization'])['thank_you_title'],
            'submission_id' => $submission->id,
            'overall_score' => $submission->overall_score,
            'rating_band' => $submission->rating_band,
            'is_flagged' => $submission->is_flagged,
        ], 201);
    }

    /**
     * Welcome and thank-you wording: the form's own text, falling back to the organization's.
     *
     * @return array{welcome_title: string, welcome_text: string, thank_you_title: string, thank_you_text: string}
     */
    private function messagesFor($form, $organization): array
    {
        return [
            'welcome_title' => $form->welcome_title ?: $form->name,
            'welcome_text' => $form->welcome_text ?: ($organization->welcome_text ?: 'We value your feedback.'),
            'thank_you_title' => $form->thank_you_title ?: 'Thank you',
            'thank_you_text' => $form->thank_you_text ?: ($organization->thank_you_text ?: 'Thank you for your feedback!'),
        ];
    }
}
