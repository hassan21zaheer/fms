<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    public function sendPasswordResetNotification(mixed $token): void
    {
        $this->notify(new ResetPasswordNotification((string) $token));
    }

    protected $fillable = [
        'organization_id',
        'branch_id',
        'name',
        'email',
        'phone',
        'password',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
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

    /** The platform owner: sees and manages every organization. */
    public function isOwner(): bool
    {
        return $this->hasRole('owner');
    }

    /** The top account of one organization: manages its branches, team and everything inside it. */
    public function isSuperadmin(): bool
    {
        return $this->hasRole('superadmin');
    }

    /** True for accounts that are not tied to a single branch (owner, superadmin and organization-wide admins). */
    public function isOrganizationWide(): bool
    {
        return $this->branch_id === null;
    }
}
