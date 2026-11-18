<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\FormCategory;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\ScoringSetting;
use App\Services\QrCodeService;
use App\Support\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FormController extends Controller
{
    public function __construct(private QrCodeService $qrCodes) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $forms = Form::query()
            ->withCount(['questions', 'locations'])
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $forms]);
    }

    public function show(Request $request, Form $form): JsonResponse
    {
        $this->authorizeForm($request, $form);
        $form->load([
            'categories',
            'questions.options',
            'locations:id,organization_id,form_id,branch_id,name,slug,type,qr_code_path,is_active',
            'locations.branch:id,name,slug',
            'locations.organization:id,slug,public_base_url,domain',
        ]);

        $guestLinks = $form->locations->map(function (Location $location) {
            return [
                'location_id' => $location->id,
                'label' => ($location->branch?->name ?: 'Branch').' · '.$location->name,
                'public_url' => $this->qrCodes->publicUrl($location),
            ];
        })->values();

        return response()->json([
            'data' => $form,
            'guest_links' => $guestLinks,
            'defaults' => $this->organizationDefaults($form),
            'ready' => $form->is_active && $form->questions->where('is_active', true)->count() > 0,
        ]);
    }

    /**
     * What a guest sees when this form has no wording or field settings of its own.
     *
     * @return array<string, mixed>
     */
    private function organizationDefaults(Form $form): array
    {
        $organization = $form->organization()->with('scoringSettings')->first();

        return [
            'customer_fields' => array_merge(
                ScoringSetting::defaults()['customer_fields'],
                $organization?->scoringSettings?->customer_fields ?? []
            ),
            'welcome_text' => $organization?->welcome_text,
            'thank_you_text' => $organization?->thank_you_text,
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $organizationId = $user->organization_id;
        abort_unless($organizationId || $user->isOwner(), 403);

        if ($user->isOwner()) {
            $organizationId = $request->integer('organization_id');
        }

        if ($organizationId) {
            PlanLimits::assertPlanActive(Organization::query()->findOrFail($organizationId));
        }

        $data = $request->validate([
            'organization_id' => [$user->isOwner() ? 'required' : 'nullable', 'integer'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'name' => ['required', 'string', 'max:120'],
            'is_active' => ['boolean'],
            'with_starter' => ['boolean'],
            'connect_all_locations' => ['boolean'],
            'categories' => ['array'],
            'categories.*.name' => ['required_with:categories', 'string', 'max:120'],
            'categories.*.sort_order' => ['integer'],
            'categories.*.icon' => ['nullable', 'string', 'max:40'],
            'categories.*.color' => ['nullable', 'string', 'max:20'],
            'questions' => ['array'],
            'questions.*.text' => ['required_with:questions', 'string'],
            'questions.*.type' => ['required_with:questions', Rule::in(['star', 'emoji', 'single_choice', 'multi_choice', 'yes_no', 'nps', 'text'])],
            'questions.*.is_required' => ['boolean'],
            'questions.*.sort_order' => ['integer'],
            'questions.*.weight' => ['numeric', 'min:0', 'max:5'],
            'questions.*.is_critical' => ['boolean'],
            'questions.*.follow_up_on_low' => ['boolean'],
            'questions.*.low_score_threshold' => ['integer'],
            'questions.*.category_name' => ['nullable', 'string'],
            'questions.*.options' => ['array'],
            'questions.*.options.*.label' => ['required_with:questions.*.options', 'string'],
            'questions.*.options.*.score_value' => ['numeric'],
            'questions.*.options.*.sort_order' => ['integer'],
        ]);

        if (empty($data['questions']) && ($data['with_starter'] ?? true)) {
            $data = [...$data, ...$this->starterPayload()];
        }

        $form = DB::transaction(function () use ($data, $organizationId) {
            $form = Form::query()->create([
                'organization_id' => $organizationId,
                'branch_id' => $data['branch_id'] ?? null,
                'name' => $data['name'],
                'is_active' => $data['is_active'] ?? true,
            ]);

            $this->syncNested($form, $organizationId, $data);

            if ($data['connect_all_locations'] ?? false) {
                $this->connectLocations($form, null);
            }

            return $form->load(['categories', 'questions.options', 'locations.branch:id,name,slug']);
        });

        return response()->json([
            'data' => $form,
            'ready' => $form->is_active && $form->questions->count() > 0,
        ], 201);
    }

    public function update(Request $request, Form $form): JsonResponse
    {
        $this->authorizeForm($request, $form);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'is_active' => ['boolean'],
            'customer_fields' => ['nullable', 'array'],
            'customer_fields.name' => ['sometimes', Rule::in(['required', 'optional', 'hidden'])],
            'customer_fields.phone' => ['sometimes', Rule::in(['required', 'optional', 'hidden'])],
            'customer_fields.email' => ['sometimes', Rule::in(['required', 'optional', 'hidden'])],
            'extra_fields' => ['nullable', 'array', 'max:10'],
            'extra_fields.*.label' => ['required', 'string', 'max:60'],
            'extra_fields.*.type' => ['required', Rule::in(['text', 'number', 'dropdown'])],
            'extra_fields.*.mode' => ['required', Rule::in(['required', 'optional'])],
            'extra_fields.*.options' => ['nullable', 'array', 'max:20'],
            'extra_fields.*.options.*' => ['string', 'max:80'],
            'welcome_title' => ['nullable', 'string', 'max:120'],
            'welcome_text' => ['nullable', 'string', 'max:500'],
            'thank_you_title' => ['nullable', 'string', 'max:120'],
            'thank_you_text' => ['nullable', 'string', 'max:500'],
        ]);

        if (array_key_exists('extra_fields', $data)) {
            $data['extra_fields'] = $this->normalizeExtraFields($data['extra_fields'] ?? []);
        }

        $form->update($data);

        return response()->json(['data' => $form->fresh()]);
    }

    public function goLive(Request $request, Form $form): JsonResponse
    {
        $this->authorizeForm($request, $form);

        $data = $request->validate([
            'location_ids' => ['nullable', 'array'],
            'location_ids.*' => ['integer', 'exists:locations,id'],
            'generate_qr' => ['boolean'],
        ]);

        abort_unless($form->questions()->where('is_active', true)->exists(), 422, 'Add at least one question before going live.');

        $form->update(['is_active' => true]);

        $locations = $this->connectLocations($form, $data['location_ids'] ?? null);

        if ($data['generate_qr'] ?? true) {
            foreach ($locations as $location) {
                $this->qrCodes->generateAndStore($location);
            }
        }

        $form->load([
            'categories',
            'questions.options',
            'locations:id,organization_id,form_id,branch_id,name,slug,type,qr_code_path,is_active',
            'locations.branch:id,name,slug',
            'locations.organization:id,slug,public_base_url,domain',
        ]);

        $guestLinks = $form->locations->map(function (Location $location) {
            return [
                'location_id' => $location->id,
                'label' => ($location->branch?->name ?: 'Branch').' · '.$location->name,
                'public_url' => $this->qrCodes->publicUrl($location),
                'qr_ready' => filled($location->qr_code_path),
            ];
        })->values();

        return response()->json([
            'data' => $form,
            'guest_links' => $guestLinks,
            'message' => 'Form is live and connected to QR locations.',
            'ready' => true,
        ]);
    }

    /**
     * Give every extra field a stable key and make sure dropdowns have choices.
     *
     * @param  array<int, array<string, mixed>>  $fields
     * @return array<int, array<string, mixed>>
     */
    private function normalizeExtraFields(array $fields): array
    {
        $used = [];
        $normalized = [];

        foreach ($fields as $field) {
            $base = Str::slug((string) $field['label'], '_') ?: 'field';
            $key = $base;
            for ($i = 2; in_array($key, $used, true); $i++) {
                $key = $base.'_'.$i;
            }
            $used[] = $key;

            $options = array_values(array_filter(array_map('trim', (array) ($field['options'] ?? []))));
            abort_if(
                $field['type'] === 'dropdown' && count($options) < 2,
                422,
                'Dropdown "'.$field['label'].'" needs at least two choices.'
            );

            $normalized[] = [
                'key' => $key,
                'label' => trim((string) $field['label']),
                'type' => $field['type'],
                'mode' => $field['mode'],
                'options' => $field['type'] === 'dropdown' ? $options : [],
            ];
        }

        return $normalized;
    }

    private function starterPayload(): array
    {
        $choice = [
            ['label' => 'Excellent', 'score_value' => 100],
            ['label' => 'Good', 'score_value' => 75],
            ['label' => 'Average', 'score_value' => 50],
            ['label' => 'Poor', 'score_value' => 25],
            ['label' => 'Bad', 'score_value' => 0],
        ];

        return [
            'categories' => [
                ['name' => 'Experience', 'sort_order' => 1],
                ['name' => 'Service', 'sort_order' => 2],
            ],
            'questions' => [
                [
                    'text' => 'How was your overall experience?',
                    'type' => 'single_choice',
                    'category_name' => 'Experience',
                    'is_required' => true,
                    'weight' => 1.5,
                    'is_critical' => true,
                    'follow_up_on_low' => true,
                    'low_score_threshold' => 40,
                    'options' => $choice,
                ],
                [
                    'text' => 'How would you rate our staff?',
                    'type' => 'star',
                    'category_name' => 'Service',
                    'is_required' => true,
                    'weight' => 1,
                    'is_critical' => false,
                    'follow_up_on_low' => false,
                ],
                [
                    'text' => 'Would you recommend us?',
                    'type' => 'yes_no',
                    'category_name' => 'Experience',
                    'is_required' => true,
                    'weight' => 1,
                    'is_critical' => false,
                    'follow_up_on_low' => false,
                ],
                [
                    'text' => 'Anything else we should know?',
                    'type' => 'text',
                    'category_name' => 'Service',
                    'is_required' => false,
                    'weight' => 0,
                    'is_critical' => false,
                    'follow_up_on_low' => false,
                ],
            ],
        ];
    }

    private function syncNested(Form $form, int $organizationId, array $data): void
    {
        $categoryMap = [];
        foreach ($data['categories'] ?? [] as $index => $category) {
            $created = FormCategory::query()->create([
                'organization_id' => $organizationId,
                'form_id' => $form->id,
                'name' => $category['name'],
                'icon' => $category['icon'] ?? null,
                'color' => $category['color'] ?? null,
                'sort_order' => $category['sort_order'] ?? $index,
                'is_active' => true,
            ]);
            $categoryMap[$created->name] = $created->id;
        }

        foreach ($data['questions'] ?? [] as $index => $questionData) {
            $categoryId = null;
            if (! empty($questionData['category_name'])) {
                $categoryId = $categoryMap[$questionData['category_name']] ?? null;
            }

            $question = Question::query()->create([
                'organization_id' => $organizationId,
                'form_id' => $form->id,
                'form_category_id' => $categoryId,
                'text' => $questionData['text'],
                'type' => $questionData['type'],
                'is_required' => $questionData['is_required'] ?? true,
                'sort_order' => $questionData['sort_order'] ?? $index,
                'weight' => $questionData['weight'] ?? 1,
                'is_critical' => $questionData['is_critical'] ?? false,
                'follow_up_on_low' => $questionData['follow_up_on_low'] ?? false,
                'low_score_threshold' => $questionData['low_score_threshold'] ?? 40,
                'is_active' => true,
            ]);

            foreach ($questionData['options'] ?? [] as $optIndex => $option) {
                QuestionOption::query()->create([
                    'question_id' => $question->id,
                    'label' => $option['label'],
                    'score_value' => $option['score_value'] ?? 0,
                    'sort_order' => $option['sort_order'] ?? $optIndex,
                ]);
            }
        }
    }

    /**
     * @param  array<int, int>|null  $locationIds
     * @return Collection<int, Location>
     */
    private function connectLocations(Form $form, ?array $locationIds)
    {
        $query = Location::query()
            ->where('organization_id', $form->organization_id)
            ->when($form->branch_id, fn ($q) => $q->where('branch_id', $form->branch_id))
            ->when($locationIds !== null, fn ($q) => $q->whereIn('id', $locationIds));

        $locations = $query->get();
        foreach ($locations as $location) {
            $location->update(['form_id' => $form->id]);
        }

        return Location::query()
            ->with(['organization', 'branch'])
            ->whereIn('id', $locations->pluck('id'))
            ->get();
    }

    private function authorizeForm(Request $request, Form $form): void
    {
        $user = $request->user();
        abort_unless($user->isOwner() || $user->organization_id === $form->organization_id, 403);
    }
}
