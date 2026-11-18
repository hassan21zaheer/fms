<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #111;">
    <h2>Flagged feedback alert</h2>
    <p>
        A low-score submission was received for
        <strong>{{ $submission->organization?->name }}</strong>
        / {{ $submission->branch?->name }}
        / {{ $submission->location?->name }}.
    </p>
    <ul>
        <li>Score: {{ $submission->overall_score }} ({{ $submission->rating_band }})</li>
        <li>Customer: {{ $submission->customer_name ?: 'N/A' }}</li>
        <li>Phone: {{ $submission->customer_phone ?: 'N/A' }}</li>
        <li>Email: {{ $submission->customer_email ?: 'N/A' }}</li>
        <li>Submitted at: {{ optional($submission->submitted_at)->toDateTimeString() }}</li>
    </ul>
    @if (!empty($submission->flag_reasons))
        <p><strong>Reasons:</strong></p>
        <ul>
            @foreach ($submission->flag_reasons as $reason)
                <li>{{ $reason }}</li>
            @endforeach
        </ul>
    @endif
    @if ($whatsappLink)
        <p><a href="{{ $whatsappLink }}">Open WhatsApp follow-up link</a></p>
    @endif
</body>
</html>
