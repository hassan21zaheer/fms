<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'plan_id',
        'name',
        'tagline',
        'support_email',
        'support_phone',
        'address',
        'slug',
        'logo_path',
        'primary_color',
        'secondary_color',
        'branch_limit',
        'plan_expires_at',
        'status',
        'domain',
        'domain_verification_token',
        'domain_verified_at',
        'welcome_text',
        'thank_you_text',
        'language',
        'rtl_enabled',
        'default_locale',
        'privacy_note',
        'allow_anonymous',
        'duplicate_window_minutes',
        'public_base_url',
        'default_country_code',
    ];

    protected function casts(): array
    {
        return [
            'allow_anonymous' => 'boolean',
            'rtl_enabled' => 'boolean',
            'branch_limit' => 'integer',
            'duplicate_window_minutes' => 'integer',
            'plan_expires_at' => 'datetime',
            'domain_verified_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function forms(): HasMany
    {
        return $this->hasMany(Form::class);
    }

    public function scoringSettings(): HasOne
    {
        return $this->hasOne(ScoringSetting::class);
    }

    public function notificationSettings(): HasOne
    {
        return $this->hasOne(NotificationSetting::class);
    }
}
