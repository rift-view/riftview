# Integration-test seed for the RiftView CLI against LocalStack.
#
# One resource per scannable NodeType that LocalStack Community-Archive
# supports. NodeTypes NOT covered (intentional gap):
#   acm, cloudfront, apigw, apigw-route, ecr-repo, ssm-param,
#   nat-gateway, r53-zone, ses, cognito, kinesis, ecs, elasticache,
#   eks, opensearch, msk, rds, alb.
#
# `rds` and `alb` (elbv2) are pro-only in Community-Archive — the image
# returns HTTP 501 "service is not included within your LocalStack license"
# for both. Do not re-add them without upgrading the license or the
# integration suite will fail on apply.
#
# When adding a new scanned service: extend this file with a minimal
# resource so the integration suite exercises the new scan path. See
# CLAUDE.md "Adding a new AWS service (scan)".

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
  s3_use_path_style           = true

  # All services route through the single LocalStack edge port.
  endpoints {
    ec2            = "http://localhost:4566"
    s3             = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    iam            = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    sns            = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    events         = "http://localhost:4566"
    stepfunctions  = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    sts            = "http://localhost:4566"
    cloudwatch     = "http://localhost:4566"
    logs           = "http://localhost:4566"
  }
}

# ── Networking (vpc, subnet, igw, security-group) ───────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "rv-seed-vpc", Env = "test" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "rv-seed-igw" }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags                    = { Name = "rv-seed-public-a", Tier = "public" }
}

# Second subnet in a different AZ, to give the scan surface more than
# one subnet node to enumerate.
resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true
  tags                    = { Name = "rv-seed-public-b", Tier = "public" }
}

resource "aws_security_group" "web" {
  name        = "rv-seed-web"
  description = "seed web-tier SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "rv-seed-web" }
}

# ── Compute (ec2) ───────────────────────────────────────────────────────────

resource "aws_instance" "web" {
  ami                    = "ami-12345678"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.web.id]
  tags                   = { Name = "rv-seed-web", Role = "web" }
}

# ── IAM (role — not a NodeType but needed by lambda + sfn below) ────────────

resource "aws_iam_role" "lambda_exec" {
  name = "rv-seed-lambda-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role" "sfn_exec" {
  name = "rv-seed-sfn-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# ── Serverless compute (lambda) ─────────────────────────────────────────────

data "archive_file" "lambda_stub" {
  type        = "zip"
  output_path = "/tmp/rv-seed-lambda.zip"
  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: 'ok' })"
    filename = "index.js"
  }
}

resource "aws_lambda_function" "api" {
  function_name    = "rv-seed-api"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256
  timeout          = 30
  memory_size      = 256
  tags             = { Name = "rv-seed-api" }
}

# ── Storage (s3) ────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "assets" {
  bucket = "rv-seed-assets"
  tags   = { Name = "rv-seed-assets" }
}

# ── Messaging (sqs, sns) ────────────────────────────────────────────────────

resource "aws_sqs_queue" "jobs" {
  name                       = "rv-seed-jobs"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400
  tags                       = { Name = "rv-seed-jobs" }
}

resource "aws_sns_topic" "alerts" {
  name = "rv-seed-alerts"
  tags = { Name = "rv-seed-alerts" }
}

# ── Database (dynamo) ───────────────────────────────────────────────────────

resource "aws_dynamodb_table" "sessions" {
  name         = "rv-seed-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  tags = { Name = "rv-seed-sessions" }
}

# ── Config (secret) ─────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db_password" {
  name        = "rv-seed/db/password"
  description = "DB password for integration seed"
  tags        = { Name = "rv-seed-db-pw" }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({ username = "admin", password = "localstack-test-only" })
}

# ── Orchestration (events = eventbridge-bus, stepfunctions = sfn) ───────────

resource "aws_cloudwatch_event_rule" "daily" {
  name                = "rv-seed-daily"
  description         = "seed eventbridge rule for integration tests"
  schedule_expression = "rate(1 day)"
  tags                = { Name = "rv-seed-daily" }
}

resource "aws_sfn_state_machine" "demo" {
  name     = "rv-seed-sm"
  role_arn = aws_iam_role.sfn_exec.arn
  definition = jsonencode({
    StartAt = "Done"
    States = {
      Done = { Type = "Pass", End = true }
    }
  })
  tags = { Name = "rv-seed-sm" }
}
