<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontend = rtrim(config('app.frontend_url', config('app.url')), '/');
        $url = $frontend.'/reset-password?token='.$this->token.'&email='.urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reset your FMS password')
            ->line('You requested a password reset for your FMS account.')
            ->line('Use this token with POST /api/v1/auth/reset-password:')
            ->line('Token: '.$this->token)
            ->action('Reset Password', $url)
            ->line('If you did not request this, ignore this email.');
    }
}
