<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color:#111;">
    <h2>Weekly feedback summary</h2>
    <p>{{ $organization->name }}</p>
    <ul>
        <li>Total responses: {{ $summary['overall']['total_responses'] ?? 0 }}</li>
        <li>Average score: {{ $summary['overall']['average_score'] ?? 'n/a' }}</li>
        <li>Flagged: {{ $summary['overall']['flagged_count'] ?? 0 }}</li>
        <li>Open cases: {{ $summary['case_resolution']['open_cases'] ?? 0 }}</li>
        <li>Avg resolution hours: {{ $summary['case_resolution']['avg_resolution_hours'] ?? 'n/a' }}</li>
    </ul>

    @if (!empty($summary['recommendations']))
        <h3>Recommendations</h3>
        <ul>
            @foreach ($summary['recommendations'] as $rec)
                <li>{{ $rec['message'] }}</li>
            @endforeach
        </ul>
    @endif
</body>
</html>
