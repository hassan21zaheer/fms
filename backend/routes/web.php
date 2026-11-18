<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/**
 * The admin and guest screens are one React app. After `npm run build` in frontend-new it lives in public/app
 * and Laravel serves it from this same domain; before that, guest links go to FRONTEND_URL (the dev server).
 */
$spaIndex = public_path('app/index.html');

Route::get('/', function () use ($spaIndex) {
    return is_file($spaIndex) ? response()->file($spaIndex) : view('welcome');
});

Route::get('/f/{org}/{branch}/{location}', function (string $org, string $branch, string $location) use ($spaIndex) {
    if (is_file($spaIndex)) {
        return response()->file($spaIndex);
    }

    $frontend = rtrim((string) config('app.frontend_url'), '/');

    return redirect()->away("{$frontend}/f/{$org}/{$branch}/{$location}");
});

Route::fallback(function (Request $request) use ($spaIndex) {
    abort_if($request->is('api/*') || $request->is('storage/*') || ! is_file($spaIndex), 404);

    return response()->file($spaIndex);
});
