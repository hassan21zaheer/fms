<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Services\QrCodeService;
use App\Support\AuthorizesOrganization;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class QrCodeController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private QrCodeService $qrCodes) {}

    public function generate(Request $request, Location $location): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $location);
        $this->assertBranchAccess($request->user(), (int) $location->branch_id);

        $location = $this->qrCodes->generateAndStore($location)->load(['form:id,name,is_active', 'branch:id,name,slug']);

        return response()->json([
            'data' => $location,
            'public_url' => $this->qrCodes->publicUrl($location),
            'download_url' => url('/api/v1/locations/'.$location->id.'/qr/download'),
            'qr_url' => $location->qr_code_path ? Storage::disk('public')->url($location->qr_code_path) : null,
            'form' => $location->form
                ? [
                    'id' => $location->form->id,
                    'name' => $location->form->name,
                    'is_active' => $location->form->is_active,
                ]
                : null,
        ]);
    }

    /** A printable PDF with the QR code of every location the user can reach (optionally one branch). */
    public function sheet(Request $request)
    {
        $user = $request->user();

        $locations = Location::query()
            ->with(['branch:id,name,slug', 'organization'])
            ->when(! $user->isOwner(), fn ($q) => $q->where('organization_id', $user->organization_id))
            ->when($user->isOwner() && $request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($user->branch_id && ! $user->isOwner(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->orderBy('branch_id')
            ->orderBy('name')
            ->get();

        abort_if($locations->isEmpty(), 422, 'There are no locations to print.');

        $items = $locations->map(function (Location $location) {
            if (! $location->qr_code_path || ! Storage::disk('public')->exists($location->qr_code_path)) {
                $location = $this->qrCodes->generateAndStore($location)->load(['branch:id,name,slug', 'organization']);
            }

            return [
                'name' => $location->name,
                'branch' => $location->branch?->name,
                'url' => $this->qrCodes->publicUrl($location),
                'image' => 'data:image/png;base64,'.base64_encode(Storage::disk('public')->get($location->qr_code_path)),
            ];
        });

        return Pdf::loadView('reports.qr-sheet', ['items' => $items, 'generatedAt' => now()->toDateTimeString()])
            ->download('location-qr-codes.pdf');
    }

    public function download(Request $request, Location $location): StreamedResponse
    {
        $this->assertSameOrganization($request->user(), $location);
        $this->assertBranchAccess($request->user(), (int) $location->branch_id);

        if (! $location->qr_code_path || ! Storage::disk('public')->exists($location->qr_code_path)) {
            $location = $this->qrCodes->generateAndStore($location);
        }

        return Storage::disk('public')->download(
            $location->qr_code_path,
            sprintf('%s-qr.png', $location->slug)
        );
    }
}
