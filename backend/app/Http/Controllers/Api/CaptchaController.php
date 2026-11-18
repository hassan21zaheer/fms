<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CaptchaService;
use Illuminate\Http\JsonResponse;

class CaptchaController extends Controller
{
    public function __construct(private CaptchaService $captcha) {}

    public function __invoke(): JsonResponse
    {
        if (! $this->captcha->enabled()) {
            return response()->json([
                'enabled' => false,
                'captcha_id' => null,
                'question' => null,
            ]);
        }

        return response()->json([
            'enabled' => true,
            ...$this->captcha->challenge(),
        ]);
    }
}
