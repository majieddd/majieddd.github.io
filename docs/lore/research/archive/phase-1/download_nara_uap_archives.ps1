param(
    [ValidateSet("starter", "medium", "large")]
    [string]$Mode = "starter",
    [string]$Confirm = "",
    [string]$Destination = "official_uap_downloads"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$BaseZip = "https://catalog.archives.gov/medialz/bulk-downloads/uaps/zips"
$BaseJson = "https://catalog.archives.gov/medialz/bulk-downloads/uaps/JSON"

function Get-File([string]$Url, [string]$Name) {
    $Out = Join-Path $Destination $Name
    Write-Host "Downloading $Name"
    if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
        Start-BitsTransfer -Source $Url -Destination $Out
    } else {
        Invoke-WebRequest -Uri $Url -OutFile $Out
    }
}

function Get-Pair([string]$Folder, [string]$Id) {
    Get-File "$BaseZip/$Folder/$Id.zip" "$Id.zip"
    Get-File "$BaseJson/catalog-export-$Id.json" "catalog-export-$Id.json"
}

function Get-Starter {
    Get-Pair "electronic-records" "488808322"
    Get-Pair "electronic-records" "493468575"
    Get-Pair "electronic-records" "493468579"
    Get-Pair "electronic-records" "493468580"
    Get-Pair "textual-and-microfilm" "595175"
    Get-Pair "textual-and-microfilm" "595466"
    Get-Pair "moving-images" "262327376"
    Get-Pair "moving-images" "25738"
    Get-Pair "moving-images" "127614"
}

function Get-Medium {
    Get-Starter
    Get-Pair "moving-images" "61934"
    Get-Pair "moving-images" "68170"
    Get-Pair "moving-images" "68175"
    Get-Pair "moving-images" "68405"
    Get-Pair "moving-images" "72035"
}

function Get-Large {
    if ($Confirm -ne "I_UNDERSTAND_HUNDREDS_OF_GB") {
        throw "Large mode is hundreds of gigabytes. Pass -Confirm I_UNDERSTAND_HUNDREDS_OF_GB"
    }
    Get-Medium
    Get-Pair "still-pictures" "542184"
    Get-File "$BaseJson/catalog-export-597821.json" "catalog-export-597821.json"
    foreach ($Kind in @("images", "pdfs")) {
        foreach ($Part in 1..5) {
            Get-File "$BaseZip/textual-and-microfilm/597821-$Kind-$Part.zip" "597821-$Kind-$Part.zip"
        }
    }
    foreach ($Id in @("733667", "17618564", "23857122", "23857158", "23857159", "23857160", "45484701")) {
        Get-Pair "textual-and-microfilm" $Id
    }
    Get-Pair "moving-images" "566658"
}

switch ($Mode) {
    "starter" { Get-Starter }
    "medium" { Get-Medium }
    "large" { Get-Large }
}

Write-Host "Finished. Files are in $Destination"
