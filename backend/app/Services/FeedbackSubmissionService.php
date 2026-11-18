<?php

namespace App\Services;

use App\Jobs\SendFlaggedFeedbackNotification;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\FeedbackCase;
use App\Models\Form;
use App\Models\Location;
use App\Models\Organization;
use App\Models\ScoringSetting;
use App\Models\Submission;
use App\Models\User;
use App\Notifications\FlaggedFeedbackAlert;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Spatie\Permission\Models\Permission;

class FeedbackSubmissionService
{
    public function __construct(
        private ScoringService $scoring,
        private FormResolutionService $forms
    ) {}

    public function resolveContext(string $orgSlug, string $branchSlug, string $locationSlug): array
    {
        $organization = Organization::query()
            ->where('slug', $orgSlug)
            ->where('status', 'active')
            ->firstOrFail();

        $branch = Branch::query()
            ->where('organization_id', $organization->id)
            ->where('slug', $branchSlug)
            ->where('is_active', true)
            ->firstOrFail();

        $location = Location::query()
            ->where('organization_id', $organization->id)
            ->where('branch_id', $branch->id)
            ->where('slug', $locationSlug)
            ->where('is_active', true)
            ->firstOrFail();

        $form = $this->forms->resolveForLocation($organization, $branch, $location);

        $settings = $organization->scoringSettings
            ?? ScoringSetting::query()->create([
                'organization_id' => $organization->id,
                ...ScoringSetting::defaults(),
            ]);

        return compact('organization', 'branch', 'location', 'form', 'settings');
    }

    public function submit(
        Organization $organization,
        Branch $branch,
        Location $location,
        Form $form,
        ScoringSetting $settings,
        array $payload,
        ?string $ip,
        ?string $userAgent
    ): Submission {
        // Store phone numbers and emails in one canonical form so the same person always matches.
        $payload['customer_phone'] = Customer::normalizePhone($payload['customer_phone'] ?? null);
        $payload['customer_email'] = Customer::normalizeEmail($payload['customer_email'] ?? null);

        $customerFields = $this->customerFieldsFor($form, $settings);
        $this->validateCustomerFields($customerFields, $payload, $organization->allow_anonymous);
        $customerExtra = $this->collectExtraFields($form, $payload, $organization->allow_anonymous);
        $this->assertNotDuplicate($organization, $location, $payload, $ip);

        $submission = DB::transaction(function () use ($organization, $branch, $location, $form, $settings, $payload, $customerExtra, $ip, $userAgent) {
            $result = $this->scoring->evaluate($form, $settings, $payload['answers'] ?? []);

            if (empty($result['answer_rows'])) {
                throw new InvalidArgumentException('At least one answer is required.');
            }

            $customer = $this->upsertCustomer($organization->id, $payload);

            $submission = Submission::query()->create([
                'organization_id' => $organization->id,
                'branch_id' => $branch->id,
                'location_id' => $location->id,
                'form_id' => $form->id,
                'customer_id' => $customer?->id,
                'customer_name' => $payload['customer_name'] ?? $customer?->name,
                'customer_phone' => $payload['customer_phone'] ?? $customer?->phone,
                'customer_email' => $payload['customer_email'] ?? $customer?->email,
                'customer_extra' => $customerExtra ?: null,
                'overall_score' => $result['overall_score'],
                'rating_band' => $result['rating_band'],
                'category_scores' => $result['category_scores'],
                'is_flagged' => $result['is_flagged'],
                'flag_reasons' => $result['flag_reasons'],
                'ip_address' => $ip,
                'user_agent' => $userAgent,
                'submitted_at' => now(),
            ]);

            $submission->answers()->createMany($result['answer_rows']);

            if ($result['is_flagged']) {
                FeedbackCase::query()->create([
                    'organization_id' => $organization->id,
                    'branch_id' => $branch->id,
                    'submission_id' => $submission->id,
                    'status' => 'open',
                    'priority' => $result['priority'],
                ]);
            }

            return $submission->load(['answers', 'feedbackCase', 'location', 'branch', 'organization']);
        });

        if ($submission->is_flagged) {
            SendFlaggedFeedbackNotification::dispatch($submission->id);
            $this->notifyTeam($submission);
        }

        return $submission;
    }

    /**
     * Put a bell notification in front of everyone who handles cases for this branch.
     */
    private function notifyTeam(Submission $submission): void
    {
        $permission = Permission::findByName('manage cases', 'web');

        User::query()
            ->where('organization_id', $submission->organization_id)
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('branch_id')->orWhere('branch_id', $submission->branch_id))
            ->permission($permission)
            ->get()
            ->each(fn (User $user) => $user->notify(new FlaggedFeedbackAlert($submission)));
    }

    private function assertNotDuplicate(
        Organization $organization,
        Location $location,
        array $payload,
        ?string $ip
    ): void {
        $minutes = (int) ($organization->duplicate_window_minutes ?? 60);
        if ($minutes <= 0) {
            return;
        }

        $since = now()->subMinutes($minutes);
        $query = Submission::query()
            ->where('organization_id', $organization->id)
            ->where('location_id', $location->id)
            ->where('submitted_at', '>=', $since);

        $phone = $payload['customer_phone'] ?? null;
        $matched = false;

        if ($phone) {
            $matched = (clone $query)->where('customer_phone', $phone)->exists();
        } elseif ($ip) {
            $matched = (clone $query)->where('ip_address', $ip)->exists();
        }

        if ($matched) {
            throw new InvalidArgumentException(
                "Duplicate submission detected. Please wait {$minutes} minutes before submitting again."
            );
        }
    }

    /**
     * Name / phone / email modes for this form: the form's own settings, falling back to the organization's.
     *
     * @return array<string, string>
     */
    public function customerFieldsFor(Form $form, ScoringSetting $settings): array
    {
        return array_merge(
            ScoringSetting::defaults()['customer_fields'],
            $settings->customer_fields ?? [],
            $form->customer_fields ?? [],
        );
    }

    /**
     * Validate and snapshot the extra customer fields defined on the form.
     *
     * @return array<int, array{key: string, label: string, value: string}>
     */
    private function collectExtraFields(Form $form, array $payload, bool $allowAnonymous): array
    {
        $given = (array) ($payload['customer_extra'] ?? []);
        $collected = [];

        foreach ($form->extra_fields ?? [] as $field) {
            $key = (string) ($field['key'] ?? '');
            $label = (string) ($field['label'] ?? $key);
            $value = $given[$key] ?? null;
            $value = is_scalar($value) ? trim((string) $value) : '';

            if ($value === '') {
                if (($field['mode'] ?? 'optional') === 'required' && ! $allowAnonymous) {
                    throw new InvalidArgumentException("{$label} is required.");
                }

                continue;
            }

            if (($field['type'] ?? 'text') === 'number' && ! is_numeric($value)) {
                throw new InvalidArgumentException("{$label} must be a number.");
            }

            if (($field['type'] ?? 'text') === 'dropdown' && ! in_array($value, (array) ($field['options'] ?? []), true)) {
                throw new InvalidArgumentException("{$label} has an invalid choice.");
            }

            $collected[] = ['key' => $key, 'label' => $label, 'value' => mb_substr($value, 0, 255)];
        }

        return $collected;
    }

    private function validateCustomerFields(array $fields, array $payload, bool $allowAnonymous): void
    {
        if ($allowAnonymous) {
            return;
        }

        foreach (['name' => 'customer_name', 'phone' => 'customer_phone', 'email' => 'customer_email'] as $key => $input) {
            $mode = $fields[$key] ?? 'optional';
            if ($mode === 'required' && blank($payload[$input] ?? null)) {
                throw new InvalidArgumentException(ucfirst($key).' is required.');
            }
        }
    }

    private function upsertCustomer(int $organizationId, array $payload): ?Customer
    {
        $phone = Customer::normalizePhone($payload['customer_phone'] ?? null);
        $email = Customer::normalizeEmail($payload['customer_email'] ?? null);
        $name = $payload['customer_name'] ?? null;

        if (! $phone && ! $email && ! $name) {
            return null;
        }

        $query = Customer::query()->where('organization_id', $organizationId);
        $existing = $phone ? (clone $query)->where('phone', $phone)->first() : null;
        if (! $existing && $email) {
            $existing = (clone $query)->where('email', $email)->first();
        }

        if ($existing) {
            $existing->fill([
                'name' => $name ?: $existing->name,
                'phone' => $phone ?: $existing->phone,
                'email' => $email ?: $existing->email,
            ])->save();

            return $existing;
        }

        return Customer::query()->create([
            'organization_id' => $organizationId,
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
        ]);
    }
}
