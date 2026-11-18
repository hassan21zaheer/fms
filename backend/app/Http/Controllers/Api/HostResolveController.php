<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class HostResolveController extends Controller
{
    public function __construct(private DomainService $domains) {}

    public function __invoke(Request $request): JsonResponse
    {
        $host = $request->query('host') ?: $request->getHost();
        $organization = $this->domains->findByHost($host);

        if (! $organization) {
            return response()->json([
                'resolved' => false,
                'host' => $host,
                'organization' => null,
            ]);
        }

        return response()->json([
            'resolved' => true,
            'host' => $host,
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'logo_url' => $organization->logo_path ? Storage::disk('public')->url($organization->logo_path) : null,
                'primary_color' => $organization->primary_color,
                'secondary_color' => $organization->secondary_color,
                'welcome_text' => $organization->welcome_text,
                'language' => $organization->language,
            ],
        ]);
    }
}
