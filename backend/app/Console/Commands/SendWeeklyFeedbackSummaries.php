<?php

namespace App\Console\Commands;

use App\Mail\WeeklySummaryMail;
use App\Models\NotificationSetting;
use App\Models\Submission;
use App\Services\InsightsService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendWeeklyFeedbackSummaries extends Command
{
    protected $signature = 'fms:send-weekly-summaries';

    protected $description = 'Send weekly feedback summary emails to organizations that enabled them';

    public function handle(InsightsService $insights): int
    {
        $today = strtolower(now()->format('l'));

        $settings = NotificationSetting::query()
            ->with('organization')
            ->where('weekly_summary_enabled', true)
            ->get();

        foreach ($settings as $setting) {
            $day = strtolower((string) ($setting->weekly_summary_day ?: 'monday'));
            if ($day !== $today) {
                continue;
            }

            $org = $setting->organization;
            if (! $org || $org->status !== 'active') {
                continue;
            }

            $emails = collect($setting->notify_emails ?? [])->filter()->unique()->values();
            if ($emails->isEmpty()) {
                continue;
            }

            $from = now()->subDays(7);
            $base = Submission::query()
                ->where('organization_id', $org->id)
                ->where('submitted_at', '>=', $from);

            $summary = [
                'overall' => [
                    'total_responses' => (clone $base)->count(),
                    'average_score' => round((float) ((clone $base)->avg('overall_score') ?? 0), 2),
                    'flagged_count' => (clone $base)->where('is_flagged', true)->count(),
                ],
                'case_resolution' => $insights->caseResolutionMetrics($org->id),
                'recommendations' => $insights->recommendations($org->id),
            ];

            foreach ($emails as $email) {
                Mail::to($email)->send(new WeeklySummaryMail($org, $summary));
            }

            $this->info("Sent weekly summary for {$org->slug}");
        }

        return self::SUCCESS;
    }
}
