<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FMS Feedback Records</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .meta { color: #666; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px; text-align: left; vertical-align: top; }
        th { background: #e1eefb; }
        .flag { color: #c0334a; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Feedback Records</h1>
    <div class="meta">Generated at {{ $generatedAt }} &middot; {{ $rows->count() }} records</div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Submitted</th>
                <th>Branch / Location</th>
                <th>Customer</th>
                <th>Score</th>
                <th>Flagged</th>
                <th>Case</th>
                <th>Answers</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    <td>{{ $row->id }}</td>
                    <td>{{ optional($row->submitted_at)->format('Y-m-d H:i') }}</td>
                    <td>{{ $row->branch?->name ?? '-' }} / {{ $row->location?->name ?? '-' }}</td>
                    <td>
                        {{ $row->customer_name ?: 'Anonymous' }}<br>
                        {{ $row->customer_phone }} {{ $row->customer_email }}
                        @foreach ($row->customer_extra ?? [] as $extra)
                            <br>{{ $extra['label'] ?? '' }}: {{ $extra['value'] ?? '' }}
                        @endforeach
                    </td>
                    <td>{{ $row->overall_score ?? '-' }} ({{ $row->rating_band ?? '-' }})</td>
                    <td>@if ($row->is_flagged)<span class="flag">Yes</span>@else No @endif</td>
                    <td>{{ $row->feedbackCase?->status ?? '-' }}</td>
                    <td>
                        @foreach ($row->answers as $answer)
                            {{ $answer->question_text_snapshot }}:
                            {{ $answer->option_label_snapshot ?: ($answer->free_text_value ?: $answer->score_snapshot) }}<br>
                        @endforeach
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
