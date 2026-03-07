#!/usr/bin/env bash
# Creates DynamoDB Local tables that mirror the SAM template.
# Idempotent — skips tables that already exist.
# Uses curl instead of AWS CLI to avoid dependency/compatibility issues.

ENDPOINT="http://localhost:8000"
TABLE="daltime-local"

ddb_request() {
  local target="$1"
  local payload="$2"
  curl -s -X POST "$ENDPOINT" \
    -H "Content-Type: application/x-amz-json-1.0" \
    -H "X-Amz-Target: DynamoDB_20120810.$target" \
    -H "Authorization: AWS4-HMAC-SHA256 Credential=local/20260101/us-east-1/dynamodb/aws4_request, SignedHeaders=content-type;host;x-amz-target, Signature=local" \
    -d "$payload"
}

echo "Waiting for DynamoDB Local..."
until curl -sf "$ENDPOINT" -o /dev/null 2>&1 || curl -s "$ENDPOINT" 2>&1 | grep -q "healthy\|MissingAuthenticationToken"; do
  sleep 1
done
echo "DynamoDB Local is ready."

# Check if table already exists
TABLES=$(ddb_request "ListTables" '{}')
if echo "$TABLES" | grep -q "\"$TABLE\""; then
  echo "Table '$TABLE' already exists — skipping."
else
  RESULT=$(ddb_request "CreateTable" '{
    "TableName": "'"$TABLE"'",
    "AttributeDefinitions": [
      {"AttributeName": "PK", "AttributeType": "S"},
      {"AttributeName": "SK", "AttributeType": "S"},
      {"AttributeName": "GSI1PK", "AttributeType": "S"},
      {"AttributeName": "GSI1SK", "AttributeType": "S"}
    ],
    "KeySchema": [
      {"AttributeName": "PK", "KeyType": "HASH"},
      {"AttributeName": "SK", "KeyType": "RANGE"}
    ],
    "GlobalSecondaryIndexes": [
      {
        "IndexName": "GSI1",
        "KeySchema": [
          {"AttributeName": "GSI1PK", "KeyType": "HASH"},
          {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    ],
    "BillingMode": "PAY_PER_REQUEST"
  }')
  if echo "$RESULT" | grep -q "TableDescription"; then
    echo "Created table '$TABLE'."
  else
    echo "ERROR creating table: $RESULT"
    exit 1
  fi
fi
