<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Submission extends Model
{
    protected $fillable = [
        'organization_id',
        'branch_id',
        'location_id',
        'form_id',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_extra',
        'overall_score',
        'rating_band',
        'category_scores',
        'is_flagged',
        'flag_reasons',
        'ip_address',
        'user_agent',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'overall_score' => 'decimal:2',
            'customer_extra' => 'array',
            'category_scores' => 'array',
            'is_flagged' => 'boolean',
            'flag_reasons' => 'array',
            'submitted_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(SubmissionAnswer::class);
    }

    public function feedbackCase(): HasOne
    {
        return $this->hasOne(FeedbackCase::class);
    }
}
