<?php

namespace App\Notifications;

use App\Models\Submission;
use Illuminate\Notifications\Notification;

class FlaggedFeedbackAlert extends Notification
{
    public function __construct(public Submission $submission) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $score = $this->submission->overall_score;

        return [
            'kind' => 'flagged_feedback',
            'title' => 'Flagged feedback'.($this->submission->branch ? ' at '.$this->submission->branch->name : ''),
            'body' => trim(($this->submission->customer_name ?: 'A guest').' scored '.($score !== null ? round((float) $score).'%' : 'low').'. '.implode(', ', (array) $this->submission->flag_reasons)),
            'page' => 'feedback',
            'submission_id' => $this->submission->id,
        ];
    }
}
