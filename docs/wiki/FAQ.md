# FAQ

## Setup Issues

### "Port already in use"
Another service is using port 80, 3000, or 3306.
```bash
# Check what's using port 80
netstat -tlnp | grep :80
# Or change ports in docker-compose.yml
```

### "Database connection failed"
MySQL needs ~30 seconds to start. The backend auto-retries.
```bash
docker compose ps  # Check if db is "healthy"
docker compose logs backend  # Check backend logs
```

### "generate-keys.sh: Permission denied"
```bash
chmod +x scripts/generate-keys.sh
bash scripts/generate-keys.sh
```

## Authentication

### "I lost my TOTP device"
Use one of your 10 backup codes. Each code works once. If all are used, you need a database reset by an admin.

### "OTP code expired"
Codes expire after 10 minutes. Request a new one.

### "Rate limited"
Wait 15 minutes. Auth endpoints allow max 5 attempts per 15 minutes.

## Data Management

### "How do I reset the database?"
```bash
docker compose down -v  # Removes all data volumes
docker compose up -d    # Fresh start
# Re-run seeds after reset
```

### "How do I add test data?"
```bash
docker compose exec backend npx ts-node src/db/seed-testdata.ts
```

### "How do I export the IP address list?"
Click "Download Allow List" in the top bar → select "IP Address List (Excel)".
