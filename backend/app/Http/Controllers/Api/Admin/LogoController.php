<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LogoController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->organization_id || $user->isOwner(), 403);

        $data = $request->validate([
            'organization_id' => [$user->isOwner() ? 'required' : 'nullable', 'integer', 'exists:organizations,id'],
            'logo' => ['required', 'image', 'max:2048'],
        ]);

        $organizationId = $user->isOwner()
            ? (int) $data['organization_id']
            : (int) $user->organization_id;

        $org = Organization::query()->findOrFail($organizationId);

        if ($org->logo_path) {
            Storage::disk('public')->delete($org->logo_path);
        }

        $path = $request->file('logo')->store('logos/'.$org->id, 'public');
        $org->update(['logo_path' => $path]);

        return response()->json([
            'data' => $org->fresh(),
            'logo_url' => Storage::disk('public')->url($path),
        ], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->organization_id || $user->isOwner(), 403);

        $organizationId = $user->isOwner()
            ? $request->integer('organization_id')
            : (int) $user->organization_id;

        abort_unless($organizationId, 422, 'organization_id is required.');

        $org = Organization::query()->findOrFail($organizationId);

        if ($org->logo_path) {
            Storage::disk('public')->delete($org->logo_path);
            $org->update(['logo_path' => null]);
        }

        return response()->json(['message' => 'Logo removed', 'data' => $org->fresh()]);
    }
}
