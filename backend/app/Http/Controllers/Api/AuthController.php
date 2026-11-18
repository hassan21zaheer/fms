<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationSetting;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\ScoringSetting;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'organization_name' => ['required', 'string', 'max:120'],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $result = DB::transaction(function () use ($data) {
            $plan = Plan::query()->where('slug', 'starter')->first();

            $org = Organization::query()->create([
                'plan_id' => $plan?->id,
                'name' => $data['organization_name'],
                'slug' => Str::slug($data['organization_name']).'-'.Str::lower(Str::random(4)),
                'branch_limit' => $plan?->branch_limit ?? 3,
                'plan_expires_at' => now()->addMonth(),
                'welcome_text' => 'We value your feedback',
                'thank_you_text' => 'Thank you for your feedback!',
                'privacy_note' => 'Your feedback helps us improve. We protect your personal data.',
                'status' => 'active',
            ]);

            ScoringSetting::query()->create([
                'organization_id' => $org->id,
                ...ScoringSetting::defaults(),
            ]);

            NotificationSetting::query()->create([
                'organization_id' => $org->id,
                'email_on_flagged' => true,
                'notify_emails' => [$data['email']],
            ]);

            $user = User::query()->create([
                'organization_id' => $org->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'is_active' => true,
            ]);
            $user->assignRole('superadmin');

            return compact('org', 'user');
        });

        $result['user']->forceFill(['last_login_at' => now()])->save();
        $token = $result['user']->createToken('admin')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($result['user']->fresh()),
            'organization' => $result['org'],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account is inactive. Please contact an administrator.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('admin')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Logged out from all devices']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::sendResetLink($request->only('email'));

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password reset link sent. Check your email (or mail log in local).',
            'status' => __($status),
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password has been reset. Please login again.',
            'status' => __($status),
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        /** @var User $user */
        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
        ])->save();

        // Keep current token, revoke others
        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current, fn ($q) => $q->where('id', '!=', $current->id))
            ->delete();

        return response()->json(['message' => 'Password changed successfully.']);
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing(['organization', 'branch', 'roles', 'permissions']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'organization_id' => $user->organization_id,
            'branch_id' => $user->branch_id,
            'is_active' => $user->is_active,
            'organization' => $user->organization,
            'branch' => $user->branch,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }
}
