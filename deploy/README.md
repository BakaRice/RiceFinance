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
