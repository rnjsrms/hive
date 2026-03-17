# Hive notification script for Windows
# Reads event info from stdin and shows a desktop notification

param()

$eventText = ""
try {
    if ([Console]::In.Peek() -ne -1) {
        $eventText = [Console]::In.ReadToEnd()
    }
} catch {
    $eventText = ""
}

$title = "Hive Notification"
$message = "A Hive event occurred."

if ($eventText) {
    try {
        $event = $eventText | ConvertFrom-Json
        if ($event.event_type) {
            $title = "Hive: $($event.event_type)"
        }
        if ($event.message) {
            $message = $event.message
        } elseif ($event.tool_name) {
            $message = "Tool: $($event.tool_name)"
        }
    } catch {
        $message = $eventText.Substring(0, [Math]::Min(200, $eventText.Length))
    }
}

# Try BurntToast module first (non-blocking toast notifications)
$usedBurntToast = $false
try {
    if (Get-Module -ListAvailable -Name BurntToast -ErrorAction SilentlyContinue) {
        Import-Module BurntToast -ErrorAction Stop
        New-BurntToastNotification -Text $title, $message -ErrorAction Stop
        $usedBurntToast = $true
    }
} catch {
    $usedBurntToast = $false
}

# Fallback to Windows Forms MessageBox (shown briefly)
if (-not $usedBurntToast) {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        # Use a background job so we don't block
        Start-Job -ScriptBlock {
            param($t, $m)
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.MessageBox]::Show($m, $t, 'OK', 'Information') | Out-Null
        } -ArgumentList $title, $message | Out-Null
    } catch {
        # Silent fallback — write to stderr so it doesn't interfere
        Write-Host "Hive: $message" -ForegroundColor Cyan
    }
}
