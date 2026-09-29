Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 810
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Background
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
$g.FillRectangle($bgBrush, 0, 0, $width, $height)

# 6 Tiles definition (3 cols x 2 rows)
$tiles = @(
    @{ title = "ของที่ต้องสั่ง"; sub = "DQ สั่งของ (เช็คสต็อกขาด)"; icon = "🛒"; color = [System.Drawing.Color]::FromArgb(220, 38, 38) },    # Red
    @{ title = "ของใกล้หมดอายุ"; sub = "DQ ใกล้หมดอายุ (FIFO)"; icon = "⏳"; color = [System.Drawing.Color]::FromArgb(217, 119, 6) },     # Amber
    @{ title = "รับของเข้าสต็อก"; sub = "DQ รับเข้า (เติมของ/ระบุวัน)"; icon = "📦"; color = [System.Drawing.Color]::FromArgb(5, 150, 105) },   # Emerald Green
    @{ title = "ปรับวันหมดอายุ"; sub = "DQ ปรับวันหมดอายุ (ต่ออายุ)"; icon = "📅"; color = [System.Drawing.Color]::FromArgb(14, 116, 144) },  # Cyan/Teal
    @{ title = "ยกเลิกคำสั่ง (Undo)"; sub = "DQ ยกเลิก (กู้คืนสต็อก 5 นาที)"; icon = "↩️"; color = [System.Drawing.Color]::FromArgb(124, 58, 237) }, # Purple
    @{ title = "เปิดระบบบนเว็บ"; sub = "เปิดแดชบอร์ดจัดการสต็อก"; icon = "🌐"; color = [System.Drawing.Color]::FromArgb(37, 99, 235) }       # Blue
)

$fontIcon = New-Object System.Drawing.Font("Segoe UI Emoji", 42, [System.Drawing.FontStyle]::Regular)
$fontTitle = New-Object System.Drawing.Font("Tahoma", 22, [System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font("Tahoma", 12, [System.Drawing.FontStyle]::Regular)

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

for ($i = 0; $i -lt 6; $i++) {
    $col = $i % 3
    $row = [math]::Floor($i / 3)
    $tileW = 400
    $tileH = 405
    $x = $col * $tileW
    $y = $row * $tileH

    # Card background with padding
    $pad = 6
    $cardX = $x + $pad
    $cardY = $y + $pad
    $cardW = $tileW - ($pad * 2)
    $cardH = $tileH - ($pad * 2)

    $tileBrush = New-Object System.Drawing.SolidBrush($tiles[$i].color)
    $g.FillRectangle($tileBrush, $cardX, $cardY, $cardW, $cardH)

    # Card inner border
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 2)
    $g.DrawRectangle($borderPen, ($cardX + 4), ($cardY + 4), ($cardW - 8), ($cardH - 8))

    # Text brushes
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))

    # Icon
    $rectIcon = New-Object System.Drawing.RectangleF($cardX, ($cardY + 55), $cardW, 75)
    $g.DrawString($tiles[$i].icon, $fontIcon, $whiteBrush, $rectIcon, $sf)

    # Title
    $rectTitle = New-Object System.Drawing.RectangleF($cardX, ($cardY + 160), $cardW, 45)
    $g.DrawString($tiles[$i].title, $fontTitle, $whiteBrush, $rectTitle, $sf)

    # Subtitle
    $rectSub = New-Object System.Drawing.RectangleF($cardX, ($cardY + 225), $cardW, 35)
    $g.DrawString($tiles[$i].sub, $fontSub, $subBrush, $rectSub, $sf)
}

if (-not (Test-Path 'public/img')) {
    New-Item -ItemType Directory -Path 'public/img' -Force | Out-Null
}

$bmp.Save("public/img/richmenu.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$g.Dispose()

Write-Output "Successfully generated 6-tile richmenu at public/img/richmenu.png"
