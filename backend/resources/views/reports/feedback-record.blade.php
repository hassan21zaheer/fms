<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Feedback Record #{{ $submission->id }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-top: 22px; }
        .meta { color: #666; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; width: 30%; }
        .flag { color: #c0334a; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Feedback Record #{{ $submission->id }}</h1>
    <div class="meta">Generated at {{ $generatedAt }}</div>

    <h2>Summary</h2>
    <table>
        <tr><th>Submitted</th><td>{{ optional($submission->submitted_at)->toDateTimeString() }}</td></tr>
        <tr><th>Branch / Location</th><td>{{ $submission->branch?->name ?? '-' }} / {{ $submission->location?->name ?? '-' }}</td></tr>
        <tr><th>Overall score</th><td>{{ $submission->overall_score ?? '-' }} ({{ $submission->rating_band ?? '-' }})</td></tr>
        <tr><th>Flagged</th><td>@if ($submission->is_flagged)<span class="flag">Yes</span>@else No @endif</td></tr>
        @if (! empty($submission->flag_reasons))
            <tr><th>Flag reasons</th><td>{{ implode('; ', (array) $submission->flag_reasons) }}</td></tr>
        @endif
    </table>

    <h2>Customer</h2>
    <table>
        <tr><th>Name</th><td>{{ $submission->customer_name ?: 'Anonymous' }}</td></tr>
        <tr><th>Phone</th><td>{{ $submission->customer_phone ?: '-' }}</td></tr>
        <tr><th>Email</th><td>{{ $submission->customer_email ?: '-' }}</td></tr>
        @foreach ($submission->customer_extra ?? [] as $extra)
            <tr><th>{{ $extra['label'] ?? '' }}</th><td>{{ $extra['value'] ?? '-' }}</td></tr>
        @endforeach
    </table>

    <h2>Answers</h2>
    <table>
        <thead>
            <tr><th>Question</th><th>Answer</th></tr>
        </thead>
        <tbody>
            @foreach ($submission->answers as $answer)
                <tr>
                    <td>
                        {{ $answer->question_text_snapshot }}
                        @if ($answer->category_name_snapshot)<br><small>{{ $answer->category_name_snapshot }}</small>@endif
                    </td>
                    <td>{{ $answer->option_label_snapshot ?: ($answer->free_text_value ?: ($answer->score_snapshot ?? '-')) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if ($submission->feedbackCase)
        <h2>Case #{{ $submission->feedbackCase->id }} ({{ $submission->feedbackCase->status }})</h2>
        <table>
            <thead>
                <tr><th>When / Who</th><th>Note</th></tr>
            </thead>
            <tbody>
                @forelse ($submission->feedbackCase->notes as $note)
                    <tr>
                        <td>{{ optional($note->created_at)->format('Y-m-d H:i') }}<br>{{ $note->user?->name }}</td>
                        <td>{{ $note->note }}</td>
                    </tr>
                @empty
                    <tr><td colspan="2">No notes.</td></tr>
                @endforelse
            </tbody>
        </table>
    @endif
</body>
</html>
