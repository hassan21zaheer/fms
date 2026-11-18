<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    protected $fillable = [
        'organization_id',
        'form_id',
        'form_category_id',
        'text',
        'type',
        'is_required',
        'sort_order',
        'is_active',
        'weight',
        'is_critical',
        'follow_up_on_low',
        'low_score_threshold',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'is_critical' => 'boolean',
            'follow_up_on_low' => 'boolean',
            'weight' => 'decimal:2',
            'sort_order' => 'integer',
            'low_score_threshold' => 'integer',
        ];
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FormCategory::class, 'form_category_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuestionOption::class)->orderBy('sort_order');
    }
}
