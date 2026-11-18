<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScoringSetting extends Model
{
    protected $fillable = [
        'organization_id',
        'flag_threshold',
        'flag_on_overall',
        'rating_bands',
        'flag_on_critical_question',
        'critical_threshold',
        'flag_on_category',
        'flag_category_threshold',
        'customer_fields',
    ];

    protected function casts(): array
    {
        return [
            'flag_threshold' => 'decimal:2',
            'flag_on_overall' => 'boolean',
            'critical_threshold' => 'decimal:2',
            'flag_on_category' => 'boolean',
            'flag_category_threshold' => 'decimal:2',
            'flag_on_critical_question' => 'boolean',
            'rating_bands' => 'array',
            'customer_fields' => 'array',
        ];
    }

    public static function defaults(): array
    {
        return [
            'flag_threshold' => 60,
            'flag_on_overall' => true,
            'flag_on_critical_question' => true,
            'critical_threshold' => 50,
            'flag_on_category' => true,
            'flag_category_threshold' => 50,
            'rating_bands' => [
                ['label' => 'Excellent', 'min' => 80, 'max' => 100],
                ['label' => 'Good', 'min' => 60, 'max' => 79],
                ['label' => 'Needs Attention', 'min' => 40, 'max' => 59],
                ['label' => 'Critical', 'min' => 0, 'max' => 39],
            ],
            'customer_fields' => [
                'name' => 'optional',
                'phone' => 'optional',
                'email' => 'optional',
            ],
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
