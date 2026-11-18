<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationSetting;
use App\Models\Organization;
use App\Models\ScoringSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $org = $this->organization($request);

        return response()->json([
            'organization' => $org,
            'scoring' => $org->scoringSettings,
            'notifications' => $org->notificationSettings,
        ]);
    }

    public function updateOrganization(Request $request): JsonResponse
    {
        $org = $this->organization($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:160'],
            'support_email' => ['nullable', 'email', 'max:120'],
            'support_phone' => ['nullable', 'string', 'max:40'],
            'default_country_code' => ['nullable', 'string', 'regex:/^\+?\d{1,4}$/'],
            'address' => ['nullable', 'string', 'max:255'],
            'logo_path' => ['nullable', 'string', 'max:255'],
            'primary_color' => ['nullable', 'string', 'max:20'],
            'secondary_color' => ['nullable', 'string', 'max:20'],
            'domain' => ['nullable', 'string', 'max:120'],
            'welcome_text' => ['nullable', 'string', 'max:255'],
            'thank_you_text' => ['nullable', 'string', 'max:255'],
            'language' => ['nullable', 'string', 'max:10'],
            'default_locale' => ['nullable', 'string', 'max:10'],
            'rtl_enabled' => ['boolean'],
            'privacy_note' => ['nullable', 'string'],
            'allow_anonymous' => ['boolean'],
            'duplicate_window_minutes' => ['integer', 'min:0', 'max:10080'],
            'public_base_url' => ['nullable', 'url', 'max:255'],
        ]);

        if (array_key_exists('default_country_code', $data)) {
            $data['default_country_code'] = ltrim((string) $data['default_country_code'], '+') ?: '92';
        }

        $org->update($data);

        return response()->json(['data' => $org]);
    }

    public function updateScoring(Request $request): JsonResponse
    {
        $org = $this->organization($request);

        // Scoring rules and rating bands are managed in the Scoring module; this only holds guest field defaults.
        $data = $request->validate([
            'customer_fields' => ['required', 'array'],
        ]);

        $settings = ScoringSetting::query()->firstOrCreate(
            ['organization_id' => $org->id],
            ScoringSetting::defaults()
        );
        $settings->update($data);

        return response()->json(['data' => $settings->fresh()]);
    }

    public function updateNotifications(Request $request): JsonResponse
    {
        $org = $this->organization($request);

        $data = $request->validate([
            'email_on_flagged' => ['boolean'],
            'notify_emails' => ['array'],
            'notify_emails.*' => ['email'],
            'whatsapp_enabled' => ['boolean'],
            'weekly_summary_enabled' => ['boolean'],
            'weekly_summary_day' => ['nullable', 'string', 'in:monday,tuesday,wednesday,thursday,friday,saturday,sunday'],
        ]);

        $settings = NotificationSetting::query()->updateOrCreate(
            ['organization_id' => $org->id],
            $data
        );

        return response()->json(['data' => $settings]);
    }

    private function organization(Request $request): Organization
    {
        $user = $request->user();

        if ($user->isOwner() && $request->filled('organization_id')) {
            return Organization::query()->findOrFail($request->integer('organization_id'));
        }

        abort_unless($user->organization_id, 403);

        return Organization::query()->with(['scoringSettings', 'notificationSettings'])->findOrFail($user->organization_id);
    }
}
