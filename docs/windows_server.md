# Windows Server

Run all commands in PowerShell (Run as Administrator).

## 1. Install uv

uv is a Python package manager that will handle both the Python installation and the virtual environment with all 3rd party packages.

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

## 2. Environment Variables

Set the following env vars for uv:

```powershell
[System.Environment]::SetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'C:\uv', 'Machine')
[System.Environment]::SetEnvironmentVariable('UV_LINK_MODE', 'copy', 'Machine')
[System.Environment]::SetEnvironmentVariable('UV_PROJECT_ENVIRONMENT', 'C:\uv\.venv', 'Machine')
```

Set the following env vars for xlwings-server:

```powershell
[System.Environment]::SetEnvironmentVariable('XLWINGS_LICENSE_KEY', 'YOUR-LICENSE-KEY', 'Machine')
[System.Environment]::SetEnvironmentVariable('XLWINGS_ENVIRONMENT', 'prod', 'Machine')
```

- Make sure to replace `YOUR-LICENSE-KEY` with your actual license key
- For `XLWINGS_ENVIRONMENT`, use one of "qa", "uat", "staging", or "prod"

## 3. Restart PowerShell

After restarting PowerShell (Run as Administrator), run the following command to make sure uv is installed correctly:

```powershell
uv --version
```

## 4. Deploy Application

Deploy your repository to `C:\inetpub\xlwings-app`. Usually, you do this via CI/CD workflow directly from your source repository.

```powershell
# Copy your app to C:\inetpub\xlwings-app

# Add this to pyproject.toml to exclude problematic dependencies
Add-Content -Path "C:\inetpub\xlwings-app\pyproject.toml" -Value @"

[tool.uv]
exclude-dependencies = [
    "pywin32",
]
"@
```

## 5. Install dependencies

```powershell
cd C:\inetpub\xlwings-app
uv sync
```

Note that this also has to be done after each deployment, so should be part of your CI/CD pipeline.

## 5. Install IIS Components

- Install ISS:

  ```powershell
  Install-WindowsFeature -Name Web-Server -IncludeManagementTools
  ```

- Download and install HttpPlatformHandler from:

  https://www.iis.net/downloads/microsoft/httpplatformhandler

  The HttpPlatformHandler v1.2 is an IIS Module which enables process management of HTTP Listeners and proxies requests to the process it manages, i.e., this enables IIS to talk to the Python application.

- Run the following to allow the `web.config` file to configure handlers:

  ```powershell
  & $env:windir\system32\inetsrv\appcmd.exe unlock config -section:system.webServer/handlers
  ```

## 6. Configure IIS

Run the following commands to configure ISS:

```powershell
Import-Module WebAdministration

# Remove default site
Remove-WebSite -Name "Default Web Site"

# Create logs directory
New-Item -ItemType Directory -Path "C:\inetpub\xlwings-app\logs" -Force

# Create app pool
New-WebAppPool -Name "xlwings-app-pool"
# Prevent loading managed code since this is a Python app
Set-ItemProperty "IIS:\AppPools\xlwings-app-pool" -Name "managedRuntimeVersion" -Value ""
# Run application pool with the NetworkService account so we can later give it permission to access C:\uv
Set-ItemProperty "IIS:\AppPools\xlwings-app-pool" -Name processModel.identityType -Value 2

# Create site (Port 443 will follow at the end)
New-WebSite -Name "xlwings-app" -Port 80 -PhysicalPath "C:\inetpub\xlwings-app" -ApplicationPool "xlwings-app-pool"
```

## 7. Create web.config

Create `C:\inetpub\xlwings-app\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" />
    </handlers>
    <httpPlatform processPath="C:\uv\.venv\Scripts\python.exe"
                  arguments="-m uvicorn xlwings_server.main:main_app --host 127.0.0.1 --port %HTTP_PLATFORM_PORT%"
                  startupTimeLimit="60"
                  stdoutLogEnabled="true"
                  stdoutLogFile="C:\inetpub\xlwings-app\logs\stdout.log"
                  processesPerApplication="4">
      <environmentVariables>
        <environmentVariable name="PYTHONUNBUFFERED" value="1" />
        <environmentVariable name="XLWINGS_PROJECT_DIR" value="C:\inetpub\xlwings-app" />
        <environmentVariable name="XLWINGS_LICENSE_KEY" value="TODO" />
      </environmentVariables>
    </httpPlatform>
  </system.webServer>
</configuration>
```

## 8. Set Permissions

```powershell
# App directory
icacls "C:\inetpub\xlwings-app" /grant "IIS AppPool\xlwings-app-pool:(OI)(CI)RX" /T

# Logs folder
icacls "C:\inetpub\xlwings-app\logs" /grant "IIS AppPool\xlwings-app-pool:(OI)(CI)F" /T

# uv folder
icacls "C:\uv" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q
```

## 9. Start Server

Start the IIS server and the website:

```powershell
iisreset
Start-WebSite -Name "xlwings-app"
```

At this point, you can browse to `http://localhost` (or your server's hostname/IP from another machine) in a browser and should see `{"status":"ok"}`. If this works, continue with the next step to install SSL/TLS certificates.

If this doesn't work, check logs for any errors:

```powershell
Get-ChildItem "C:\inetpub\xlwings-app\logs\" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | Get-Content
```

## 10. SSL/TLS Setup (Required)

Office.js add-ins require SSL, even if this is for company-internal use only.

IIS requires certificates to be in the **PFX (PKCS#12)** format. If you have separate `.crt` (certificate) and `.key` (private key) files, you must convert them first.

### 1. Convert CRT/KEY to PFX (if needed)

If you already have a `.pfx` file, skip to step 2. Otherwise, use `openssl` to create it (run in PowerShell where you have your certs):

```powershell
openssl pkcs12 -export -out cert.pfx -inkey private.key -in certificate.crt
```

### 2. Import and Bind

Run the following in PowerShell as Administrator to import the certificate and bind it to the site.

```powershell
$pfxPath = "C:\path\to\cert.pfx"
$pfxPassword = "your_pfx_password"
$siteName = "xlwings-app"

# 1. Import PFX to Local Machine Personal Store
$securePwd = ConvertTo-SecureString -String $pfxPassword -Force -AsPlainText
$cert = Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation Cert:\LocalMachine\My -Password $securePwd

# 2. Create the HTTPS Binding for the site
New-WebBinding -Name $siteName -Protocol "https" -Port 443

# 3. Associate the Certificate with the Binding
Get-Item -Path "Cert:\LocalMachine\My\$($cert.Thumbprint)" | New-Item -Path "IIS:\SslBindings\0.0.0.0!443"
```
