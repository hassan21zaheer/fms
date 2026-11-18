<?php

namespace App\Notifications;

use App\Models\FeedbackCase;
use Illuminate\Notifications\Notification;

class CaseAssignedAlert extends Notification
{
    public function __construct(public FeedbackCase $case, public string $assignedBy) {}

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
        return [
            'kind' => 'case_assigned',
            'title' => 'A case was assigned to you',
            'body' => $this->assignedBy.' assigned you CASE-'.$this->case->id.' ('.$this->case->priority.' priority).',
            'page' => 'cases',
            'case_id' => $this->case->id,
        ];
    }
}
