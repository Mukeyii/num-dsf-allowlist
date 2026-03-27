#!/bin/bash
# Generates RS256 JWT keys and TOTP encryption key, writes them to .env
set -e

echo "Generating RS256 key pair..."
openssl genrsa -out /tmp/jwt_private.pem 2048 2>/dev/null
openssl rsa -in /tmp/jwt_private.pem -pubout -out /tmp/jwt_public.pem 2>/dev/null

PRIVATE_B64=$(base64 -w 0 /tmp/jwt_private.pem)
PUBLIC_B64=$(base64 -w 0 /tmp/jwt_public.pem)
TOTP_KEY=$(openssl rand -hex 32)

sed -i "s|JWT_PRIVATE_KEY_BASE64=.*|JWT_PRIVATE_KEY_BASE64=$PRIVATE_B64|" .env
sed -i "s|JWT_PUBLIC_KEY_BASE64=.*|JWT_PUBLIC_KEY_BASE64=$PUBLIC_B64|" .env
sed -i "s|TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=$TOTP_KEY|" .env

rm /tmp/jwt_private.pem /tmp/jwt_public.pem
echo "Done. Keys written to .env"
