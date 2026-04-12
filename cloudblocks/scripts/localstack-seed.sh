#!/usr/bin/env bash
# =============================================================================
# LocalStack Seed Script — Terminus E-Commerce Demo
# =============================================================================
#
# PURPOSE:
#   Populates a running LocalStack instance with a realistic, interconnected
#   e-commerce platform. Designed to demonstrate blast radius, path tracing,
#   and cross-service chain-of-failure advisories in Terminus.
#
# PREREQUISITES:
#   - LocalStack running:  localstack start  (or docker-compose)
#   - AWS CLI installed
#   - Optional: awslocal (pip install awscli-local) — or use the plain aws CLI
#
# USAGE:
#   chmod +x scripts/localstack-seed.sh
#   ./scripts/localstack-seed.sh
#
# WHAT IS INTENTIONALLY MISCONFIGURED (to trigger advisories):
#   - SSH open to 0.0.0.0/0 on the Security Group
#   - Lambda functions with no timeout and no DLQ
#   - payment-handler Lambda with only 128MB memory
#   - RDS with no Multi-AZ, no deletion protection, no backup retention
#   - SQS queues with no DLQ
#   - S3 bucket with public access not blocked
#   - S3 bucket with versioning disabled
#   - ElastiCache single-node (no replica)
#   - ECS service with desired 3 but likely running 0
# =============================================================================

set -u

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AWS_CMD="aws"
ENDPOINT="http://localhost:4566"
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

CLI="${AWS_CMD} --endpoint-url ${ENDPOINT} --no-cli-pager"
RANDOM_SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8 2>/dev/null || echo "demo1234")

echo ""
echo "============================================================"
echo "  Terminus LocalStack Seed — E-Commerce Platform"
echo "============================================================"
echo "  Endpoint : ${ENDPOINT}"
echo "  Region   : ${AWS_DEFAULT_REGION}"
echo "  Suffix   : ${RANDOM_SUFFIX}"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# Helper: create a minimal Lambda zip from inline Python source
# ---------------------------------------------------------------------------
make_lambda_zip() {
  local funcname="$1"
  local tmpdir
  tmpdir=$(mktemp -d)
  cat > "${tmpdir}/index.py" <<'PYEOF'
import json

def handler(event, context):
    print("event:", json.dumps(event))
    return {"statusCode": 200, "body": json.dumps({"status": "ok"})}
PYEOF
  (cd "${tmpdir}" && zip -q function.zip index.py)
  echo "${tmpdir}/function.zip"
}

# ===========================================================================
# 1. NETWORKING
# ===========================================================================
echo "=== Creating VPC ==="

VPC_ID=$(${CLI} ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=ecommerce-vpc}]' \
  --query 'Vpc.VpcId' --output text)
echo "  VPC: ${VPC_ID}"

# Enable DNS hostnames
${CLI} ec2 modify-vpc-attribute --vpc-id "${VPC_ID}" --enable-dns-hostnames || true
${CLI} ec2 modify-vpc-attribute --vpc-id "${VPC_ID}" --enable-dns-support || true

echo "=== Creating Subnets ==="

SUBNET_PUBLIC_ID=$(${CLI} ec2 create-subnet \
  --vpc-id "${VPC_ID}" \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=ecommerce-public}]' \
  --query 'Subnet.SubnetId' --output text)
echo "  Public Subnet: ${SUBNET_PUBLIC_ID}"

SUBNET_PRIVATE_ID=$(${CLI} ec2 create-subnet \
  --vpc-id "${VPC_ID}" \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=ecommerce-private}]' \
  --query 'Subnet.SubnetId' --output text)
echo "  Private Subnet: ${SUBNET_PRIVATE_ID}"

echo "=== Creating Internet Gateway ==="

IGW_ID=$(${CLI} ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=ecommerce-igw}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)
echo "  IGW: ${IGW_ID}"

${CLI} ec2 attach-internet-gateway --internet-gateway-id "${IGW_ID}" --vpc-id "${VPC_ID}" || true

echo "=== Creating Security Group (intentionally open SSH) ==="

SG_ID=$(${CLI} ec2 create-security-group \
  --group-name ecommerce-sg \
  --description "E-commerce security group (demo - open SSH)" \
  --vpc-id "${VPC_ID}" \
  --query 'GroupId' --output text)
echo "  Security Group: ${SG_ID}"

# HTTP, HTTPS, SSH all open to 0.0.0.0/0 (SSH is intentional advisory trigger)
${CLI} ec2 authorize-security-group-ingress --group-id "${SG_ID}" \
  --ip-permissions \
  'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]' \
  'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' \
  'IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=0.0.0.0/0}]' || true

echo "=== Creating NAT Gateway ==="

# Allocate EIP for NAT
EIP_ALLOC=$(${CLI} ec2 allocate-address \
  --domain vpc \
  --query 'AllocationId' --output text 2>/dev/null || echo "")
echo "  EIP Allocation: ${EIP_ALLOC}"

if [ -n "${EIP_ALLOC}" ]; then
  NAT_GW_ID=$(${CLI} ec2 create-nat-gateway \
    --subnet-id "${SUBNET_PUBLIC_ID}" \
    --allocation-id "${EIP_ALLOC}" \
    --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=ecommerce-nat}]' \
    --query 'NatGateway.NatGatewayId' --output text 2>/dev/null || echo "nat-localstack-stub")
  echo "  NAT Gateway: ${NAT_GW_ID}"
else
  NAT_GW_ID="nat-localstack-stub"
  echo "  NAT Gateway: skipped (EIP allocation failed in this LocalStack tier)"
fi

# ===========================================================================
# 2. IAM ROLE FOR LAMBDAS
# ===========================================================================
echo "=== Creating Lambda IAM Role ==="

LAMBDA_ROLE_ARN=$(${CLI} iam create-role \
  --role-name ecommerce-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --query 'Role.Arn' --output text 2>/dev/null || \
  ${CLI} iam get-role --role-name ecommerce-lambda-role --query 'Role.Arn' --output text)
echo "  Lambda Role ARN: ${LAMBDA_ROLE_ARN}"

${CLI} iam attach-role-policy \
  --role-name ecommerce-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || true
${CLI} iam attach-role-policy \
  --role-name ecommerce-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess || true
${CLI} iam attach-role-policy \
  --role-name ecommerce-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess || true

# ===========================================================================
# 3. API LAYER — Chain 1: APIGW → Lambda → RDS
# ===========================================================================
echo "=== Creating Lambda: order-processor (no timeout, no DLQ) ==="

ORDER_ZIP=$(make_lambda_zip "order-processor")
ORDER_LAMBDA_ARN=$(${CLI} lambda create-function \
  --function-name order-processor \
  --runtime python3.9 \
  --role "${LAMBDA_ROLE_ARN}" \
  --handler index.handler \
  --zip-file "fileb://${ORDER_ZIP}" \
  --memory-size 512 \
  --description "Order processor — intentionally no timeout, no DLQ" \
  --query 'FunctionArn' --output text 2>/dev/null || \
  ${CLI} lambda get-function --function-name order-processor --query 'Configuration.FunctionArn' --output text)
echo "  order-processor ARN: ${ORDER_LAMBDA_ARN}"

echo "=== Creating Lambda: payment-handler (128MB, no timeout, no DLQ) ==="

PAYMENT_ZIP=$(make_lambda_zip "payment-handler")
PAYMENT_LAMBDA_ARN=$(${CLI} lambda create-function \
  --function-name payment-handler \
  --runtime python3.9 \
  --role "${LAMBDA_ROLE_ARN}" \
  --handler index.handler \
  --zip-file "fileb://${PAYMENT_ZIP}" \
  --memory-size 128 \
  --description "Payment handler — intentionally 128MB (low memory advisory) + no timeout" \
  --query 'FunctionArn' --output text 2>/dev/null || \
  ${CLI} lambda get-function --function-name payment-handler --query 'Configuration.FunctionArn' --output text)
echo "  payment-handler ARN: ${PAYMENT_LAMBDA_ARN}"

echo "=== Creating API Gateway: ecommerce-api ==="

API_ID=$(${CLI} apigateway create-rest-api \
  --name ecommerce-api \
  --description "E-commerce REST API" \
  --query 'id' --output text 2>/dev/null || \
  ${CLI} apigateway get-rest-apis --query "items[?name=='ecommerce-api'].id" --output text | head -1)
echo "  API Gateway ID: ${API_ID}"

# Create a /orders resource + POST method wired to order-processor
if [ -n "${API_ID}" ] && [ "${API_ID}" != "None" ]; then
  ROOT_RESOURCE_ID=$(${CLI} apigateway get-resources \
    --rest-api-id "${API_ID}" \
    --query 'items[?path==`/`].id' --output text 2>/dev/null || echo "")

  if [ -n "${ROOT_RESOURCE_ID}" ]; then
    ORDERS_RESOURCE_ID=$(${CLI} apigateway create-resource \
      --rest-api-id "${API_ID}" \
      --parent-id "${ROOT_RESOURCE_ID}" \
      --path-part orders \
      --query 'id' --output text 2>/dev/null || echo "")

    if [ -n "${ORDERS_RESOURCE_ID}" ] && [ "${ORDERS_RESOURCE_ID}" != "None" ]; then
      ${CLI} apigateway put-method \
        --rest-api-id "${API_ID}" \
        --resource-id "${ORDERS_RESOURCE_ID}" \
        --http-method POST \
        --authorization-type NONE || true
      ACCOUNT_ID="000000000000"
      ${CLI} apigateway put-integration \
        --rest-api-id "${API_ID}" \
        --resource-id "${ORDERS_RESOURCE_ID}" \
        --http-method POST \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${ORDER_LAMBDA_ARN}/invocations" || true
    fi
  fi
fi

echo "=== Creating RDS: orders-db (no Multi-AZ, no deletion protection, no backup) ==="
# LocalStack Pro supports RDS; Community may return stubs — || true guards either case
RDS_INSTANCE_ID="orders-db"
${CLI} rds create-db-instance \
  --db-instance-identifier "${RDS_INSTANCE_ID}" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password adminpassword123 \
  --allocated-storage 20 \
  --no-multi-az \
  --no-deletion-protection \
  --backup-retention-period 0 \
  --db-name ordersdb \
  --vpc-security-group-ids "${SG_ID}" || true
echo "  RDS Instance: ${RDS_INSTANCE_ID}"

# ===========================================================================
# 4. MESSAGING CHAIN — Chain 2: SNS → SQS → Lambda
# ===========================================================================
echo "=== Creating SNS Topic: order-events ==="

SNS_TOPIC_ARN=$(${CLI} sns create-topic \
  --name order-events \
  --query 'TopicArn' --output text)
echo "  SNS Topic ARN: ${SNS_TOPIC_ARN}"

echo "=== Creating SQS Queues (no DLQ — triggers advisories) ==="

ORDER_QUEUE_URL=$(${CLI} sqs create-queue \
  --queue-name order-queue \
  --query 'QueueUrl' --output text)
echo "  order-queue URL: ${ORDER_QUEUE_URL}"

ORDER_QUEUE_ARN=$(${CLI} sqs get-queue-attributes \
  --queue-url "${ORDER_QUEUE_URL}" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

NOTIF_QUEUE_URL=$(${CLI} sqs create-queue \
  --queue-name notification-queue \
  --query 'QueueUrl' --output text)
echo "  notification-queue URL: ${NOTIF_QUEUE_URL}"

echo "=== Subscribing order-queue to order-events SNS ==="

${CLI} sns subscribe \
  --topic-arn "${SNS_TOPIC_ARN}" \
  --protocol sqs \
  --notification-endpoint "${ORDER_QUEUE_ARN}" || true

echo "=== Creating Lambda: notification-handler (subscribed to order-queue, no DLQ) ==="

NOTIF_ZIP=$(make_lambda_zip "notification-handler")
NOTIF_LAMBDA_ARN=$(${CLI} lambda create-function \
  --function-name notification-handler \
  --runtime python3.9 \
  --role "${LAMBDA_ROLE_ARN}" \
  --handler index.handler \
  --zip-file "fileb://${NOTIF_ZIP}" \
  --memory-size 256 \
  --description "Notification handler — no DLQ, triggered from SQS" \
  --query 'FunctionArn' --output text 2>/dev/null || \
  ${CLI} lambda get-function --function-name notification-handler --query 'Configuration.FunctionArn' --output text)
echo "  notification-handler ARN: ${NOTIF_LAMBDA_ARN}"

# Wire SQS → Lambda event source mapping
${CLI} lambda create-event-source-mapping \
  --function-name notification-handler \
  --event-source-arn "${ORDER_QUEUE_ARN}" \
  --batch-size 10 \
  --starting-position TRIM_HORIZON || true

# ===========================================================================
# 5. EVENT-DRIVEN CHAIN — Chain 3: EventBridge → Lambda
# ===========================================================================
echo "=== Creating EventBridge: ecommerce-bus ==="

EB_BUS_ARN=$(${CLI} events create-event-bus \
  --name ecommerce-bus \
  --query 'EventBusArn' --output text 2>/dev/null || echo "arn:aws:events:us-east-1:000000000000:event-bus/ecommerce-bus")
echo "  EventBridge Bus ARN: ${EB_BUS_ARN}"

echo "=== Creating Lambda: inventory-sync (no timeout, no DLQ) ==="

INVSYNC_ZIP=$(make_lambda_zip "inventory-sync")
INVSYNC_LAMBDA_ARN=$(${CLI} lambda create-function \
  --function-name inventory-sync \
  --runtime python3.9 \
  --role "${LAMBDA_ROLE_ARN}" \
  --handler index.handler \
  --zip-file "fileb://${INVSYNC_ZIP}" \
  --memory-size 256 \
  --description "Inventory sync — no timeout, triggered by EventBridge" \
  --query 'FunctionArn' --output text 2>/dev/null || \
  ${CLI} lambda get-function --function-name inventory-sync --query 'Configuration.FunctionArn' --output text)
echo "  inventory-sync ARN: ${INVSYNC_LAMBDA_ARN}"

# EventBridge rule targeting inventory-sync
${CLI} events put-rule \
  --name inventory-sync-rule \
  --event-bus-name ecommerce-bus \
  --event-pattern '{"source": ["ecommerce.orders"]}' \
  --state ENABLED || true

${CLI} events put-targets \
  --rule inventory-sync-rule \
  --event-bus-name ecommerce-bus \
  --targets "Id=inventory-sync-target,Arn=${INVSYNC_LAMBDA_ARN}" || true

# ===========================================================================
# 6. DATA LAYER
# ===========================================================================
echo "=== Creating DynamoDB Tables ==="

${CLI} dynamodb create-table \
  --table-name products \
  --attribute-definitions AttributeName=productId,AttributeType=S \
  --key-schema AttributeName=productId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST || true
echo "  DynamoDB: products"

${CLI} dynamodb create-table \
  --table-name sessions \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST || true
echo "  DynamoDB: sessions"

echo "=== Creating S3 Buckets ==="

ASSETS_BUCKET="ecommerce-assets-${RANDOM_SUFFIX}"
BACKUPS_BUCKET="ecommerce-backups-${RANDOM_SUFFIX}"

# Assets bucket: public access NOT blocked (advisory trigger)
${CLI} s3api create-bucket --bucket "${ASSETS_BUCKET}" || true
# Explicitly disable public access block to trigger advisory
${CLI} s3api delete-public-access-block --bucket "${ASSETS_BUCKET}" || true
echo "  S3 Assets bucket (public access not blocked): ${ASSETS_BUCKET}"

# Backups bucket: versioning disabled (advisory trigger)
${CLI} s3api create-bucket --bucket "${BACKUPS_BUCKET}" || true
# Versioning is off by default; do not enable it to trigger advisory
echo "  S3 Backups bucket (versioning disabled): ${BACKUPS_BUCKET}"

echo "=== Creating ElastiCache Redis Cluster (single node, no replica) ==="

${CLI} elasticache create-cache-cluster \
  --cache-cluster-id session-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids "${SG_ID}" || true
echo "  ElastiCache: session-cache (single node — elasticache-no-replica advisory)"

# ===========================================================================
# 7. COMPUTE — ECS
# ===========================================================================
echo "=== Creating ECS Cluster: app-cluster ==="

${CLI} ecs create-cluster \
  --cluster-name app-cluster || true
echo "  ECS Cluster: app-cluster"

echo "=== Creating ECS Task Definition: web-app ==="

${CLI} ecs register-task-definition \
  --family web-app \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --execution-role-arn "${LAMBDA_ROLE_ARN}" \
  --container-definitions '[{
    "name": "web-app",
    "image": "nginx:latest",
    "portMappings": [{"containerPort": 80, "protocol": "tcp"}],
    "essential": true
  }]' || true
echo "  ECS Task Definition: web-app"

echo "=== Creating ECS Service: web-app-service (desired 3, running likely 0 in LocalStack) ==="

${CLI} ecs create-service \
  --cluster app-cluster \
  --service-name web-app-service \
  --task-definition web-app \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_PUBLIC_ID}],securityGroups=[${SG_ID}],assignPublicIp=ENABLED}" || true
echo "  ECS Service: web-app-service (desired=3, running=0 triggers ecs-task-count-mismatch)"

# ===========================================================================
# 8. SECURITY & CONFIG
# ===========================================================================
echo "=== Creating Secrets Manager Secrets ==="

${CLI} secretsmanager create-secret \
  --name db/password \
  --secret-string '{"username":"admin","password":"super-secret-db-password"}' || true
echo "  Secret: db/password"

${CLI} secretsmanager create-secret \
  --name api/stripe-key \
  --secret-string '{"key":"sk_test_demo_stripe_key_localstack"}' || true
echo "  Secret: api/stripe-key"

${CLI} secretsmanager create-secret \
  --name api/sendgrid-key \
  --secret-string '{"key":"SG.demo_sendgrid_key_localstack"}' || true
echo "  Secret: api/sendgrid-key"

echo "=== Creating SSM Parameters ==="

${CLI} ssm put-parameter \
  --name /app/env \
  --value production \
  --type String \
  --overwrite || true
echo "  SSM: /app/env"

${CLI} ssm put-parameter \
  --name /app/version \
  --value "1.4.2" \
  --type String \
  --overwrite || true
echo "  SSM: /app/version"

${CLI} ssm put-parameter \
  --name /app/feature-flags \
  --value '{"new_checkout":true,"beta_recommendations":false,"v2_payments":true}' \
  --type String \
  --overwrite || true
echo "  SSM: /app/feature-flags"

echo "=== Creating ACM Certificate ==="

ACM_CERT_ARN=$(${CLI} acm request-certificate \
  --domain-name "*.ecommerce-demo.com" \
  --subject-alternative-names "ecommerce-demo.com" \
  --validation-method DNS \
  --query 'CertificateArn' --output text 2>/dev/null || echo "")
echo "  ACM Certificate: ${ACM_CERT_ARN}"

# ===========================================================================
# 9. STEP FUNCTIONS
# ===========================================================================
echo "=== Creating Step Functions: order-fulfillment ==="

SFN_ROLE_ARN=$(${CLI} iam create-role \
  --role-name ecommerce-sfn-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "states.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --query 'Role.Arn' --output text 2>/dev/null || \
  ${CLI} iam get-role --role-name ecommerce-sfn-role --query 'Role.Arn' --output text)

SFN_ARN=$(${CLI} stepfunctions create-state-machine \
  --name order-fulfillment \
  --role-arn "${SFN_ROLE_ARN}" \
  --definition '{
    "Comment": "E-commerce order fulfillment state machine",
    "StartAt": "ValidateOrder",
    "States": {
      "ValidateOrder": {
        "Type": "Task",
        "Resource": "'"${ORDER_LAMBDA_ARN}"'",
        "Next": "ProcessPayment",
        "Catch": [{"ErrorEquals": ["States.ALL"], "Next": "OrderFailed"}]
      },
      "ProcessPayment": {
        "Type": "Task",
        "Resource": "'"${PAYMENT_LAMBDA_ARN}"'",
        "Next": "NotifyCustomer",
        "Catch": [{"ErrorEquals": ["States.ALL"], "Next": "OrderFailed"}]
      },
      "NotifyCustomer": {
        "Type": "Task",
        "Resource": "'"${NOTIF_LAMBDA_ARN}"'",
        "End": true
      },
      "OrderFailed": {
        "Type": "Fail",
        "Error": "OrderFulfillmentFailed",
        "Cause": "An error occurred during order processing"
      }
    }
  }' \
  --query 'stateMachineArn' --output text 2>/dev/null || echo "arn:aws:states:us-east-1:000000000000:stateMachine:order-fulfillment")
echo "  Step Functions ARN: ${SFN_ARN}"

# ===========================================================================
# SUMMARY
# ===========================================================================
echo ""
echo "============================================================"
echo "  === Seed Complete ==="
echo "============================================================"
echo ""
echo "  NETWORKING"
echo "    VPC              : ${VPC_ID}"
echo "    Public Subnet    : ${SUBNET_PUBLIC_ID}"
echo "    Private Subnet   : ${SUBNET_PRIVATE_ID}"
echo "    Internet Gateway : ${IGW_ID}"
echo "    Security Group   : ${SG_ID}"
echo "    NAT Gateway      : ${NAT_GW_ID}"
echo ""
echo "  COMPUTE"
echo "    order-processor  : ${ORDER_LAMBDA_ARN}"
echo "    payment-handler  : ${PAYMENT_LAMBDA_ARN}"
echo "    notification-hdlr: ${NOTIF_LAMBDA_ARN}"
echo "    inventory-sync   : ${INVSYNC_LAMBDA_ARN}"
echo "    ECS Cluster      : app-cluster"
echo "    ECS Service      : web-app-service (desired=3)"
echo ""
echo "  API LAYER"
echo "    API Gateway      : ${API_ID}"
echo "    RDS              : ${RDS_INSTANCE_ID}"
echo ""
echo "  MESSAGING"
echo "    SNS Topic        : ${SNS_TOPIC_ARN}"
echo "    order-queue      : ${ORDER_QUEUE_URL}"
echo "    notification-q   : ${NOTIF_QUEUE_URL}"
echo "    EventBridge Bus  : ${EB_BUS_ARN}"
echo ""
echo "  DATA"
echo "    DynamoDB: products, sessions"
echo "    S3 Assets (public): ${ASSETS_BUCKET}"
echo "    S3 Backups (no versioning): ${BACKUPS_BUCKET}"
echo "    ElastiCache: session-cache (single node)"
echo ""
echo "  SECURITY & CONFIG"
echo "    Secrets: db/password, api/stripe-key, api/sendgrid-key"
echo "    SSM Params: /app/env, /app/version, /app/feature-flags"
echo "    ACM Cert: ${ACM_CERT_ARN}"
echo ""
echo "  ASYNC"
echo "    Step Functions: ${SFN_ARN}"
echo ""
echo "  INTENTIONAL ADVISORY TRIGGERS"
echo "    [sg-open-ssh]              SG allows 0.0.0.0/0 on port 22"
echo "    [lambda-no-timeout]        order-processor, payment-handler, inventory-sync, notification-handler"
echo "    [lambda-no-dlq]            All four Lambda functions"
echo "    [lambda-low-memory]        payment-handler (128MB)"
echo "    [rds-no-multiaz]           orders-db"
echo "    [rds-no-deletion-protect]  orders-db"
echo "    [rds-no-backup]            orders-db (retention=0)"
echo "    [sqs-no-dlq]               order-queue, notification-queue"
echo "    [s3-public-access]         ${ASSETS_BUCKET}"
echo "    [s3-no-versioning]         ${BACKUPS_BUCKET}"
echo "    [elasticache-no-replica]   session-cache (1 node)"
echo "    [ecs-task-count-mismatch]  web-app-service (desired=3, running=0)"
echo ""
echo "  Scan Terminus now to see the full blast radius graph."
echo "============================================================"
