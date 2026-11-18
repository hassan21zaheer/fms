<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Translation;
use App\Services\TranslationService;
use App\Support\AuthorizesOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TranslationController extends Controller
{
    use AuthorizesOrganization;

    public function __construct(private TranslationService $translations) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $organizationId = $this->resolveOrganizationId($user, $request->integer('organization_id') ?: null);

        $items = Translation::query()
            ->where('organization_id', $organizationId)
            ->when($request->filled('locale'), fn ($q) => $q->where('locale', strtolower((string) $request->string('locale'))))
            ->when($request->filled('type'), fn ($q) => $q->where('translatable_type', (string) $request->string('type')))
            ->orderBy('locale')
            ->orderBy('translatable_type')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function upsert(Request $request): JsonResponse
    {
        $user = $request->user();
        $organizationId = $this->resolveOrganizationId($user, $request->integer('organization_id') ?: null);

        $data = $request->validate([
            'organization_id' => [$user->isOwner() ? 'required' : 'nullable', 'integer'],
            'translatable_type' => ['required', Rule::in(['question', 'question_option', 'form_category', 'organization'])],
            'translatable_id' => ['required', 'integer'],
            'locale' => ['required', 'string', 'max:10'],
            'field' => ['required', 'string', 'max:50'],
            'value' => ['required', 'string'],
        ]);

        $translation = $this->translations->upsert(
            $organizationId,
            $data['translatable_type'],
            (int) $data['translatable_id'],
            $data['locale'],
            $data['field'],
            $data['value']
        );

        return response()->json(['data' => $translation]);
    }

    public function destroy(Request $request, Translation $translation): JsonResponse
    {
        $this->assertSameOrganization($request->user(), $translation);
        $translation->delete();

        return response()->json(['message' => 'Translation deleted']);
    }
}
