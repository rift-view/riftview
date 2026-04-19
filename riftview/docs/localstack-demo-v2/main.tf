################################################################################
# RiftView LocalStack Demo — "Static Website with API" fixture
#
# Purpose: exercise every RiftView-visualised service type, trigger advisory
#          rules intentionally so the Fix button can be tested, and create enough
#          integration edges (SNS→SQS, Lambda→DynamoDB, EventBridge→Lambda, etc.)
#          that edge rendering is thoroughly tested.
#
# Run with:  tflocal init && tflocal apply
# Destroy:   tflocal destroy
################################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

################################################################################
# Provider — LocalStack
################################################################################

locals {
  region   = "us-east-1"
  endpoint = "http://localhost:4566"
  account  = "000000000000"
}

provider "aws" {
  region                      = local.region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    acm            = local.endpoint
    apigatewayv2   = local.endpoint
    cloudfront     = local.endpoint
    cognito-idp    = local.endpoint
    dynamodb       = local.endpoint
    ec2            = local.endpoint
    events         = local.endpoint
    iam            = local.endpoint
    lambda         = local.endpoint
    route53        = local.endpoint
    s3             = local.endpoint
    secretsmanager = local.endpoint
    ses            = local.endpoint
    sfn            = local.endpoint
    sns            = local.endpoint
    sqs            = local.endpoint
    ssm            = local.endpoint
    sts            = local.endpoint
  }

  # Required for LocalStack S3 path-style access
  s3_use_path_style = true
}

################################################################################
# Lambda source — inline Python via archive_file
################################################################################

# --- api-handler (intentionally misconfigured: no DLQ, 128 MB memory) ----------
# ADVISORY: lambda-low-memory  (memory_size = 128)
# ADVISORY: lambda-no-dlq      (no dead_letter_config)
# NOTE: timeout IS set so lambda-no-timeout does NOT fire here
resource "local_file" "api_handler_src" {
  content  = <<-PYTHON
    import json, os, time, random, string, boto3

    _endpoint = os.environ.get('AWS_ENDPOINT_URL', 'http://localhost.localstack.cloud:4566')
    _region   = os.environ.get('AWS_REGION', 'us-east-1')

    dynamo = boto3.resource('dynamodb', region_name=_region, endpoint_url=_endpoint)
    table  = dynamo.Table(os.environ['TABLE_NAME'])

    sns    = boto3.client('sns', region_name=_region, endpoint_url=_endpoint)
    topic_arn = os.environ.get('SNS_TOPIC_ARN', '')

    def _id():
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))

    def _ok(status, body):
        return {
            'statusCode': status,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(body),
        }

    def handler(event, _ctx):
        method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
        path   = event.get('rawPath', '/')
        params = event.get('pathParameters') or {}

        if method == 'OPTIONS':
            return _ok(200, {})

        if method == 'GET' and '/items' in path:
            items = sorted(table.scan().get('Items', []), key=lambda x: x.get('ts', '0'), reverse=True)
            return _ok(200, {'items': items})

        if method == 'POST' and '/items' in path:
            body = json.loads(event.get('body') or '{}')
            item = {'id': _id(), 'name': (body.get('name') or 'Untitled')[:120], 'ts': str(int(time.time()*1000))}
            table.put_item(Item=item)
            if topic_arn:
                sns.publish(TopicArn=topic_arn, Message=json.dumps(item), Subject='new-item')
            return _ok(201, {'item': item})

        if method == 'DELETE':
            iid = params.get('id') or path.rstrip('/').split('/')[-1]
            table.delete_item(Key={'id': iid})
            return _ok(200, {'deleted': iid})

        return _ok(404, {'error': f'No route for {method} {path}'})
  PYTHON
  filename = "${path.module}/.build/api_handler.py"
}

data "archive_file" "api_handler" {
  type        = "zip"
  output_path = "${path.module}/.build/api_handler.zip"
  source {
    content  = local_file.api_handler_src.content
    filename = "handler.py"
  }
}

# --- workflow-processor (correctly configured: timeout=30, 512 MB, has DLQ) ---
resource "local_file" "workflow_src" {
  content  = <<-PYTHON
    import json, os, boto3

    _endpoint = os.environ.get('AWS_ENDPOINT_URL', 'http://localhost.localstack.cloud:4566')
    _region   = os.environ.get('AWS_REGION', 'us-east-1')

    dynamo = boto3.resource('dynamodb', region_name=_region, endpoint_url=_endpoint)
    table  = dynamo.Table(os.environ.get('TABLE_NAME', 'demo-items'))

    def handler(event, _ctx):
        for record in event.get('Records', []):
            body = json.loads(record.get('body', '{}'))
            print(f"Processing workflow event: {body}")
        return {'statusCode': 200}
  PYTHON
  filename = "${path.module}/.build/workflow_handler.py"
}

data "archive_file" "workflow_handler" {
  type        = "zip"
  output_path = "${path.module}/.build/workflow_handler.zip"
  source {
    content  = local_file.workflow_src.content
    filename = "handler.py"
  }
}

# --- timeout-test (intentionally misconfigured: no timeout set at all) ----------
# ADVISORY: lambda-no-timeout  (timeout omitted — defaults to 0 in metadata scan)
# ADVISORY: lambda-no-dlq      (no dead_letter_config)
resource "local_file" "timeout_test_src" {
  content  = <<-PYTHON
    import json

    def handler(event, _ctx):
        return {'statusCode': 200, 'body': json.dumps({'ok': True})}
  PYTHON
  filename = "${path.module}/.build/timeout_test_handler.py"
}

data "archive_file" "timeout_test_handler" {
  type        = "zip"
  output_path = "${path.module}/.build/timeout_test_handler.zip"
  source {
    content  = local_file.timeout_test_src.content
    filename = "handler.py"
  }
}

################################################################################
# IAM
################################################################################

resource "aws_iam_role" "lambda_exec" {
  name = "demo-lambda-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_full" {
  name = "demo-lambda-full"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:*", "sqs:*", "sns:*", "logs:*", "s3:*", "secretsmanager:GetSecretValue", "ssm:GetParameter"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "sfn_exec" {
  name = "demo-sfn-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "sfn_full" {
  name = "demo-sfn-full"
  role = aws_iam_role.sfn_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction", "dynamodb:*", "sqs:*", "sns:*", "logs:*"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "events_exec" {
  name = "demo-events-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "events_full" {
  name = "demo-events-full"
  role = aws_iam_role.events_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction", "states:StartExecution", "sqs:SendMessage"]
      Resource = "*"
    }]
  })
}

################################################################################
# VPC, Subnets, IGW, Security Groups
################################################################################

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "demo-vpc", Project = "riftview-demo" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "demo-igw", Project = "riftview-demo" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${local.region}a"
  map_public_ip_on_launch = true
  tags = { Name = "demo-public-subnet", Project = "riftview-demo" }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${local.region}a"
  tags = { Name = "demo-private-subnet", Project = "riftview-demo" }
}

# ADVISORY: ec2-public-ssh — intentional: port 22 open to 0.0.0.0/0
resource "aws_security_group" "bastion" {
  name        = "demo-bastion-sg"
  description = "Bastion security group (intentionally misconfigured for advisory testing)"
  vpc_id      = aws_vpc.main.id

  # INTENTIONAL MISCONFIGURATION: triggers ec2-public-ssh advisory
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "INTENTIONAL: SSH from anywhere - triggers ec2-public-ssh advisory"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "demo-bastion-sg", Project = "riftview-demo" }
}

resource "aws_security_group" "app" {
  name        = "demo-app-sg"
  description = "Application security group (correctly configured)"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "demo-app-sg", Project = "riftview-demo" }
}

################################################################################
# EC2 — bastion (triggers ec2-public-ssh via security group above)
################################################################################

# LocalStack has no pre-seeded AMIs — register a dummy one at plan time.
data "external" "localstack_ami" {
  program = ["bash", "${path.module}/register-ami.sh"]
}

resource "aws_instance" "bastion" {
  ami                         = data.external.localstack_ami.result.ami_id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.bastion.id]
  associate_public_ip_address = true

  tags = { Name = "demo-bastion", Project = "riftview-demo" }
}

################################################################################
# S3
################################################################################

# ADVISORY: s3-public-access + s3-no-versioning — intentional misconfigurations
# INTENTIONAL: no aws_s3_bucket_public_access_block → publicAccessEnabled=true
# INTENTIONAL: no aws_s3_bucket_versioning → versioningEnabled=false
resource "aws_s3_bucket" "static_assets" {
  bucket = "demo-static-assets-riftview"
  # INTENTIONAL MISCONFIGURATION: no public access block → s3-public-access advisory
  # INTENTIONAL MISCONFIGURATION: no versioning → s3-no-versioning advisory
  tags = { Name = "demo-static-assets", Project = "riftview-demo" }
}

# Correctly configured bucket (no advisories should fire)
resource "aws_s3_bucket" "artifacts" {
  bucket = "demo-artifacts-riftview"
  tags   = { Name = "demo-artifacts", Project = "riftview-demo" }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

################################################################################
# DynamoDB
################################################################################

resource "aws_dynamodb_table" "items" {
  name         = "demo-items"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = { Name = "demo-items", Project = "riftview-demo" }
}

resource "aws_dynamodb_table" "sessions" {
  name         = "demo-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  tags = { Name = "demo-sessions", Project = "riftview-demo" }
}

################################################################################
# SQS
################################################################################

# Dead-letter queue for the workflow processor (used as DLQ target)
resource "aws_sqs_queue" "workflow_dlq" {
  name                      = "demo-workflow-dlq"
  message_retention_seconds = 1209600
  tags                      = { Name = "demo-workflow-dlq", Project = "riftview-demo" }
}

# Correctly configured queue (has DLQ)
resource "aws_sqs_queue" "workflow" {
  name = "demo-workflow-queue"

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.workflow_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "demo-workflow-queue", Project = "riftview-demo" }
}

# ADVISORY: sqs-no-dlq — intentional: no redrive_policy
resource "aws_sqs_queue" "notifications" {
  name = "demo-notifications"
  # INTENTIONAL MISCONFIGURATION: no redrive_policy → sqs-no-dlq advisory
  tags = { Name = "demo-notifications", Project = "riftview-demo" }
}

################################################################################
# SNS (integration edge: SNS → SQS via subscription)
# Note: SQS node ID in RiftView is the queue ARN (required for SNS→SQS edge)
################################################################################

resource "aws_sns_topic" "alerts" {
  name = "demo-alerts"
  tags = { Name = "demo-alerts", Project = "riftview-demo" }
}

resource "aws_sns_topic" "events" {
  name = "demo-events"
  tags = { Name = "demo-events", Project = "riftview-demo" }
}

# SNS → SQS subscription (creates integration edge in RiftView)
resource "aws_sns_topic_subscription" "alerts_to_notifications" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notifications.arn
}

resource "aws_sns_topic_subscription" "events_to_workflow" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.workflow.arn
}

################################################################################
# Secrets Manager
################################################################################

# Correctly configured (no advisory)
resource "aws_secretsmanager_secret" "api_key" {
  name        = "demo/api-key"
  description = "Demo API key - LocalStack test fixture"
  tags        = { Project = "riftview-demo" }
}

resource "aws_secretsmanager_secret_version" "api_key" {
  secret_id     = aws_secretsmanager_secret.api_key.id
  secret_string = jsonencode({ key = "demo-secret-localstack-only-not-real" })
}

resource "aws_secretsmanager_secret" "db_creds" {
  name        = "demo/db-credentials"
  description = "Demo DB credentials - LocalStack test fixture"
  tags        = { Project = "riftview-demo" }
}

resource "aws_secretsmanager_secret_version" "db_creds" {
  secret_id     = aws_secretsmanager_secret.db_creds.id
  secret_string = jsonencode({ username = "admin", password = "localstack-only" })
}

################################################################################
# SSM Parameter Store
################################################################################

resource "aws_ssm_parameter" "app_config" {
  name  = "/demo/app/config"
  type  = "String"
  value = jsonencode({ featureFlags = { betaEnabled = true }, maxItems = 100 })
  tags  = { Project = "riftview-demo" }
}

resource "aws_ssm_parameter" "api_endpoint" {
  name  = "/demo/app/api-endpoint"
  type  = "String"
  value = "http://localhost:4566/_aws/execute-api"
  tags  = { Project = "riftview-demo" }
}

resource "aws_ssm_parameter" "db_host" {
  name  = "/demo/db/host"
  type  = "SecureString"
  value = "demo-db.cluster.localstack"
  tags  = { Project = "riftview-demo" }
}

################################################################################
# Lambda functions
################################################################################

# --- api-handler: misconfigured (128 MB, no DLQ, timeout=30 so no timeout advisory) ---
# ADVISORY: lambda-low-memory (memorySize=128)
# ADVISORY: lambda-no-dlq    (no dead_letter_config)
resource "aws_lambda_function" "api_handler" {
  function_name    = "demo-api-handler"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.api_handler.output_path
  source_code_hash = data.archive_file.api_handler.output_base64sha256

  # INTENTIONAL MISCONFIGURATION: memory_size=128 → lambda-low-memory advisory
  memory_size = 128
  timeout     = 30

  # INTENTIONAL MISCONFIGURATION: no dead_letter_config → lambda-no-dlq advisory

  environment {
    variables = {
      TABLE_NAME    = aws_dynamodb_table.items.name
      # ARN env vars create integration edges to DynamoDB, SNS (scanner resolves these)
      DYNAMO_ARN    = "arn:aws:dynamodb:${local.region}:${local.account}:table/${aws_dynamodb_table.items.name}"
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
    }
  }

  tags = { Name = "demo-api-handler", Project = "riftview-demo" }

  depends_on = [data.archive_file.api_handler]
}

# --- timeout-test: misconfigured (no DLQ, 128 MB, timeout intentionally omitted) ---
# ADVISORY: lambda-no-dlq     (no dead_letter_config)
# ADVISORY: lambda-low-memory (memorySize=128 default — no memory_size set)
# NOTE on lambda-no-timeout: LocalStack always returns the AWS default timeout (3s)
# even when none is set in Terraform, so the advisor fires only when the scanner
# receives timeout=undefined (e.g. GetFunctionConfiguration fails). In practice,
# omitting timeout here documents the intended misconfiguration pattern and the
# advisory will fire if LocalStack ever returns Timeout=0 or omits the field.
resource "aws_lambda_function" "timeout_test" {
  function_name    = "demo-timeout-test"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.timeout_test_handler.output_path
  source_code_hash = data.archive_file.timeout_test_handler.output_base64sha256

  # INTENTIONAL: no timeout attribute (documents lambda-no-timeout pattern)
  # INTENTIONAL: no memory_size → defaults to 128 → lambda-low-memory advisory
  # INTENTIONAL: no dead_letter_config → lambda-no-dlq advisory

  tags = { Name = "demo-timeout-test", Project = "riftview-demo" }

  depends_on = [data.archive_file.timeout_test_handler]
}

# --- workflow-processor: correctly configured (timeout=30, 512 MB, has DLQ) ---
resource "aws_lambda_function" "workflow_processor" {
  function_name    = "demo-workflow-processor"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.workflow_handler.output_path
  source_code_hash = data.archive_file.workflow_handler.output_base64sha256
  memory_size      = 512
  timeout          = 30

  # Correctly configured: has DLQ → no lambda-no-dlq advisory
  dead_letter_config {
    target_arn = aws_sqs_queue.workflow_dlq.arn
  }

  environment {
    variables = {
      TABLE_NAME    = aws_dynamodb_table.items.name
      DYNAMO_ARN    = "arn:aws:dynamodb:${local.region}:${local.account}:table/${aws_dynamodb_table.items.name}"
      EVENTS_BUS_ARN = "arn:aws:events:${local.region}:${local.account}:event-bus/demo-events-bus"
    }
  }

  tags = { Name = "demo-workflow-processor", Project = "riftview-demo" }

  depends_on = [data.archive_file.workflow_handler]
}

# SQS trigger for workflow-processor (creates integration edge SQS → Lambda)
resource "aws_lambda_event_source_mapping" "workflow_sqs_trigger" {
  event_source_arn = aws_sqs_queue.workflow.arn
  function_name    = aws_lambda_function.workflow_processor.arn
  batch_size       = 10
  enabled          = true
}

################################################################################
# API Gateway v2 (HTTP API)
################################################################################

resource "aws_apigatewayv2_api" "main" {
  name          = "demo-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
  }

  tags = { Name = "demo-api", Project = "riftview-demo" }
}

resource "aws_apigatewayv2_integration" "api_lambda" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_handler.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_items" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /items"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

resource "aws_apigatewayv2_route" "post_items" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /items"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

resource "aws_apigatewayv2_route" "delete_item" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /items/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

resource "aws_apigatewayv2_route" "get_health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_api_handler" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

################################################################################
# ACM Certificate
################################################################################

resource "aws_acm_certificate" "main" {
  domain_name       = "demo.riftview.local"
  validation_method = "DNS"

  subject_alternative_names = [
    "api.riftview.local",
    "*.riftview.local",
  ]

  tags = { Name = "demo-cert", Project = "riftview-demo" }

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# CloudFront
################################################################################

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  # Origin 1: S3 static assets
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-static-assets"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origin 2: API Gateway
  origin {
    domain_name = "${aws_apigatewayv2_api.main.id}.execute-api.${local.region}.amazonaws.com"
    origin_id   = "APIGW-main"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-static-assets"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  # Cache behavior for /api/* → API Gateway
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "APIGW-main"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = true
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "demo-distribution", Project = "riftview-demo" }
}

################################################################################
# Route 53
################################################################################

resource "aws_route53_zone" "main" {
  name    = "riftview.local"
  comment = "Demo hosted zone for RiftView LocalStack fixture"
  tags    = { Project = "riftview-demo" }
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.riftview.local"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.main.domain_name]
}

################################################################################
# EventBridge (integration edges: EventBridge → Lambda, EventBridge → SFN)
################################################################################

resource "aws_cloudwatch_event_bus" "app" {
  name = "demo-events-bus"
  tags = { Project = "riftview-demo" }
}

# Rule: route order.created events to workflow Lambda
resource "aws_cloudwatch_event_rule" "order_created" {
  name           = "demo-order-created"
  event_bus_name = aws_cloudwatch_event_bus.app.name
  description    = "Route order.created events to workflow processor"
  event_pattern = jsonencode({
    "source"      = ["demo.orders"],
    "detail-type" = ["order.created"]
  })
  tags = { Project = "riftview-demo" }
}

resource "aws_cloudwatch_event_target" "order_to_lambda" {
  rule           = aws_cloudwatch_event_rule.order_created.name
  event_bus_name = aws_cloudwatch_event_bus.app.name
  target_id      = "WorkflowLambda"
  arn            = aws_lambda_function.workflow_processor.arn
  role_arn       = aws_iam_role.events_exec.arn
}

# Rule: route audit events to SQS
resource "aws_cloudwatch_event_rule" "audit" {
  name           = "demo-audit-events"
  event_bus_name = aws_cloudwatch_event_bus.app.name
  description    = "Route audit events to workflow SQS queue"
  event_pattern = jsonencode({
    "source" = ["demo.audit"]
  })
  tags = { Project = "riftview-demo" }
}

resource "aws_cloudwatch_event_target" "audit_to_sqs" {
  rule           = aws_cloudwatch_event_rule.audit.name
  event_bus_name = aws_cloudwatch_event_bus.app.name
  target_id      = "WorkflowSQS"
  arn            = aws_sqs_queue.workflow.arn
  role_arn       = aws_iam_role.events_exec.arn
}

resource "aws_lambda_permission" "events_workflow" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workflow_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.order_created.arn
}

################################################################################
# Step Functions (integration edges: SFN → Lambda, SFN → DynamoDB, SFN → SNS)
################################################################################

resource "aws_sfn_state_machine" "order_workflow" {
  name     = "demo-order-workflow"
  role_arn = aws_iam_role.sfn_exec.arn
  type     = "STANDARD"

  # The definition references Lambda and DynamoDB ARNs — scanner extracts these
  # as integration edges (SFN → Lambda, SFN → DynamoDB)
  definition = jsonencode({
    Comment = "Demo order processing workflow"
    StartAt = "ValidateOrder"
    States = {
      ValidateOrder = {
        Type     = "Task"
        # Direct Lambda ARN — scanner's isKnownTarget matches arn:aws:lambda: prefix
        Resource = aws_lambda_function.api_handler.arn
        Parameters = {
          "action" = "validate"
        }
        Next = "SaveOrder"
      }
      SaveOrder = {
        Type     = "Task"
        Resource = aws_lambda_function.workflow_processor.arn
        Parameters = {
          "action"    = "save"
          "tableName" = aws_dynamodb_table.items.name
        }
        Next = "NotifyTeam"
      }
      NotifyTeam = {
        Type     = "Task"
        Resource = aws_lambda_function.workflow_processor.arn
        Parameters = {
          "action"   = "notify"
          "topicArn" = aws_sns_topic.alerts.arn
        }
        End = true
      }
    }
  })

  tags = { Name = "demo-order-workflow", Project = "riftview-demo" }
}

################################################################################
# Cognito User Pool
################################################################################

resource "aws_cognito_user_pool" "main" {
  name = "demo-user-pool"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  auto_verified_attributes = ["email"]

  tags = { Project = "riftview-demo" }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "demo-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
}

################################################################################
# SES
################################################################################

resource "aws_ses_domain_identity" "main" {
  domain = "riftview.local"
}

resource "aws_ses_email_identity" "notifications" {
  email = "notifications@riftview.local"
}

################################################################################
# Outputs
################################################################################

locals {
  api_url = "http://localhost:4566/_aws/execute-api/${aws_apigatewayv2_api.main.id}/$default"
}

output "api_url" {
  description = "API Gateway invoke URL (LocalStack path-style)"
  value       = local.api_url
}

output "api_gateway_id" {
  value = aws_apigatewayv2_api.main.id
}

output "static_assets_bucket" {
  value = aws_s3_bucket.static_assets.bucket
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "dynamodb_items_table" {
  value = aws_dynamodb_table.items.name
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "sfn_arn" {
  value = aws_sfn_state_machine.order_workflow.arn
}

output "route53_zone_id" {
  value = aws_route53_zone.main.zone_id
}
