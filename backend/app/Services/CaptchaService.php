<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CaptchaService
{
    public function enabled(): bool
    {
        return (bool) config('fms.captcha_enabled', true);
    }

    public function challenge(): array
    {
        $a = random_int(1, 9);
        $b = random_int(1, 9);
        $id = (string) Str::uuid();

        Cache::put($this->key($id), (string) ($a + $b), now()->addMinutes(10));

        return [
            'captcha_id' => $id,
            'question' => "What is {$a} + {$b}?",
            'expires_in' => 600,
        ];
    }

    public function assertValid(?string $captchaId, ?string $answer): void
    {
        if (! $this->enabled()) {
            return;
        }

        if (! $captchaId || $answer === null || $answer === '') {
            throw new InvalidArgumentException('Captcha is required.');
        }

        $expected = Cache::pull($this->key($captchaId));

        if ($expected === null) {
            throw new InvalidArgumentException('Captcha expired or invalid. Please refresh.');
        }

        if (trim((string) $answer) !== $expected) {
            throw new InvalidArgumentException('Captcha answer is incorrect.');
        }
    }

    private function key(string $id): string
    {
        return 'fms_captcha_'.$id;
    }
}
