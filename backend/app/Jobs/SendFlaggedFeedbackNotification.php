<?php

namespace App\Jobs;

use App\Mail\FlaggedFeedbackMail;
use App\Models\NotificationSetting;
use App\Models\Submission;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendFlaggedFeedbackNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $submissionId) {}

    public function handle(): void
    {
        $submission = Submission::query()
            ->with(['organization', 'branch', 'location'])
            ->find($this->submissionId);

        if (! $submission || ! $submission->is_flagged) {
            return;
        }

        $settings = NotificationSetting::query()
            ->where('organization_id', $submission->organization_id)
            ->first();

        if (! $settings || ! $settings->email_on_flagged) {
            return;
        }

        $emails = collect($settings->notify_emails ?? [])
            ->filter()
            ->unique()
            ->values();

        if ($emails->isEmpty()) {
            return;
        }

        foreach ($emails as $email) {
            Mail::to($email)->send(new FlaggedFeedbackMail($submission));
        }
    }
}
