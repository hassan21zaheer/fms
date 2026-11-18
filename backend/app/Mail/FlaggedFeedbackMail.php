<?php

namespace App\Mail;

use App\Models\Submission;
use App\Support\PhoneNumber;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class FlaggedFeedbackMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Submission $submission) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Flagged feedback received - '.$this->submission->organization?->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: view('emails.flagged-feedback', [
                'submission' => $this->submission,
                'whatsappLink' => $this->whatsappLink(),
            ])->render(),
        );
    }

    private function whatsappLink(): ?string
    {
        $phone = PhoneNumber::forWhatsApp($this->submission->customer_phone, $this->submission->organization?->default_country_code);
        if (! $phone) {
            return null;
        }

        $text = rawurlencode('Hello, we received your feedback and would like to help.');

        return "https://wa.me/{$phone}?text={$text}";
    }
}
