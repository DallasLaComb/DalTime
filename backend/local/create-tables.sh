#!/usr/bin/env bash
# Creates DynamoDB Local tables that mirror the SAM template.
# Idempotent — skips tables that already exist.

ENDPOINT="http://localhost:8000"

echo "Waiting for DynamoDB Local..."
until aws dynamodb list-tables --endpoint-url "$ENDPOINT" --region us-east-1 --no-cli-pager > /dev/null 2>&1; do
  sleep 1
done
echo "DynamoDB Local is ready."

# Single table for all entities
TABLE="daltime-local"
if aws dynamodb describe-table --table-name "$TABLE" --endpoint-url "$ENDPOINT" --region us-east-1 --no-cli-pager > /dev/null 2>&1; then
  echo "Table '$TABLE' already exists — skipping."
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=GSI1PK,AttributeType=S \
      AttributeName=GSI1SK,AttributeType=S \
    --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
      'IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url "$ENDPOINT" \
    --region us-east-1 \
    --no-cli-pager
  echo "Created table '$TABLE'."
fi
