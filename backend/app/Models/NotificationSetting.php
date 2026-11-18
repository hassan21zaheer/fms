<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationSetting extends Model
{
    protected $fillable = [
        'organization_id',
        'email_on_flagged',
        'notify_emails',
        'whatsapp_enabled',
        'weekly_summary_enabled',
        'weekly_summary_day',
    ];

    protected function casts(): array
    {
        return [
            'email_on_flagged' => 'boolean',
            'whatsapp_enabled' => 'boolean',
            'weekly_summary_enabled' => 'boolean',
            'notify_emails' => 'array',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
