<?php

namespace App\Mail;

use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WeeklySummaryMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Organization $organization,
        public array $summary
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Weekly feedback summary - '.$this->organization->name
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: view('emails.weekly-summary', [
                'organization' => $this->organization,
                'summary' => $this->summary,
            ])->render()
        );
    }
}
