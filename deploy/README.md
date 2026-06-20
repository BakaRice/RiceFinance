# RiceFinance Production Deploy

Copy the example environment file once on the server:

```bash
cd /opt/ricefinance
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod
```

Start from a clean disposable database:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod down -v
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

Service addresses:

```text
Web:     http://121.36.223.73/
Backend: http://121.36.223.73/api/v2
DB:      121.36.223.73:15432
```

For database access, use the `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` values from `deploy/.env.prod`.

For production safety, restrict inbound `15432/tcp` in the cloud security group to your own IP address only.

## Manual Update

After pushing new code, update the server manually with:

```bash
cd /opt/ricefinance
git pull origin main
bash deploy/update.sh
```

## GitHub Actions Auto Deploy

The workflow in `.github/workflows/deploy.yml` deploys automatically after a push to `main`.

Create these repository secrets in GitHub:

```text
DEPLOY_HOST=121.36.223.73
DEPLOY_PORT=22
DEPLOY_USER=root
DEPLOY_PATH=/opt/ricefinance
DEPLOY_SSH_KEY=<private key that can SSH into the server>
```

The matching public key must be present on the server in:

```text
/root/.ssh/authorized_keys
```

For a non-root production setup, create a dedicated `deploy` user and give it Docker permission, then change `DEPLOY_USER`.
