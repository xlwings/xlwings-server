# Windows Server

### 1. Install uv and Configure

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Configure uv for system-wide access (permanent)
[System.Environment]::SetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'C:\uv', 'Machine')
[System.Environment]::SetEnvironmentVariable('UV_LINK_MODE', 'copy', 'Machine')

# Also set for current session (so we can continue without restarting terminal)
$env:UV_PYTHON_INSTALL_DIR = "C:\uv"
$env:UV_LINK_MODE = "copy"
```

### 2. Deploy Application

```powershell
# Copy your app to C:\inetpub\xlwings-backend

# Add this to pyproject.toml to exclude problematic dependencies
Add-Content -Path "C:\inetpub\xlwings-backend\pyproject.toml" -Value @"

[tool.uv]
exclude-dependencies = [
    "pywin32",
]
"@

# Install dependencies
cd C:\inetpub\xlwings-backend
uv sync
```

### 3. Install IIS Components

```powershell
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
```

Download and install from: https://www.iis.net/downloads/microsoft/httpplatformhandler

```powershell
& $env:windir\system32\inetsrv\appcmd.exe unlock config -section:system.webServer/handlers
```

### 4. Configure IIS

```powershell
Import-Module WebAdministration

# Remove default site
Remove-WebSite -Name "Default Web Site"

# Create logs directory
New-Item -ItemType Directory -Path "C:\inetpub\xlwings-backend\logs" -Force

# Create app pool
New-WebAppPool -Name "xlwings-backend-pool"
Set-ItemProperty "IIS:\AppPools\xlwings-backend-pool" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty "IIS:\AppPools\xlwings-backend-pool" -Name processModel.identityType -Value 2

# Create site
New-WebSite -Name "xlwings-backend" -Port 80 -PhysicalPath "C:\inetpub\xlwings-backend" -ApplicationPool "xlwings-backend-pool"
```

### 5. Create web.config

Create `C:\inetpub\xlwings-backend\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" />
    </handlers>
    <httpPlatform processPath="C:\inetpub\xlwings-backend\.venv\Scripts\python.exe"
                  arguments="-m uvicorn xlwings_server.main:main_app --host 127.0.0.1 --port %HTTP_PLATFORM_PORT%"
                  startupTimeLimit="60"
                  stdoutLogEnabled="true"
                  stdoutLogFile="C:\inetpub\xlwings-backend\logs\stdout.log"
                  processesPerApplication="4">
      <environmentVariables>
        <environmentVariable name="PYTHONUNBUFFERED" value="1" />
        <environmentVariable name="XLWINGS_PROJECT_DIR" value="C:\inetpub\xlwings-backend" />
        <environmentVariable name="XLWINGS_LICENSE_KEY" value="TODO" />
      </environmentVariables>
    </httpPlatform>
  </system.webServer>
</configuration>
```

### 6. Set Permissions

```powershell
# App directory
icacls "C:\inetpub\xlwings-backend" /grant "IIS AppPool\xlwings-backend-pool:(OI)(CI)RX" /T

# .venv folder
icacls "C:\inetpub\xlwings-backend\.venv" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q

# Logs folder
icacls "C:\inetpub\xlwings-backend\logs" /grant "IIS AppPool\xlwings-backend-pool:(OI)(CI)F" /T

# Toolchain folder (for Python symlinks)
if (-not (Test-Path "C:\uv-toolchain")) { mkdir "C:\uv-toolchain" }
icacls "C:\uv-toolchain" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q
```

### 7. Start

```powershell
iisreset
Start-WebSite -Name "xlwings-backend"
```

## SSL Setup (Required)

```powershell
# Import certificate
$certPassword = ConvertTo-SecureString -String "your_password" -Force -AsPlainText
Import-PfxCertificate -FilePath "cert.pfx" -CertStoreLocation Cert:\LocalMachine\My -Password $certPassword

# Add HTTPS binding
New-WebBinding -Name "xlwings-backend" -Protocol "https" -Port 443
# Then bind certificate in IIS Manager
```
