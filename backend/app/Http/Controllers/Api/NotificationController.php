<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $items = $user->notifications()->latest()->limit(20)->get()->map(fn ($notification) => [
            'id' => $notification->id,
            'kind' => $notification->data['kind'] ?? 'info',
            'title' => $notification->data['title'] ?? 'Notification',
            'body' => $notification->data['body'] ?? '',
            'page' => $notification->data['page'] ?? null,
            'case_id' => $notification->data['case_id'] ?? null,
            'submission_id' => $notification->data['submission_id'] ?? null,
            'read' => $notification->read_at !== null,
            'created_at' => $notification->created_at,
        ]);

        return response()->json([
            'data' => $items,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $request->user()->notifications()->whereKey($notification)->first()?->markAsRead();

        return response()->json(['unread_count' => $request->user()->unreadNotifications()->count()]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['unread_count' => 0]);
    }
}
