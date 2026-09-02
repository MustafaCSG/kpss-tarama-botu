$j = Get-Content sorular.json -Raw | ConvertFrom-Json
"Toplam: $($j.Count)"
"--- Yil ---"
$j | Group-Object yil | Sort-Object Name | ForEach-Object { "$($_.Name): $($_.Count)" }
"--- Sinav ---"
$j | Group-Object sinav | Sort-Object Count -Descending | ForEach-Object { "$($_.Name): $($_.Count)" }
"--- Konu ---"
$j | Group-Object konu | Sort-Object Count -Descending | ForEach-Object { "$($_.Name): $($_.Count)" }
