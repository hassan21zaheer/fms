<?php

namespace App\Services;

use App\Models\Location;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Support\Facades\Storage;

class QrCodeService
{
    public function publicUrl(Location $location): string
    {
        $location->loadMissing(['organization', 'branch']);

        abort_unless($location->organization && $location->branch, 422, 'Location is missing organization or branch.');

        // Guest form UI lives on the SPA. Prefer an explicit public_base_url,
        // otherwise FRONTEND_URL — never invent https:// from an unverified domain.
        $explicit = $location->organization->public_base_url;
        if (filled($explicit) && ! str_starts_with((string) $explicit, 'http')) {
            $explicit = 'https://'.$explicit;
        }

        $base = rtrim(
            (filled($explicit) ? $explicit : null)
                ?: config('app.frontend_url')
                ?: config('app.url'),
            '/'
        );

        return sprintf(
            '%s/f/%s/%s/%s',
            $base,
            $location->organization->slug,
            $location->branch->slug,
            $location->slug
        );
    }

    public function generateAndStore(Location $location): Location
    {
        $url = $this->publicUrl($location);
        $qrCode = new QrCode(data: $url, size: 400, margin: 10);
        $result = (new PngWriter)->write($qrCode);

        $path = sprintf(
            'qr/%s/%s-%s.png',
            $location->organization_id,
            $location->branch_id,
            $location->slug
        );

        Storage::disk('public')->put($path, $result->getString());

        $location->update(['qr_code_path' => $path]);

        return $location->fresh();
    }
}
