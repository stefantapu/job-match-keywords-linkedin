Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
$storeDir = Join-Path $root "store-assets"
$screenshotsDir = Join-Path $storeDir "screenshots"
$promoDir = Join-Path $storeDir "promo"

New-Item -ItemType Directory -Force -Path $iconsDir, $screenshotsDir, $promoDir | Out-Null

function New-Bitmap($width, $height) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $bitmap.SetResolution(144, 144)
  return $bitmap
}

function New-RoundedRect($x, $y, $width, $height, $radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Text($g, $text, $fontName, $size, $style, $brush, $x, $y, $w, $h, $align = "Near") {
  $fontStyle = [System.Drawing.FontStyle]::$style
  $font = New-Object System.Drawing.Font $fontName, $size, $fontStyle, ([System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::$align
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF $x, $y, $w, $h
  $g.DrawString($text, $font, $brush, $rect, $format)
  $font.Dispose()
  $format.Dispose()
}

function Save-Png($bitmap, $path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Draw-Icon($size, $path) {
  $bitmap = New-Bitmap $size $size
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [Math]::Max(2, [int]($size * 0.125))
  $box = $size - ($pad * 2)
  $radius = [Math]::Max(3, [int]($size * 0.18))
  $pathRect = New-RoundedRect $pad $pad $box $box $radius
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.Rectangle $pad, $pad, $box, $box),
    [System.Drawing.ColorTranslator]::FromHtml("#41D1FF"),
    [System.Drawing.ColorTranslator]::FromHtml("#BD34FE"),
    45
  )
  $g.FillPath($gradient, $pathRect)

  $innerPad = [Math]::Max(2, [int]($size * 0.25))
  $innerSize = $size - ($innerPad * 2)
  $innerRect = New-Object System.Drawing.Rectangle $innerPad, $innerPad, $innerSize, $innerSize
  $innerPath = New-RoundedRect $innerPad $innerPad $innerSize $innerSize ([Math]::Max(2, [int]($size * 0.08)))
  $innerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 255, 255, 255))
  $g.FillPath($innerBrush, $innerPath)

  $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#13795B"))
  $redBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#B42318"))
  $textSize = [Math]::Max(8, [int]($size * 0.22))
  Draw-Text $g "+" "Segoe UI" $textSize "Bold" $greenBrush ($innerPad + 1) ($innerPad - 1) ($innerSize / 2) ($innerSize + 2) "Center"
  Draw-Text $g "-" "Segoe UI" $textSize "Bold" $redBrush ($innerPad + ($innerSize / 2) - 1) ($innerPad - 1) ($innerSize / 2) ($innerSize + 2) "Center"

  $g.Dispose()
  $pathRect.Dispose()
  $innerPath.Dispose()
  $gradient.Dispose()
  $innerBrush.Dispose()
  $greenBrush.Dispose()
  $redBrush.Dispose()
  Save-Png $bitmap $path
}

function Draw-BrandBackground($g, $width, $height) {
  $bgRect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, ([System.Drawing.ColorTranslator]::FromHtml("#F8FBFF")), ([System.Drawing.ColorTranslator]::FromHtml("#EEF2FF")), 90
  $g.FillRectangle($bg, $bgRect)
  $blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(72, 65, 209, 255))
  $purple = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 189, 52, 254))
  $g.FillEllipse($blue, -80, -80, [int]($width * 0.45), [int]($height * 0.75))
  $g.FillEllipse($purple, [int]($width * 0.68), -60, [int]($width * 0.42), [int]($height * 0.7))
  $bg.Dispose()
  $blue.Dispose()
  $purple.Dispose()
}

function Draw-WidgetMock($g, $x, $y, $scale) {
  $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#181C27"))
  $secondaryBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#1E2333"))
  $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#232A3E"))
  $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(28, 255, 255, 255)), ([Math]::Max(1, [int](1 * $scale)))
  $trackPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(18, 255, 255, 255)), ([Math]::Max(2, [int](6 * $scale)))
  $bluePen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#4F8EF7")), ([Math]::Max(2, [int](6 * $scale)))
  $bluePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bluePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#E8EAF0"))
  $mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#6B7491"))
  $blueBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#4F8EF7"))
  $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#22D3A0"))
  $redBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#F05A6E"))

  $w = [int](218 * $scale)
  $h = [int](330 * $scale)
  $panelPath = New-RoundedRect $x $y $w $h ([int](10 * $scale))
  $g.FillPath($cardBrush, $panelPath)
  $g.DrawPath($borderPen, $panelPath)

  $tabPath = New-RoundedRect ($x + $w - [int](42 * $scale)) ($y - [int](27 * $scale)) ([int](34 * $scale)) ([int](28 * $scale)) ([int](8 * $scale))
  $g.FillPath($cardBrush, $tabPath)
  $g.DrawPath($borderPen, $tabPath)
  Draw-Text $g "<" "Segoe UI" ([int](15 * $scale)) "Bold" $mutedBrush ($x + $w - [int](34 * $scale)) ($y - [int](28 * $scale)) ([int](18 * $scale)) ([int](28 * $scale)) "Center"

  $dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#4F8EF7"))
  $g.FillEllipse($dotBrush, ($x + [int](12 * $scale)), ($y + [int](15 * $scale)), ([int](8 * $scale)), ([int](8 * $scale)))
  Draw-Text $g "JOB MATCH" "Segoe UI" ([int](13 * $scale)) "Bold" $textBrush ($x + [int](26 * $scale)) ($y + [int](7 * $scale)) ([int](92 * $scale)) ([int](24 * $scale)) "Near"

  $reloadPath = New-RoundedRect ($x + $w - [int](78 * $scale)) ($y + [int](8 * $scale)) ([int](24 * $scale)) ([int](24 * $scale)) ([int](6 * $scale))
  $sidePath = New-RoundedRect ($x + $w - [int](50 * $scale)) ($y + [int](8 * $scale)) ([int](38 * $scale)) ([int](24 * $scale)) ([int](7 * $scale))
  $g.FillPath($accentBrush, $reloadPath)
  $g.FillPath($accentBrush, $sidePath)
  Draw-Text $g "R" "Segoe UI" ([int](10 * $scale)) "Bold" $mutedBrush ($x + $w - [int](74 * $scale)) ($y + [int](8 * $scale)) ([int](16 * $scale)) ([int](24 * $scale)) "Center"
  Draw-Text $g "|  |" "Segoe UI" ([int](10 * $scale)) "Bold" $blueBrush ($x + $w - [int](47 * $scale)) ($y + [int](8 * $scale)) ([int](32 * $scale)) ([int](24 * $scale)) "Center"

  $g.DrawLine($borderPen, $x, ($y + [int](43 * $scale)), ($x + $w), ($y + [int](43 * $scale)))

  $gaugeSize = [int](80 * $scale)
  $gaugeX = $x + [int](16 * $scale)
  $gaugeY = $y + [int](64 * $scale)
  $g.DrawEllipse($trackPen, $gaugeX, $gaugeY, $gaugeSize, $gaugeSize)
  $g.DrawArc($bluePen, $gaugeX, $gaugeY, $gaugeSize, $gaugeSize, -90, 198)
  Draw-Text $g "55%" "Segoe UI" ([int](22 * $scale)) "Bold" $blueBrush $gaugeX ($gaugeY + [int](18 * $scale)) $gaugeSize ([int](34 * $scale)) "Center"

  $countsX = $x + [int](126 * $scale)
  $countsY = $y + [int](70 * $scale)
  $countRows = @(
    @($greenBrush, "3/3"),
    @($blueBrush, "7/50"),
    @($redBrush, "7/47")
  )
  for ($i = 0; $i -lt $countRows.Count; $i += 1) {
    $rowY = $countsY + [int]($i * 27 * $scale)
    $g.FillEllipse($countRows[$i][0], $countsX, $rowY, ([int](7 * $scale)), ([int](7 * $scale)))
    Draw-Text $g $countRows[$i][1] "Segoe UI" ([int](12 * $scale)) "Bold" $countRows[$i][0] ($countsX + [int](20 * $scale)) ($rowY - [int](7 * $scale)) ([int](58 * $scale)) ([int](22 * $scale)) "Far"
  }
  $g.DrawLine($borderPen, $countsX, ($countsY + [int](76 * $scale)), ($x + $w - [int](12 * $scale)), ($countsY + [int](76 * $scale)))
  Draw-Text $g "17/100" "Segoe UI" ([int](12 * $scale)) "Bold" $mutedBrush ($countsX + [int](20 * $scale)) ($countsY + [int](78 * $scale)) ([int](58 * $scale)) ([int](22 * $scale)) "Far"

  Draw-Text $g "KEYWORDS" "Segoe UI" ([int](11 * $scale)) "Bold" $mutedBrush ($x + [int](12 * $scale)) ($y + [int](164 * $scale)) ([int](120 * $scale)) ([int](22 * $scale)) "Near"
  Draw-Text $g "Edit" "Segoe UI" ([int](10 * $scale)) "Bold" $mutedBrush ($x + $w - [int](48 * $scale)) ($y + [int](164 * $scale)) ([int](36 * $scale)) ([int](22 * $scale)) "Far"

  $cards = @(
    @($greenBrush, "Very Positive", "3 out of 3", "3"),
    @($blueBrush, "Positive", "7 out of 50", "7"),
    @($redBrush, "Negative", "7 out of 47", "7")
  )
  for ($i = 0; $i -lt $cards.Count; $i += 1) {
    $cardY = $y + [int]((190 + ($i * 52)) * $scale)
    $cardPath = New-RoundedRect ($x + [int](10 * $scale)) $cardY ($w - [int](20 * $scale)) ([int](44 * $scale)) ([int](8 * $scale))
    $g.FillPath($secondaryBrush, $cardPath)
    $g.DrawPath($borderPen, $cardPath)
    $g.FillEllipse($cards[$i][0], ($x + [int](20 * $scale)), ($cardY + [int](12 * $scale)), ([int](20 * $scale)), ([int](20 * $scale)))
    Draw-Text $g $cards[$i][3] "Segoe UI" ([int](10 * $scale)) "Bold" $cardBrush ($x + [int](20 * $scale)) ($cardY + [int](10 * $scale)) ([int](20 * $scale)) ([int](20 * $scale)) "Center"
    Draw-Text $g $cards[$i][1] "Segoe UI" ([int](12 * $scale)) "Bold" $textBrush ($x + [int](50 * $scale)) ($cardY + [int](7 * $scale)) ([int](110 * $scale)) ([int](18 * $scale)) "Near"
    Draw-Text $g $cards[$i][2] "Segoe UI" ([int](10 * $scale)) "Regular" $mutedBrush ($x + [int](50 * $scale)) ($cardY + [int](24 * $scale)) ([int](110 * $scale)) ([int](15 * $scale)) "Near"
    $cardPath.Dispose()
  }

  $panelPath.Dispose()
  $tabPath.Dispose()
  $reloadPath.Dispose()
  $sidePath.Dispose()
  $cardBrush.Dispose()
  $secondaryBrush.Dispose()
  $accentBrush.Dispose()
  $borderPen.Dispose()
  $trackPen.Dispose()
  $bluePen.Dispose()
  $textBrush.Dispose()
  $mutedBrush.Dispose()
  $blueBrush.Dispose()
  $greenBrush.Dispose()
  $redBrush.Dispose()
  $dotBrush.Dispose()
}

function Draw-Promo($width, $height, $path, $includeScreenshot) {
  $bitmap = New-Bitmap $width $height
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  Draw-BrandBackground $g $width $height

  $darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#17212B"))
  $mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#657282"))
  $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#13795B"))

  $left = [int]($width * 0.08)
  Draw-Text $g "LinkedIn Job Match" "Segoe UI" ([int]($height * 0.075)) "Bold" $darkBrush $left ([int]($height * 0.2)) ([int]($width * 0.48)) ([int]($height * 0.12)) "Near"
  Draw-Text $g "Keyword signals for job descriptions" "Segoe UI" ([int]($height * 0.034)) "Regular" $mutedBrush $left ([int]($height * 0.33)) ([int]($width * 0.48)) ([int]($height * 0.08)) "Near"
  Draw-Text $g "+ positive   V core   - negative" "Segoe UI" ([int]($height * 0.032)) "Bold" $greenBrush $left ([int]($height * 0.46)) ([int]($width * 0.48)) ([int]($height * 0.07)) "Near"

  if ($includeScreenshot) {
    Draw-WidgetMock $g ([int]($width * 0.62)) ([int]($height * 0.12)) ([Math]::Max(1.0, $height / 560.0))
  } else {
    Draw-WidgetMock $g ([int]($width * 0.64)) ([int]($height * 0.14)) ([Math]::Max(0.62, $height / 620.0))
  }

  $darkBrush.Dispose()
  $mutedBrush.Dispose()
  $greenBrush.Dispose()
  $g.Dispose()
  Save-Png $bitmap $path
}

function Draw-Screenshot($path) {
  $width = 1280
  $height = 800
  $bitmap = New-Bitmap $width $height
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#F3F6F8"))
  $g.FillRectangle($bg, 0, 0, $width, $height)
  $leftBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#FFFFFF"))
  $rightBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#FBFCFF"))
  $borderPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#D7DDE4")), 1
  $darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#17212B"))
  $mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#657282"))

  $g.FillRectangle($leftBrush, 60, 72, 420, 656)
  $g.DrawRectangle($borderPen, 60, 72, 420, 656)
  Draw-Text $g "Frontend Engineer" "Segoe UI" 25 "Bold" $darkBrush 92 110 300 42 "Near"
  Draw-Text $g "Soundtrack - Stockholm - Hybrid" "Segoe UI" 17 "Regular" $mutedBrush 92 154 320 32 "Near"
  foreach ($i in 0..6) {
    $y = 220 + ($i * 62)
    $g.DrawLine($borderPen, 92, $y, 420, $y)
    Draw-Text $g "Job card result" "Segoe UI" 16 "Bold" $darkBrush 92 ($y + 12) 220 24 "Near"
    Draw-Text $g "React - TypeScript - UI" "Segoe UI" 13 "Regular" $mutedBrush 92 ($y + 36) 220 20 "Near"
  }

  $g.FillRectangle($rightBrush, 500, 72, 620, 656)
  $g.DrawRectangle($borderPen, 500, 72, 620, 656)
  Draw-Text $g "About the job" "Segoe UI" 30 "Bold" $darkBrush 540 108 360 42 "Near"
  Draw-Text $g "The Product Experience team builds user-facing web apps with React, TypeScript, testing, reusable components, and product UI workflows." "Segoe UI" 18 "Regular" $mutedBrush 540 170 500 90 "Near"
  Draw-Text $g "Mandatory Requirements" "Segoe UI" 22 "Bold" $darkBrush 540 300 360 34 "Near"
  Draw-Text $g "5+ years of professional experience building robust web/mobile apps. Strong proficiency in TypeScript and JavaScript. Worked with React or similar frameworks." "Segoe UI" 17 "Regular" $mutedBrush 540 350 500 110 "Near"

  Draw-WidgetMock $g 1128 96 0.62

  $bg.Dispose()
  $leftBrush.Dispose()
  $rightBrush.Dispose()
  $borderPen.Dispose()
  $darkBrush.Dispose()
  $mutedBrush.Dispose()
  $g.Dispose()
  Save-Png $bitmap $path
}

Draw-Icon 16 (Join-Path $iconsDir "icon-16.png")
Draw-Icon 32 (Join-Path $iconsDir "icon-32.png")
Draw-Icon 48 (Join-Path $iconsDir "icon-48.png")
Draw-Icon 128 (Join-Path $iconsDir "icon-128.png")
Draw-Promo 440 280 (Join-Path $promoDir "promo-small-440x280.png") $false
Draw-Promo 1400 560 (Join-Path $promoDir "promo-marquee-1400x560.png") $true
Draw-Screenshot (Join-Path $screenshotsDir "screenshot-main-1280x800.png")

Write-Host "Generated Chrome Web Store assets."
