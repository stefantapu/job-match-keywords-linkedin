$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "store-assets\icon-options"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Bitmap($size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
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

function Draw-Text($g, $text, $size, $style, $brush, $x, $y, $w, $h, $align = "Center") {
  $font = New-Object System.Drawing.Font "Segoe UI", $size, ([System.Drawing.FontStyle]::$style), ([System.Drawing.GraphicsUnit]::Pixel)
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

function New-Colors {
  return @{
    BgTop = [System.Drawing.ColorTranslator]::FromHtml("#181C27")
    BgBottom = [System.Drawing.ColorTranslator]::FromHtml("#0F1117")
    Border = [System.Drawing.Color]::FromArgb(56, 255, 255, 255)
    Text = [System.Drawing.ColorTranslator]::FromHtml("#E8EAF0")
    Muted = [System.Drawing.ColorTranslator]::FromHtml("#6B7491")
    Blue = [System.Drawing.ColorTranslator]::FromHtml("#4F8EF7")
    Green = [System.Drawing.ColorTranslator]::FromHtml("#22D3A0")
    Red = [System.Drawing.ColorTranslator]::FromHtml("#F05A6E")
    Card = [System.Drawing.ColorTranslator]::FromHtml("#1E2333")
  }
}

function Draw-Base($g, $size, $colors) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [int]($size * 0.08)
  $box = $size - ($pad * 2)
  $rect = New-Object System.Drawing.Rectangle $pad, $pad, $box, $box
  $path = New-RoundedRect $pad $pad $box $box ([int]($size * 0.18))
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $colors.BgTop, $colors.BgBottom, 90
  $g.FillPath($bg, $path)
  $pen = New-Object System.Drawing.Pen $colors.Border, ([Math]::Max(1, [int]($size * 0.01)))
  $g.DrawPath($pen, $path)
  $bg.Dispose()
  $pen.Dispose()
  $path.Dispose()
}

function Draw-Gauge($g, $cx, $cy, $diameter, $percent, $color, $trackColor) {
  $stroke = [Math]::Max(3, [int]($diameter * 0.09))
  $rect = New-Object System.Drawing.Rectangle ([int]($cx - $diameter / 2)), ([int]($cy - $diameter / 2)), $diameter, $diameter
  $trackPen = New-Object System.Drawing.Pen $trackColor, $stroke
  $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $fillPen = New-Object System.Drawing.Pen $color, $stroke
  $fillPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $fillPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawEllipse($trackPen, $rect)
  $g.DrawArc($fillPen, $rect, -90, [int](360 * $percent))
  $trackPen.Dispose()
  $fillPen.Dispose()
}

function Draw-Dot($g, $x, $y, $r, $color) {
  $brush = New-Object System.Drawing.SolidBrush $color
  $g.FillEllipse($brush, $x - $r, $y - $r, $r * 2, $r * 2)
  $brush.Dispose()
}

function Draw-Variant($name, $size, $draw) {
  $colors = New-Colors
  $bitmap = New-Bitmap $size
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  Draw-Base $g $size $colors
  & $draw $g $size $colors
  $g.Dispose()
  Save-Png $bitmap (Join-Path $outDir "$name-$size.png")
}

$variants = @(
  @{
    Name = "01-gauge-dots"
    Draw = {
      param($g, $size, $c)
      Draw-Gauge $g ($size * 0.5) ($size * 0.47) ([int]($size * 0.54)) 0.72 $c.Blue ([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
      $textBrush = New-Object System.Drawing.SolidBrush $c.Blue
      Draw-Text $g "72" ([int]($size * 0.21)) "Bold" $textBrush ($size * 0.29) ($size * 0.34) ($size * 0.42) ($size * 0.28)
      $textBrush.Dispose()
      Draw-Dot $g ($size * 0.34) ($size * 0.78) ([int]($size * 0.035)) $c.Green
      Draw-Dot $g ($size * 0.50) ($size * 0.78) ([int]($size * 0.035)) $c.Blue
      Draw-Dot $g ($size * 0.66) ($size * 0.78) ([int]($size * 0.035)) $c.Red
    }
  },
  @{
    Name = "02-signal-panel"
    Draw = {
      param($g, $size, $c)
      $card = New-Object System.Drawing.SolidBrush $c.Card
      $path = New-RoundedRect ([int]($size * 0.24)) ([int]($size * 0.19)) ([int]($size * 0.52)) ([int]($size * 0.62)) ([int]($size * 0.08))
      $g.FillPath($card, $path)
      $card.Dispose()
      $path.Dispose()
      Draw-Gauge $g ($size * 0.5) ($size * 0.41) ([int]($size * 0.28)) 0.62 $c.Blue ([System.Drawing.Color]::FromArgb(24, 255, 255, 255))
      Draw-Dot $g ($size * 0.35) ($size * 0.63) ([int]($size * 0.026)) $c.Green
      Draw-Dot $g ($size * 0.35) ($size * 0.72) ([int]($size * 0.026)) $c.Blue
      Draw-Dot $g ($size * 0.35) ($size * 0.81) ([int]($size * 0.026)) $c.Red
      $textBrush = New-Object System.Drawing.SolidBrush $c.Text
      Draw-Text $g "3" ([int]($size * 0.08)) "Bold" $textBrush ($size * 0.47) ($size * 0.59) ($size * 0.16) ($size * 0.08)
      Draw-Text $g "7" ([int]($size * 0.08)) "Bold" $textBrush ($size * 0.47) ($size * 0.68) ($size * 0.16) ($size * 0.08)
      Draw-Text $g "2" ([int]($size * 0.08)) "Bold" $textBrush ($size * 0.47) ($size * 0.77) ($size * 0.16) ($size * 0.08)
      $textBrush.Dispose()
    }
  },
  @{
    Name = "03-target-check"
    Draw = {
      param($g, $size, $c)
      Draw-Gauge $g ($size * 0.5) ($size * 0.5) ([int]($size * 0.60)) 0.82 $c.Green ([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
      $pen = New-Object System.Drawing.Pen $c.Green, ([int]($size * 0.075))
      $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $points = @(
        (New-Object System.Drawing.PointF ($size * 0.35), ($size * 0.51)),
        (New-Object System.Drawing.PointF ($size * 0.46), ($size * 0.62)),
        (New-Object System.Drawing.PointF ($size * 0.68), ($size * 0.39))
      )
      $g.DrawLines($pen, $points)
      $pen.Dispose()
      Draw-Dot $g ($size * 0.32) ($size * 0.78) ([int]($size * 0.03)) $c.Green
      Draw-Dot $g ($size * 0.50) ($size * 0.82) ([int]($size * 0.03)) $c.Blue
      Draw-Dot $g ($size * 0.68) ($size * 0.78) ([int]($size * 0.03)) $c.Red
    }
  },
  @{
    Name = "04-keyword-stack"
    Draw = {
      param($g, $size, $c)
      $rows = @(
        @($c.Green, 0.25, 0.24, 0.50),
        @($c.Blue, 0.20, 0.42, 0.60),
        @($c.Red, 0.27, 0.60, 0.46)
      )
      foreach ($row in $rows) {
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(32, $row[0].R, $row[0].G, $row[0].B))
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(125, $row[0].R, $row[0].G, $row[0].B)), ([int]($size * 0.012))
        $path = New-RoundedRect ([int]($size * $row[1])) ([int]($size * $row[2])) ([int]($size * $row[3])) ([int]($size * 0.12)) ([int]($size * 0.06))
        $g.FillPath($brush, $path)
        $g.DrawPath($pen, $path)
        Draw-Dot $g ([int]($size * ($row[1] + 0.07))) ([int]($size * ($row[2] + 0.06))) ([int]($size * 0.023)) $row[0]
        $brush.Dispose()
        $pen.Dispose()
        $path.Dispose()
      }
      Draw-Gauge $g ($size * 0.67) ($size * 0.32) ([int]($size * 0.25)) 0.68 $c.Blue ([System.Drawing.Color]::FromArgb(30, 255, 255, 255))
    }
  },
  @{
    Name = "05-magnifier-score"
    Draw = {
      param($g, $size, $c)
      Draw-Gauge $g ($size * 0.46) ($size * 0.43) ([int]($size * 0.45)) 0.7 $c.Blue ([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
      $pen = New-Object System.Drawing.Pen $c.Text, ([int]($size * 0.06))
      $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $g.DrawLine($pen, ($size * 0.61), ($size * 0.60), ($size * 0.76), ($size * 0.76))
      $pen.Dispose()
      Draw-Dot $g ($size * 0.35) ($size * 0.44) ([int]($size * 0.035)) $c.Green
      Draw-Dot $g ($size * 0.46) ($size * 0.44) ([int]($size * 0.035)) $c.Blue
      Draw-Dot $g ($size * 0.57) ($size * 0.44) ([int]($size * 0.035)) $c.Red
    }
  },
  @{
    Name = "06-minimal-bars"
    Draw = {
      param($g, $size, $c)
      $rows = @(
        @($c.Green, 0.26, 0.25, 0.48),
        @($c.Blue, 0.26, 0.43, 0.36),
        @($c.Red, 0.26, 0.61, 0.26)
      )
      foreach ($row in $rows) {
        Draw-Dot $g ($size * 0.27) ($size * ($row[2] + 0.045)) ([int]($size * 0.035)) $row[0]
        $brush = New-Object System.Drawing.SolidBrush $row[0]
        $path = New-RoundedRect ([int]($size * 0.36)) ([int]($size * $row[2])) ([int]($size * $row[3])) ([int]($size * 0.09)) ([int]($size * 0.045))
        $g.FillPath($brush, $path)
        $brush.Dispose()
        $path.Dispose()
      }
      $textBrush = New-Object System.Drawing.SolidBrush $c.Text
      Draw-Text $g "%" ([int]($size * 0.16)) "Bold" $textBrush ($size * 0.42) ($size * 0.74) ($size * 0.16) ($size * 0.14)
      $textBrush.Dispose()
    }
  }
)

foreach ($variant in $variants) {
  Draw-Variant $variant.Name 512 $variant.Draw
  Draw-Variant $variant.Name 128 $variant.Draw
}

Write-Host "Generated icon options:"
Get-ChildItem -Path $outDir -Filter "*.png" | Select-Object -ExpandProperty Name
