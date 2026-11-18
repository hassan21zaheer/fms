<?php

namespace App\Services;

use App\Models\FormCategory;
use App\Models\Organization;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Translation;
use Illuminate\Support\Collection;

class TranslationService
{
    public function rtlLocales(): array
    {
        return ['ar', 'ur', 'he', 'fa', 'ps'];
    }

    public function isRtl(?string $locale, Organization $organization): bool
    {
        if ($organization->rtl_enabled) {
            return true;
        }

        return in_array(strtolower((string) $locale), $this->rtlLocales(), true);
    }

    public function upsert(
        int $organizationId,
        string $type,
        int $id,
        string $locale,
        string $field,
        string $value
    ): Translation {
        return Translation::query()->updateOrCreate(
            [
                'organization_id' => $organizationId,
                'translatable_type' => $type,
                'translatable_id' => $id,
                'locale' => strtolower($locale),
                'field' => $field,
            ],
            ['value' => $value]
        );
    }

    public function mapForOrganization(int $organizationId, string $locale): Collection
    {
        return Translation::query()
            ->where('organization_id', $organizationId)
            ->where('locale', strtolower($locale))
            ->get()
            ->groupBy(fn ($t) => $t->translatable_type.':'.$t->translatable_id);
    }

    public function applyToFormPayload(Organization $organization, array $payload, ?string $locale): array
    {
        $locale = strtolower($locale ?: $organization->default_locale ?: $organization->language ?: 'en');
        $payload['locale'] = $locale;
        $payload['rtl'] = $this->isRtl($locale, $organization);

        if ($locale === strtolower($organization->default_locale ?: 'en')) {
            return $payload;
        }

        $map = $this->mapForOrganization($organization->id, $locale);

        foreach (['welcome_text', 'thank_you_text', 'privacy_note'] as $field) {
            $key = 'organization:'.$organization->id;
            $translation = $map->get($key)?->firstWhere('field', $field);
            if ($translation) {
                $payload['organization'][$field] = $translation->value;
            }
        }

        if (! empty($payload['form']['categories'])) {
            $payload['form']['categories'] = collect($payload['form']['categories'])->map(function ($category) use ($map) {
                $id = is_array($category) ? ($category['id'] ?? null) : $category->id;
                $arr = is_array($category) ? $category : $category->toArray();
                $translation = $map->get('form_category:'.$id)?->firstWhere('field', 'name');
                if ($translation) {
                    $arr['name'] = $translation->value;
                }

                return $arr;
            })->values()->all();
        }

        if (! empty($payload['form']['questions'])) {
            $payload['form']['questions'] = collect($payload['form']['questions'])->map(function ($question) use ($map) {
                $arr = is_array($question) ? $question : (array) $question;
                $id = $arr['id'] ?? null;
                $text = $map->get('question:'.$id)?->firstWhere('field', 'text');
                if ($text) {
                    $arr['text'] = $text->value;
                }

                $arr['options'] = collect($arr['options'] ?? [])->map(function ($option) use ($map) {
                    $opt = is_array($option) ? $option : (array) $option;
                    $label = $map->get('question_option:'.($opt['id'] ?? ''))?->firstWhere('field', 'label');
                    if ($label) {
                        $opt['label'] = $label->value;
                    }

                    return $opt;
                })->values()->all();

                return $arr;
            })->values()->all();
        }

        return $payload;
    }

    public function typeFromModel(string $model): string
    {
        return match ($model) {
            Question::class, 'question' => 'question',
            QuestionOption::class, 'question_option' => 'question_option',
            FormCategory::class, 'form_category' => 'form_category',
            Organization::class, 'organization' => 'organization',
            default => $model,
        };
    }
}
