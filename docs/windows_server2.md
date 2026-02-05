# FastAPI Deployment on Windows Server 2025 with IIS

Complete guide for deploying a FastAPI application (xlwings-backend) on Windows Server 2025 using IIS and HttpPlatformHandler.

## Prerequisites

- Windows Server 2025
- Administrator access
- PowerShell (run as Administrator for all commands)

## Deployment Steps

### 1. Install and Configure uv

Download and install uv from https://docs.astral.sh/uv/getting-started/installation/

```powershell
# Verify installation
uv --version

# Configure uv to install Python in a system-accessible location (not AppData)
# This is CRITICAL for IIS to access Python files
[System.Environment]::SetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'C:\uv', 'Machine')

# Configure uv to copy files instead of hard-linking
# This ensures .venv files are independent of the user cache
[System.Environment]::SetEnvironmentVariable('UV_LINK_MODE', 'copy', 'Machine')

# Verify both variables are set
[System.Environment]::GetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'Machine')
[System.Environment]::GetEnvironmentVariable('UV_LINK_MODE', 'Machine')
```

**Important:**

- `UV_PYTHON_INSTALL_DIR=C:\uv` ensures Python is installed in a system-wide location instead of the user's AppData directory, which IIS cannot access reliably
- `UV_LINK_MODE=copy` ensures files are copied into `.venv` instead of hard-linked to the user cache, preventing permission issues with IIS app pool identities

### 2. Transfer Repository

Transfer your repository into `C:\inetpub\xlwings-backend` (without .venv folder)

```powershell
# Verify files are in place
Get-ChildItem C:\inetpub\xlwings-backend
```

### 3. Create Virtual Environment

Create the virtual environment and install dependencies:

```powershell
# Navigate to your application
cd C:\inetpub\xlwings-backend

# Create venv and sync dependencies
uv sync
```

**Note:** With `UV_PYTHON_INSTALL_DIR=C:\uv` and `UV_LINK_MODE=copy`, Python is installed system-wide and .venv files are independent copies that IIS can access without permission issues.

### 4. Install IIS

```powershell
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
```

### 5. Install HttpPlatformHandler

Download and install from: https://www.iis.net/downloads/microsoft/httpplatformhandler

Or install via PowerShell:

```powershell
$url = "https://download.microsoft.com/download/4/5/8/458F7C23-FD12-4F4C-B7F8-4C5B704FA1E4/httpPlatformHandler_amd64.msi"
$output = "$env:TEMP\httpPlatformHandler_amd64.msi"
Invoke-WebRequest -Uri $url -OutFile $output
Start-Process msiexec.exe -ArgumentList "/i `"$output`" /quiet /norestart" -Wait
```

### 6. Unlock Handlers Section

This allows individual IIS sites to define handlers in their web.config:

```powershell
& $env:windir\system32\inetsrv\appcmd.exe unlock config -section:system.webServer/handlers
```

### 7. Create IIS Site

```powershell
Import-Module WebAdministration

# Create the site
New-WebSite -Name "xlwings-backend" -Port 80 -PhysicalPath "C:\inetpub\xlwings-backend"

# Remove default web site
Remove-WebSite -Name "Default Web Site"
```

### 8. Create Logs Directory

```powershell
New-Item -ItemType Directory -Path "C:\inetpub\xlwings-backend\logs" -Force
```

### 9. Create web.config

Create `C:\inetpub\xlwings-backend\web.config` with the following content:

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
                  startupRetryCount="3"
                  stdoutLogEnabled="true"
                  stdoutLogFile="C:\inetpub\xlwings-backend\logs\stdout.log"
                  processesPerApplication="4">
      <environmentVariables>
        <environmentVariable name="PYTHONUNBUFFERED" value="1" />
        <environmentVariable name="XLWINGS_PROJECT_DIR" value="C:\inetpub\xlwings-backend" />
        <environmentVariable name="XLWINGS_LICENSE_KEY" value="noncommercial" />
      </environmentVariables>
    </httpPlatform>
    <httpErrors errorMode="Detailed" />
  </system.webServer>
</configuration>
```

**Important notes:**

- `processesPerApplication="4"` means IIS will spawn 4 separate Python processes for load balancing
- We use `python.exe -m uvicorn` instead of `uvicorn.exe` directly
- **No `--workers` flag** - IIS manages the workers, not Python multiprocessing
- Replace `noncommercial` with your actual xlwings license key if needed

### 10. Create and Configure App Pool

```powershell
# Create dedicated app pool
New-WebAppPool -Name "xlwings-backend-pool"

# Set to "No Managed Code" since it's Python
Set-ItemProperty "IIS:\AppPools\xlwings-backend-pool" -Name "managedRuntimeVersion" -Value ""

# Set to run as NetworkService (needed for permissions)
Set-ItemProperty "IIS:\AppPools\xlwings-backend-pool" -Name processModel.identityType -Value 2

# Assign app pool to site
Set-ItemProperty "IIS:\Sites\xlwings-backend" -Name "applicationPool" -Value "xlwings-backend-pool"
```

### 11. Set Permissions

**Critical step** - grant the IIS app pool read access to your application:

```powershell
# Import WebAdministration module if needed
Import-Module WebAdministration

# Grant app pool read/execute permissions to application directory
icacls "C:\inetpub\xlwings-backend" /grant "IIS AppPool\xlwings-backend-pool:(OI)(CI)RX" /T

# Grant access to the .venv directory (contains Python packages)
icacls "C:\inetpub\xlwings-backend\.venv" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q

# Grant write access to logs directory
icacls "C:\inetpub\xlwings-backend\logs" /grant "IIS AppPool\xlwings-backend-pool:(OI)(CI)F" /T

# Grant access to the uv toolchain folder
# (Critical: The .venv contains symlinks to python.exe in here)
if (-not (Test-Path "C:\uv")) { mkdir "C:\uv" }
icacls "C:\uv" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q
```

**Note:**

- `IIS AppPool\xlwings-backend-pool` grants access to your specific app pool
- `IIS_IUSRS` is a built-in group that includes all IIS app pool identities
- The `/Q` flag suppresses output for cleaner execution

### 12. Start the Site

```powershell
# Restart IIS to apply all changes
iisreset

# Start the site
Start-WebSite -Name "xlwings-backend"
```

### 13. Verify Deployment

```powershell
# Check if site is running
Get-WebSite -Name "xlwings-backend" | Select-Object Name, State

# Check logs for any errors
Get-ChildItem "C:\inetpub\xlwings-backend\logs\" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content

# Test in browser
# Navigate to: http://localhost/docs (FastAPI Swagger UI)
# Or use your server's IP address from external browser
```

## SSL Configuration (HTTPS on Port 443)

If you have an existing SSL certificate from a Certificate Authority:

### 1. Import Certificate to Windows

```powershell
# Import .pfx certificate file
$certPassword = ConvertTo-SecureString -String "YourCertificatePassword" -Force -AsPlainText
Import-PfxCertificate -FilePath "C:\path\to\certificate.pfx" -CertStoreLocation Cert:\LocalMachine\My -Password $certPassword
```

### 2. Get Certificate Thumbprint

```powershell
# List certificates and find your certificate's thumbprint
Get-ChildItem -Path Cert:\LocalMachine\My | Select-Object Thumbprint, Subject, NotAfter
```

### 3. Add HTTPS Binding to IIS Site

```powershell
# Add HTTPS binding with your certificate
# Replace THUMBPRINT with the actual thumbprint from step 2
New-WebBinding -Name "xlwings-backend" -Protocol "https" -Port 443 -IPAddress "*" -SslFlags 0

# Bind the certificate to the HTTPS binding
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq "THUMBPRINT" }
$binding = Get-WebBinding -Name "xlwings-backend" -Protocol "https"
$binding.AddSslCertificate($cert.Thumbprint, "My")
```

### 4. Verify HTTPS Configuration

```powershell
# Check bindings
Get-WebBinding -Name "xlwings-backend"

# Test HTTPS endpoint
Invoke-WebRequest -Uri "https://localhost/docs" -UseBasicParsing
```

### Alternative: Using IIS Manager GUI

1. Open **IIS Manager**
2. Select **xlwings-backend** site
3. Click **Bindings** in the Actions pane
4. Click **Add**
5. Set:
   - Type: **https**
   - Port: **443**
   - SSL certificate: Select your imported certificate
6. Click **OK**

## Troubleshooting

### Permission denied errors

If you see `PermissionError: [Errno 13] Permission denied`:

```powershell
# Re-grant all necessary permissions
icacls "C:\inetpub\xlwings-backend" /grant "IIS AppPool\xlwings-backend-pool:(OI)(CI)RX" /T
icacls "C:\inetpub\xlwings-backend\.venv" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q
icacls "C:\uv-toolchain" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q
iisreset
```

### Site returns 500 errors

Check the stdout log file:

```powershell
Get-Content "C:\inetpub\xlwings-backend\logs\stdout.log" -Tail 50
```

### Process not starting

1. Verify permissions are set correctly
2. Check Event Viewer for IIS/HttpPlatformHandler errors:

```powershell
Get-WinEvent -LogName Application -MaxEvents 20 | Where-Object { $_.TimeCreated -gt (Get-Date).AddMinutes(-10) }
```

### Python not found or wrong version

Verify both uv environment variables are set:

```powershell
[System.Environment]::GetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'Machine')
[System.Environment]::GetEnvironmentVariable('UV_LINK_MODE', 'Machine')
```

Should return `C:\uv` and `copy` respectively. If not set, run:

```powershell
[System.Environment]::SetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'C:\uv', 'Machine')
[System.Environment]::SetEnvironmentVariable('UV_LINK_MODE', 'copy', 'Machine')
```

Then recreate the venv:

```powershell
cd C:\inetpub\xlwings-backend
Remove-Item .venv -Recurse -Force
uv sync
```

### Site spinning/not loading

Check if python process is running:

```powershell
Get-Process | Where-Object { $_.Name -like "*python*" }
```

Check what's listening on ports:

```powershell
netstat -ano | findstr "LISTENING"
```

## Updating the Application

To update your application:

```powershell
# Stop the site
Stop-WebSite -Name "xlwings-backend"

# Update your code files in C:\inetpub\xlwings-backend

# If dependencies changed, update the venv
cd C:\inetpub\xlwings-backend
uv sync

# Restart
iisreset
Start-WebSite -Name "xlwings-backend"
```

## Directory Structure

```
C:\inetpub\xlwings-backend\          # Application code
├── xlwings_server/                  # Python package
├── pyproject.toml                   # Dependencies
├── web.config                       # IIS configuration
├── logs/                            # Application logs
└── .venv/                           # Virtual environment (created by uv sync)
    └── Scripts/
        └── uvicorn.exe              # FastAPI server
```

## Key Points

- **System-wide Python installation**: Setting `UV_PYTHON_INSTALL_DIR=C:\uv` ensures Python is installed in a system-accessible location, not in user's AppData
- **Independent .venv files**: Setting `UV_LINK_MODE=copy` ensures .venv files are independent copies, not hard-links to user cache, preventing IIS permission issues
- **IIS manages worker processes**: Using `processesPerApplication="4"` in web.config instead of uvicorn's `--workers` flag avoids Python multiprocessing issues on Windows
- **No special file ownership needed**: With system-wide Python and copied files, standard NTFS permissions work correctly
- **HttpPlatformHandler security**: The .venv directory is not served via HTTP - only FastAPI endpoints respond
- **App pool runs as NetworkService**: Secure, principle of least privilege
- **HttpPlatformHandler**: Manages the Python process lifecycle
- **IIS**: Handles SSL termination, reverse proxy, and load balancing across multiple Python processes
- **.venv is not version controlled**: Created on server via `uv sync`

## Additional Resources

- [IIS HttpPlatformHandler Documentation](https://www.iis.net/downloads/microsoft/httpplatformhandler)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [uv Documentation](https://docs.astral.sh/uv/)
