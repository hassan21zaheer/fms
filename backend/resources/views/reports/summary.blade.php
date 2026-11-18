<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FMS Feedback Report</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #f3f4f6; }
        .meta { color: #666; margin-bottom: 16px; }
    </style>
</head>
<body>
    <h1>Feedback Report</h1>
    <div class="meta">Generated at {{ $generatedAt }}</div>

    <h2>Overall</h2>
    <table>
        <tr><th>Total responses</th><td>{{ $summary['overall']['total_responses'] }}</td></tr>
        <tr><th>Average score</th><td>{{ $summary['overall']['average_score'] }}</td></tr>
        <tr><th>Flagged</th><td>{{ $summary['overall']['flagged_count'] }}</td></tr>
    </table>

    <h2>By branch</h2>
    <table>
        <thead>
            <tr><th>Branch</th><th>Responses</th><th>Average score</th></tr>
        </thead>
        <tbody>
            @foreach ($summary['by_branch'] as $row)
                <tr>
                    <td>{{ $row['name'] }}</td>
                    <td>{{ $row['responses'] }}</td>
                    <td>{{ round((float) $row['average_score'], 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <h2>Question breakdown (lowest first)</h2>
    <table>
        <thead>
            <tr><th>Question</th><th>Category</th><th>Average</th><th>Answers</th></tr>
        </thead>
        <tbody>
            @foreach ($summary['question_breakdown'] as $row)
                <tr>
                    <td>{{ $row['question_text_snapshot'] }}</td>
                    <td>{{ $row['category_name_snapshot'] }}</td>
                    <td>{{ round((float) $row['average_score'], 2) }}</td>
                    <td>{{ $row['answers'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
