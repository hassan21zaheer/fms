<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Form extends Model
{
    protected $fillable = [
        'organization_id',
        'branch_id',
        'name',
        'is_active',
        'customer_fields',
        'extra_fields',
        'welcome_title',
        'welcome_text',
        'thank_you_title',
        'thank_you_text',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'customer_fields' => 'array',
            'extra_fields' => 'array',
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

    public function categories(): HasMany
    {
        return $this->hasMany(FormCategory::class)->orderBy('sort_order');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('sort_order');
    }

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }
}
