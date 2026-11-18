<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseNote extends Model
{
    protected $fillable = [
        'feedback_case_id',
        'user_id',
        'note',
    ];

    public function feedbackCase(): BelongsTo
    {
        return $this->belongsTo(FeedbackCase::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
