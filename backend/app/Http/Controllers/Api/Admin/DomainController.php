<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\DomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DomainController extends Controller
{
    public function __construct(private DomainService $domains) {}

    public function show(Request $request): JsonResponse
    {
        $org = $this->organization($request);

        return response()->json([
            'data' => [
                'domain' => $org->domain,
                'domain_verified_at' => $org->domain_verified_at,
                'domain_verification_token' => $org->domain_verification_token,
                'public_base_url' => $org->public_base_url,
                'instructions' => $org->domain_verification_token
                    ? 'Add a TXT DNS record on your domain with value: '.$org->domain_verification_token
                    : null,
            ],
        ]);
    }

    public function connect(Request $request): JsonResponse
    {
        $org = $this->organization($request);

        $data = $request->validate([
            'domain' => ['required', 'string', 'max:120'],
        ]);

        $org = $this->domains->startConnect($org, $data['domain']);

        return response()->json([
            'data' => $org,
            'instructions' => 'Add TXT DNS record: '.$org->domain_verification_token.' then call verify.',
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $org = $this->organization($request);
        $org = $this->domains->verify($org);

        return response()->json([
            'message' => 'Domain verified.',
            'data' => $org,
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $org = $this->organization($request);
        $org = $this->domains->disconnect($org);

        return response()->json([
            'message' => 'Domain disconnected.',
            'data' => $org,
        ]);
    }

    private function organization(Request $request): Organization
    {
        $user = $request->user();

        if ($user->isOwner() && $request->filled('organization_id')) {
            return Organization::query()->findOrFail($request->integer('organization_id'));
        }

        abort_unless($user->organization_id, 403);

        return Organization::query()->findOrFail($user->organization_id);
    }
}
