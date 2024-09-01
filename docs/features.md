# Features

- Only requires Python 3.9+ (no dependency on Node.js or Webpack)
- Uses FastAPI as the web framework
- Comes with htmx (client-server interaction), Alpine.js (CSP build, for client interactions), and Socket.io (for streaming functions and realtime updates of the task pane)
- Comes with Bootstrap-xlwings, a Bootstrap theme in the Excel look
- Runs in an air-gapped environment without access to the Internet or any Microsoft servers
- Supports SSO (Single Sign-On) authentication and RBAC (Role-Based Access Control) via Entra ID (previously known as Azure AD) simply by adding the Client and Tenant IDs to the `.env` file
- The task pane is hot-reloaded with every code change during development
- Tight security: uses the HTTP response headers recommended by OWASP including the most restrictive CSP header
- Supports streaming functions
- Supports object handles
- Cache busting for static files is automatically done when using the Docker image
- The manifest is a template that uses the correct URLs and IDs to prevent name clashing with different environments: it is shown under `/manifest`
- Development can be done on GitHub Codespaces, saving you from installing Python or mkcert locally
- Test coverage (growing...)
- xlwings Server is free for non-commercial use.
