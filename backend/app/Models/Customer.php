<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'organization_id',
        'branch_id',
        'name',
        'phone',
        'email',
        'notes',
        'source',
    ];

    /** Phone numbers are stored without spaces, dashes or brackets so the same number always matches. */
    public static function normalizePhone(?string $phone): ?string
    {
        $clean = preg_replace('/[\s\-()]/', '', trim((string) $phone));

        return $clean === '' ? null : $clean;
    }

    public static function normalizeEmail(?string $email): ?string
    {
        $clean = strtolower(trim((string) $email));

        return $clean === '' ? null : $clean;
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(CustomerMessage::class);
    }
}
