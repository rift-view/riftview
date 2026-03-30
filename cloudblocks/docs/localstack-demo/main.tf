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
    apigatewayv2   = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    iam            = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    s3             = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    sns            = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    sts            = "http://localhost:4566"
  }
}

# ── Package Lambda ────────────────────────────────────────────────────────────

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/.build/lambda.zip"
}

# ── DynamoDB ──────────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "items" {
  name         = "demo-items"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = { Name = "demo-items", Project = "cloudblocks-demo" }
}

# ── IAM ───────────────────────────────────────────────────────────────────────

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

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamo" {
  name = "demo-dynamo-access"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:Scan", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:GetItem"]
      Resource = aws_dynamodb_table.items.arn
    }]
  })
}

# ── Lambda ────────────────────────────────────────────────────────────────────

resource "aws_lambda_function" "api" {
  function_name    = "demo-api-handler"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.items.name
    }
  }

  tags = { Name = "demo-api-handler", Project = "cloudblocks-demo" }
}

# ── SQS (notifications queue wired via SNS subscription) ─────────────────────

resource "aws_sqs_queue" "notify" {
  name = "demo-notifications"
  tags = { Name = "demo-notifications", Project = "cloudblocks-demo" }
}

# ── SNS (alert topic → SQS subscription) ─────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "demo-alerts"
  tags = { Name = "demo-alerts", Project = "cloudblocks-demo" }
}

resource "aws_sns_topic_subscription" "alerts_to_sqs" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notify.arn
}

# ── Secrets Manager ───────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "api_key" {
  name        = "demo/api-key"
  description = "Demo API secret (LocalStack test value)"
  tags        = { Project = "cloudblocks-demo" }
}

resource "aws_secretsmanager_secret_version" "api_key" {
  secret_id     = aws_secretsmanager_secret.api_key.id
  secret_string = jsonencode({ key = "demo-secret-localstack-only" })
}

# ── S3 (asset bucket) ─────────────────────────────────────────────────────────

resource "aws_s3_bucket" "assets" {
  bucket = "demo-assets-bucket"
  tags   = { Name = "demo-assets", Project = "cloudblocks-demo" }
}

resource "aws_s3_bucket_notification" "assets_events" {
  bucket = aws_s3_bucket.assets.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.api.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.s3]
}

resource "aws_lambda_permission" "s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.assets.arn
}

# ── API Gateway v2 (HTTP API) ─────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "demo-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_headers = ["content-type"]
  }

  tags = { Name = "demo-api", Project = "cloudblocks-demo" }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_items" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /items"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_items" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /items"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "delete_item" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "DELETE /items/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ── Outputs ───────────────────────────────────────────────────────────────────

locals {
  # LocalStack API Gateway v2 invoke URL format (works without domain resolution)
  api_url = "http://localhost:4566/_aws/execute-api/${aws_apigatewayv2_api.main.id}/$default"
}

output "api_url" {
  description = "Paste this into the test site URL field"
  value       = local.api_url
}

output "dynamodb_table" {
  value = aws_dynamodb_table.items.name
}

output "lambda_function" {
  value = aws_lambda_function.api.function_name
}
