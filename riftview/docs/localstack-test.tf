terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    ec2            = "http://localhost:4566"
    s3             = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    iam            = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    sns            = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    ssm            = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    apigateway     = "http://localhost:4566"
    apigatewayv2   = "http://localhost:4566"
    route53        = "http://localhost:4566"
    sts            = "http://localhost:4566"
  }
}

# ── VPC ─────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "cb-test-vpc", Env = "staging" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "cb-test-igw" }
}

# ── Subnets ──────────────────────────────────────────────────────────────────

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "cb-public-a", Tier = "public" }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true
  tags = { Name = "cb-public-b", Tier = "public" }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "cb-private-a", Tier = "private" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "us-east-1b"
  tags = { Name = "cb-private-b", Tier = "private" }
}

# ── Security Groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "web" {
  name        = "cb-web-sg"
  description = "Web tier — HTTP/HTTPS inbound"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "cb-web-sg" }
}

resource "aws_security_group" "app" {
  name        = "cb-app-sg"
  description = "App tier — internal traffic from web SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "cb-app-sg" }
}

resource "aws_security_group" "db" {
  name        = "cb-db-sg"
  description = "DB tier — Postgres from app SG only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "cb-db-sg" }
}

# ── IAM ──────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "cb-lambda-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ── EC2 ──────────────────────────────────────────────────────────────────────

resource "aws_instance" "web_a" {
  ami                    = "ami-12345678"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.web.id]
  tags = { Name = "cb-web-a", Role = "web", Env = "staging" }
}

resource "aws_instance" "app_a" {
  ami                    = "ami-12345678"
  instance_type          = "t3.small"
  subnet_id              = aws_subnet.private_a.id
  vpc_security_group_ids = [aws_security_group.app.id]
  tags = { Name = "cb-app-a", Role = "app", Env = "staging" }
}

resource "aws_instance" "app_b" {
  ami                    = "ami-12345678"
  instance_type          = "t3.small"
  subnet_id              = aws_subnet.private_b.id
  vpc_security_group_ids = [aws_security_group.app.id]
  tags = { Name = "cb-app-b", Role = "app", Env = "staging" }
}

# ── S3 ───────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "assets" {
  bucket = "cb-test-assets-bucket"
  tags   = { Name = "cb-assets", Purpose = "static-assets" }
}

resource "aws_s3_bucket" "logs" {
  bucket = "cb-test-logs-bucket"
  tags   = { Name = "cb-logs", Purpose = "access-logs" }
}

resource "aws_s3_bucket" "tf_state" {
  bucket = "cb-test-tf-state"
  tags   = { Name = "cb-tf-state", Purpose = "terraform-state" }
}

# ── Lambda ───────────────────────────────────────────────────────────────────

data "archive_file" "lambda_stub" {
  type        = "zip"
  output_path = "/tmp/cb-lambda-stub.zip"
  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: 'ok' })"
    filename = "index.js"
  }
}

resource "aws_lambda_function" "auth" {
  function_name    = "cb-auth-handler"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256
  timeout          = 30
  memory_size      = 256
  tags = { Name = "cb-auth-handler", Team = "platform" }
}

resource "aws_lambda_function" "worker" {
  function_name    = "cb-background-worker"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256
  timeout          = 300
  memory_size      = 512
  tags = { Name = "cb-background-worker", Team = "data" }
}

resource "aws_lambda_function" "api_proxy" {
  function_name    = "cb-api-proxy"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256
  timeout          = 15
  memory_size      = 128
  tags = { Name = "cb-api-proxy", Team = "platform" }
}

# ── SQS ──────────────────────────────────────────────────────────────────────

resource "aws_sqs_queue" "jobs" {
  name                       = "cb-jobs-queue"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400
  tags = { Name = "cb-jobs-queue" }
}

resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "cb-jobs-dlq"
  message_retention_seconds = 1209600
  tags = { Name = "cb-jobs-dlq", Purpose = "dead-letter" }
}

resource "aws_sqs_queue" "notifications" {
  name = "cb-notifications-queue"
  tags = { Name = "cb-notifications-queue" }
}

# ── SNS ──────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "cb-alerts"
  tags = { Name = "cb-alerts" }
}

resource "aws_sns_topic" "deploys" {
  name = "cb-deploy-events"
  tags = { Name = "cb-deploy-events" }
}

resource "aws_sns_topic_subscription" "alerts_to_sqs" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notifications.arn
}

# ── DynamoDB ─────────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "sessions" {
  name         = "cb-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = { Name = "cb-sessions", Team = "platform" }
}

resource "aws_dynamodb_table" "feature_flags" {
  name         = "cb-feature-flags"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "flag_key"

  attribute {
    name = "flag_key"
    type = "S"
  }

  tags = { Name = "cb-feature-flags" }
}

# ── SSM Parameters ───────────────────────────────────────────────────────────

resource "aws_ssm_parameter" "db_host" {
  name  = "/cb/staging/db/host"
  type  = "String"
  value = "db.internal.example.com"
  tags  = { Env = "staging" }
}

resource "aws_ssm_parameter" "db_port" {
  name  = "/cb/staging/db/port"
  type  = "String"
  value = "5432"
  tags  = { Env = "staging" }
}

resource "aws_ssm_parameter" "app_config" {
  name  = "/cb/staging/app/config"
  type  = "String"
  value = jsonencode({ log_level = "info", max_connections = 100 })
  tags  = { Env = "staging" }
}

# ── Secrets Manager ──────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db_password" {
  name        = "cb/staging/db/password"
  description = "PostgreSQL master password"
  tags        = { Env = "staging", Managed = "terraform" }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({ username = "admin", password = "localstack-test-only" })
}

resource "aws_secretsmanager_secret" "api_key" {
  name        = "cb/staging/external/stripe-key"
  description = "Stripe API key"
  tags        = { Env = "staging", Managed = "terraform" }
}

# ── API Gateway v2 (HTTP) ────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "cb-api"
  protocol_type = "HTTP"
  tags          = { Name = "cb-api", Env = "staging" }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth_login" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_route" "auth_refresh" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/refresh"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_integration" "proxy" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_proxy.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api_wildcard" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.proxy.id}"
}

# ── Route 53 ─────────────────────────────────────────────────────────────────

resource "aws_route53_zone" "internal" {
  name = "cb-internal.local"
  vpc {
    vpc_id = aws_vpc.main.id
  }
  tags = { Name = "cb-internal-zone" }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "vpc_id"        { value = aws_vpc.main.id }
output "api_endpoint"  { value = aws_apigatewayv2_api.main.api_endpoint }
output "auth_fn_name"  { value = aws_lambda_function.auth.function_name }
output "jobs_queue_url" { value = aws_sqs_queue.jobs.url }
output "alerts_topic_arn" { value = aws_sns_topic.alerts.arn }
