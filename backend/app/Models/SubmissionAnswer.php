<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubmissionAnswer extends Model
{
    protected $fillable = [
        'submission_id',
        'question_id',
        'question_text_snapshot',
        'question_type_snapshot',
        'option_label_snapshot',
        'score_snapshot',
        'weight_snapshot',
        'free_text_value',
        'is_critical_snapshot',
        'form_category_id',
        'category_name_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'score_snapshot' => 'decimal:2',
            'weight_snapshot' => 'decimal:2',
            'is_critical_snapshot' => 'boolean',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
