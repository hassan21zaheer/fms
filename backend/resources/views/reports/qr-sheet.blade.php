<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Location QR codes</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .meta { color: #666; font-size: 11px; margin-bottom: 14px; }
        table.grid { width: 100%; border-collapse: separate; border-spacing: 10px; }
        td.card { width: 50%; padding: 14px; border: 1px solid #ddd; border-radius: 10px; text-align: center; vertical-align: top; }
        td.card img { width: 190px; height: 190px; }
        .name { font-size: 15px; font-weight: bold; margin-top: 6px; }
        .branch { font-size: 11px; color: #666; }
        .url { font-size: 8px; color: #888; word-break: break-all; margin-top: 4px; }
    </style>
</head>
<body>
    <h1>Location QR codes</h1>
    <div class="meta">Generated at {{ $generatedAt }} &middot; {{ $items->count() }} locations</div>

    <table class="grid">
        @foreach ($items->chunk(2) as $row)
            <tr>
                @foreach ($row as $item)
                    <td class="card">
                        <img src="{{ $item['image'] }}" alt="QR code">
                        <div class="name">{{ $item['name'] }}</div>
                        <div class="branch">{{ $item['branch'] }}</div>
                        <div class="url">{{ $item['url'] }}</div>
                    </td>
                @endforeach
                @if ($row->count() < 2)
                    <td></td>
                @endif
            </tr>
        @endforeach
    </table>
</body>
</html>
