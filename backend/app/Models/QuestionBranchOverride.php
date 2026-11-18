<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuestionBranchOverride extends Model
{
    protected $fillable = [
        'organization_id',
        'branch_id',
        'form_id',
        'question_id',
        'is_hidden',
        'text_override',
        'is_required_override',
        'weight_override',
        'sort_order_override',
        'follow_up_on_low_override',
        'low_score_threshold_override',
    ];

    protected function casts(): array
    {
        return [
            'is_hidden' => 'boolean',
            'is_required_override' => 'boolean',
            'follow_up_on_low_override' => 'boolean',
            'weight_override' => 'decimal:2',
            'sort_order_override' => 'integer',
            'low_score_threshold_override' => 'integer',
        ];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }
}
