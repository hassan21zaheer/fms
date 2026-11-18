<?php

namespace App\Services;

use App\Mail\CustomerOutreachMail;
use App\Models\Customer;
use App\Models\CustomerMessage;
use App\Models\User;
use App\Support\PhoneNumber;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

class CustomerCommunicationService
{
    public function sendEmail(
        Customer $customer,
        User $actor,
        string $subject,
        string $body,
        ?int $submissionId = null
    ): CustomerMessage {
        if (blank($customer->email)) {
            throw new InvalidArgumentException('Customer has no email address.');
        }

        $message = CustomerMessage::query()->create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'user_id' => $actor->id,
            'submission_id' => $submissionId,
            'channel' => 'email',
            'to_address' => $customer->email,
            'subject' => $subject,
            'body' => $body,
            'status' => 'queued',
        ]);

        try {
            Mail::to($customer->email)->send(new CustomerOutreachMail($subject, $body, $customer));
            $message->update([
                'status' => 'sent',
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            $message->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
            throw $e;
        }

        return $message->fresh();
    }

    public function prepareWhatsApp(
        Customer $customer,
        User $actor,
        string $body,
        ?int $submissionId = null
    ): CustomerMessage {
        if (blank($customer->phone)) {
            throw new InvalidArgumentException('Customer has no phone number.');
        }

        $phone = PhoneNumber::forWhatsApp($customer->phone, $customer->organization?->default_country_code);
        $link = 'https://wa.me/'.$phone.'?text='.rawurlencode($body);

        return CustomerMessage::query()->create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'user_id' => $actor->id,
            'submission_id' => $submissionId,
            'channel' => 'whatsapp',
            'to_address' => $customer->phone,
            'subject' => null,
            'body' => $body,
            'status' => 'link_ready',
            'external_link' => $link,
            'sent_at' => now(),
        ]);
    }
}
