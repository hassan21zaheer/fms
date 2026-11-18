<?php

use App\Http\Controllers\Api\Admin\BranchController;
use App\Http\Controllers\Api\Admin\CaseController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\CustomerController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\DomainController;
use App\Http\Controllers\Api\Admin\FeedbackController;
use App\Http\Controllers\Api\Admin\FormController;
use App\Http\Controllers\Api\Admin\FormOverrideController;
use App\Http\Controllers\Api\Admin\LocationController;
use App\Http\Controllers\Api\Admin\LogoController;
use App\Http\Controllers\Api\Admin\OrganizationController;
use App\Http\Controllers\Api\Admin\PlanController;
use App\Http\Controllers\Api\Admin\QrCodeController;
use App\Http\Controllers\Api\Admin\QuestionController;
use App\Http\Controllers\Api\Admin\ReportController;
use App\Http\Controllers\Api\Admin\ReportTabsController;
use App\Http\Controllers\Api\Admin\ScoringController;
use App\Http\Controllers\Api\Admin\SettingsController;
use App\Http\Controllers\Api\Admin\TeamController;
use App\Http\Controllers\Api\Admin\TemplateController;
use App\Http\Controllers\Api\Admin\TranslationController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CaptchaController;
use App\Http\Controllers\Api\HostResolveController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PublicFormController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public
    Route::get('/captcha', CaptchaController::class)->middleware('throttle:30,1');
    Route::get('/resolve-host', HostResolveController::class)->middleware('throttle:60,1');

    Route::get('/f/{org}/{branch}/{location}', [PublicFormController::class, 'show'])
        ->middleware('throttle:60,1');
    Route::post('/f/{org}/{branch}/{location}/submit', [PublicFormController::class, 'submit'])
        ->middleware('throttle:20,1');

    // Auth (public)
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

        Route::get('/dashboard', DashboardController::class)
            ->middleware('permission:view feedback|view reports|manage cases');

        Route::middleware('permission:manage organizations|manage branches')->group(function () {
            Route::get('/organizations/{organization}', [OrganizationController::class, 'show']);
        });

        Route::middleware('permission:manage organizations')->group(function () {
            Route::get('/organizations', [OrganizationController::class, 'index']);

            Route::post('/organizations', [OrganizationController::class, 'store']);
            Route::patch('/organizations/{organization}', [OrganizationController::class, 'update']);
            Route::post('/organizations/{organization}/suspend', [OrganizationController::class, 'suspend']);
            Route::post('/organizations/{organization}/activate', [OrganizationController::class, 'activate']);
            Route::delete('/organizations/{organization}', [OrganizationController::class, 'destroy']);
            Route::post('/organizations/{organization}/restore', [OrganizationController::class, 'restore']);
        });

        Route::middleware('permission:manage plans')->group(function () {
            Route::get('/plans', [PlanController::class, 'index']);
            Route::post('/plans', [PlanController::class, 'store']);
            Route::patch('/plans/{plan}', [PlanController::class, 'update']);
            Route::delete('/plans/{plan}', [PlanController::class, 'destroy']);
        });

        Route::middleware('permission:manage branches')->group(function () {
            Route::get('/branches', [BranchController::class, 'index']);
            Route::post('/branches', [BranchController::class, 'store']);
            Route::put('/branches/{branch}', [BranchController::class, 'update']);
            Route::patch('/branches/{branch}', [BranchController::class, 'update']);
            Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);
        });

        Route::middleware('permission:manage locations')->group(function () {
            Route::get('/locations', [LocationController::class, 'index']);
            Route::post('/locations', [LocationController::class, 'store']);
            Route::put('/locations/{location}', [LocationController::class, 'update']);
            Route::patch('/locations/{location}', [LocationController::class, 'update']);
            Route::delete('/locations/{location}', [LocationController::class, 'destroy']);
            Route::get('/locations/qr-sheet', [QrCodeController::class, 'sheet']);
            Route::post('/locations/{location}/qr', [QrCodeController::class, 'generate']);
            Route::get('/locations/{location}/qr/download', [QrCodeController::class, 'download']);
        });

        Route::middleware('permission:manage forms')->group(function () {
            Route::get('/forms', [FormController::class, 'index']);
            Route::post('/forms', [FormController::class, 'store']);
            Route::get('/forms/{form}', [FormController::class, 'show']);
            Route::put('/forms/{form}', [FormController::class, 'update']);
            Route::patch('/forms/{form}', [FormController::class, 'update']);
            Route::post('/forms/{form}/go-live', [FormController::class, 'goLive']);
            Route::post('/forms/{form}/questions', [QuestionController::class, 'store']);
            Route::post('/forms/{form}/questions/reorder', [QuestionController::class, 'reorder']);
            Route::patch('/questions/{question}', [QuestionController::class, 'update']);
            Route::delete('/questions/{question}', [QuestionController::class, 'destroy']);

            Route::get('/forms/{form}/categories', [CategoryController::class, 'index']);
            Route::post('/forms/{form}/categories', [CategoryController::class, 'store']);
            Route::patch('/categories/{category}', [CategoryController::class, 'update']);
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

            Route::get('/forms/{form}/branches/{branch}/overrides', [FormOverrideController::class, 'index']);
            Route::post('/forms/{form}/branches/{branch}/overrides', [FormOverrideController::class, 'upsert']);
            Route::delete('/forms/{form}/branches/{branch}/overrides/{question}', [FormOverrideController::class, 'destroy']);

            Route::get('/templates', [TemplateController::class, 'index']);
            Route::get('/templates/library', [TemplateController::class, 'library']);
            Route::post('/templates/apply', [TemplateController::class, 'apply']);

            Route::get('/translations', [TranslationController::class, 'index']);
            Route::post('/translations', [TranslationController::class, 'upsert']);
            Route::delete('/translations/{translation}', [TranslationController::class, 'destroy']);
        });

        Route::middleware('permission:view feedback')->group(function () {
            Route::get('/feedback', [FeedbackController::class, 'index']);
            Route::get('/feedback/export.csv', [FeedbackController::class, 'exportCsv']);
            Route::get('/feedback/export.pdf', [FeedbackController::class, 'exportPdf']);
            Route::get('/feedback/{submission}/export.csv', [FeedbackController::class, 'exportRecordCsv']);
            Route::get('/feedback/{submission}/export.pdf', [FeedbackController::class, 'exportRecordPdf']);
            Route::get('/feedback/{submission}', [FeedbackController::class, 'show']);
            Route::get('/customers', [CustomerController::class, 'index']);
            Route::get('/customers/export.csv', [CustomerController::class, 'exportCsv']);
            Route::get('/customers/{customer}', [CustomerController::class, 'show']);
        });

        Route::middleware('permission:manage customers')->group(function () {
            Route::post('/customers', [CustomerController::class, 'store']);
            Route::patch('/customers/{customer}', [CustomerController::class, 'update']);
            Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
        });

        Route::middleware('permission:contact customers')->group(function () {
            Route::get('/customers/{customer}/messages', [CustomerController::class, 'messages']);
            Route::post('/customers/{customer}/email', [CustomerController::class, 'sendEmail']);
            Route::post('/customers/{customer}/whatsapp', [CustomerController::class, 'sendWhatsApp']);
        });

        Route::middleware('permission:view reports|manage cases')->group(function () {
            Route::get('/reports/filters', [ReportTabsController::class, 'filters']);
            Route::get('/reports/cases', [ReportTabsController::class, 'casesSummary']);
        });

        Route::post('/feedback/{submission}/case', [FeedbackController::class, 'escalate'])
            ->middleware('permission:manage cases');

        Route::middleware('permission:manage cases')->group(function () {
            Route::get('/cases', [CaseController::class, 'index']);
            Route::get('/cases/assignees', [CaseController::class, 'assignees']);
            Route::get('/cases/{feedback_case}', [CaseController::class, 'show']);
            Route::patch('/cases/{feedback_case}', [CaseController::class, 'update']);
            Route::post('/cases/{feedback_case}/notes', [CaseController::class, 'addNote']);
        });

        Route::middleware('permission:manage users')->group(function () {
            Route::get('/team/options', [TeamController::class, 'options']);
            Route::get('/team/roles', [TeamController::class, 'roles']);
            Route::put('/team/roles/{role}/permissions', [TeamController::class, 'updateRolePermissions'])
                ->whereIn('role', ['owner', 'superadmin', 'admin', 'staff']);
            Route::post('/team/roles/{role}/reset', [TeamController::class, 'resetRolePermissions'])
                ->whereIn('role', ['owner', 'superadmin', 'admin', 'staff']);
            Route::get('/users', [UserController::class, 'index']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::post('/users/{user}/password', [UserController::class, 'resetPassword']);
            Route::post('/users/{user}/sessions/revoke', [UserController::class, 'revokeSessions']);
            Route::post('/users', [UserController::class, 'store']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::patch('/users/{user}', [UserController::class, 'update']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
        });

        Route::middleware('permission:view reports')->group(function () {
            Route::get('/reports/overview', [ReportTabsController::class, 'overview']);
            Route::get('/reports/categories', [ReportTabsController::class, 'categories']);
            Route::get('/reports/branches', [ReportTabsController::class, 'branches']);
            Route::get('/reports/locations', [ReportTabsController::class, 'locations']);
            Route::get('/reports/summary', [ReportController::class, 'summary']);
            Route::get('/reports/export.csv', [ReportController::class, 'exportCsv']);
            Route::get('/reports/export.pdf', [ReportController::class, 'exportPdf']);
        });

        Route::middleware('permission:manage settings')->group(function () {
            Route::get('/settings', [SettingsController::class, 'show']);
            Route::patch('/settings/organization', [SettingsController::class, 'updateOrganization']);
            Route::patch('/settings/notifications', [SettingsController::class, 'updateNotifications']);
            Route::post('/settings/logo', [LogoController::class, 'store']);
            Route::delete('/settings/logo', [LogoController::class, 'destroy']);
            Route::get('/settings/domain', [DomainController::class, 'show']);
            Route::post('/settings/domain/connect', [DomainController::class, 'connect']);
            Route::post('/settings/domain/verify', [DomainController::class, 'verify']);
            Route::delete('/settings/domain', [DomainController::class, 'disconnect']);
        });

        Route::patch('/settings/scoring', [SettingsController::class, 'updateScoring'])
            ->middleware('permission:manage scoring');

        Route::middleware('permission:manage scoring')->group(function () {
            Route::get('/scoring/settings', [ScoringController::class, 'show']);
            Route::patch('/scoring/settings', [ScoringController::class, 'update']);
            Route::put('/scoring/forms/{form}/category-weights', [ScoringController::class, 'updateCategoryWeights']);
            Route::post('/scoring/forms/{form}/preview', [ScoringController::class, 'preview']);
        });
    });
});
