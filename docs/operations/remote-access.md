# Remote access

ArchiveOS should expose only the frontend to remote devices. PostgreSQL and internal backend ports remain bound to the local machine.

## Tailscale Serve

Start ArchiveOS first:

```powershell
docker compose up -d
docker compose ps
```

Publish the frontend inside the private tailnet:

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" serve --https=443 --bg http://127.0.0.1:5173
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

The phone must be connected to the same tailnet. Use the HTTPS address printed by `serve status`.

## Recovery check

```powershell
docker compose ps
Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing
& "C:\Program Files\Tailscale\tailscale.exe" status
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

Docker services use `restart: unless-stopped`, so Docker should restart failed containers automatically. Docker Desktop must also start with Windows for recovery after a reboot.
