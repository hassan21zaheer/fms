<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Str;

class DomainService
{
    public function normalize(string $domain): string
    {
        $domain = strtolower(trim($domain));
        $domain = preg_replace('#^https?://#', '', $domain);
        $domain = rtrim($domain, '/');
        $domain = explode('/', $domain)[0];
        $domain = explode(':', $domain)[0];

        return $domain;
    }

    public function startConnect(Organization $organization, string $domain): Organization
    {
        $normalized = $this->normalize($domain);

        $taken = Organization::query()
            ->where('domain', $normalized)
            ->where('id', '!=', $organization->id)
            ->exists();

        abort_if($taken, 422, 'Domain is already connected to another organization.');

        $token = 'fms-verify-'.Str::lower(Str::random(24));

        $organization->update([
            'domain' => $normalized,
            'domain_verification_token' => $token,
            'domain_verified_at' => null,
            'public_base_url' => 'https://'.$normalized,
        ]);

        return $organization->fresh();
    }

    public function verify(Organization $organization): Organization
    {
        abort_unless($organization->domain && $organization->domain_verification_token, 422, 'No domain pending verification.');

        // Local/dev bypass: if APP_ENV=local, allow verify without DNS TXT lookup.
        if (app()->environment('local', 'testing')) {
            $organization->update(['domain_verified_at' => now()]);

            return $organization->fresh();
        }

        $records = @dns_get_record($organization->domain, DNS_TXT) ?: [];
        $token = $organization->domain_verification_token;
        $matched = collect($records)->contains(function ($record) use ($token) {
            $txt = $record['txt'] ?? '';

            return str_contains($txt, $token);
        });

        abort_unless($matched, 422, 'TXT record not found. Add TXT value: '.$token);

        $organization->update(['domain_verified_at' => now()]);

        return $organization->fresh();
    }

    public function disconnect(Organization $organization): Organization
    {
        $organization->update([
            'domain' => null,
            'domain_verification_token' => null,
            'domain_verified_at' => null,
        ]);

        return $organization->fresh();
    }

    public function findByHost(?string $host): ?Organization
    {
        if (! $host) {
            return null;
        }

        $normalized = $this->normalize($host);

        return Organization::query()
            ->where('status', 'active')
            ->where('domain', $normalized)
            ->whereNotNull('domain_verified_at')
            ->first();
    }
}
