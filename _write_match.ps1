$content = Get-Content "C:\Users\Holms\repos\cea-lol-broadcast\_test_match_content.txt" -Raw
[System.IO.File]::WriteAllText('C:\Users\Holms\repos\cea-lol-broadcast\src\views\MatchView.tsx', $content, [System.Text.Encoding]::UTF8)
Write-Host "written $($content.Length) chars"
