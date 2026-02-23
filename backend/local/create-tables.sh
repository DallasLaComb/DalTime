#!/usr/bin/env bash
# Creates DynamoDB Local tables that mirror the SAM template.
# Idempotent — skips tables that already exist.

ENDPOINT="http://localhost:8000"

echo "Waiting for DynamoDB Local..."
until aws dynamodb list-tables --endpoint-url "$ENDPOINT" --region us-east-1 --no-cli-pager > /dev/null 2>&1; do
  sleep 1
done
echo "DynamoDB Local is ready."

# Organizations table
TABLE="daltime-organizations-local"
if aws dynamodb describe-table --table-name "$TABLE" --endpoint-url "$ENDPOINT" --region us-east-1 --no-cli-pager > /dev/null 2>&1; then
  echo "Table '$TABLE' already exists — skipping."
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=org_id,AttributeType=S \
    --key-schema AttributeName=org_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url "$ENDPOINT" \
    --region us-east-1 \
    --no-cli-pager
  echo "Created table '$TABLE'."
fi
