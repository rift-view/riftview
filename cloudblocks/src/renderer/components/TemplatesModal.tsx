import { useState } from 'react'

interface Template {
  id: string
  name: string
  description: string
  hcl: string
}

const TEMPLATES: Template[] = [
  {
    id: 'basic-vpc',
    name: 'Basic VPC',
    description: 'VPC with public subnet and internet gateway',
    hcl: `# Basic VPC with public subnet and internet gateway
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "main" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "public" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "main" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}`,
  },
  {
    id: 'web-server',
    name: 'Web Server',
    description: 'EC2 instance with security group (requires Basic VPC)',
    hcl: `# Web server: EC2 + Security Group
# Add to a Basic VPC configuration

resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Allow HTTP, HTTPS, and SSH"
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

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["YOUR_IP/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "web-sg" }
}

resource "aws_instance" "web" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]
  tags = { Name = "web-server" }
}`,
  },
  {
    id: 'serverless-api',
    name: 'Serverless API',
    description: 'API Gateway + Lambda + DynamoDB',
    hcl: `# Serverless API: API Gateway + Lambda + DynamoDB

resource "aws_dynamodb_table" "main" {
  name         = "app-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = { Name = "app-data" }
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda-exec-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "api_handler" {
  function_name = "api-handler"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = "lambda.zip"

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.main.name
    }
  }
}

resource "aws_apigatewayv2_api" "main" {
  name          = "api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.api_handler.invoke_arn
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/\${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}`,
  },
  {
    id: 'static-site',
    name: 'Static Site',
    description: 'S3 bucket + CloudFront distribution',
    hcl: `# Static site: S3 + CloudFront

resource "aws_s3_bucket" "site" {
  bucket = "my-static-site-bucket"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}`,
  },
  {
    id: 'container-app',
    name: 'Container App',
    description: 'ECR repository + Lambda container image',
    hcl: `# Container app: ECR + Lambda (container image)

resource "aws_ecr_repository" "app" {
  name                 = "app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda-container-exec-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "app" {
  function_name = "app"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "\${aws_ecr_repository.app.repository_url}:latest"
  timeout       = 30
  memory_size   = 512
}`,
  },
]

interface TemplatesModalProps {
  onClose: () => void
}

export default function TemplatesModal({ onClose }: TemplatesModalProps): React.JSX.Element {
  const [selected, setSelected] = useState<string>(TEMPLATES[0].id)
  const [copied, setCopied]     = useState(false)

  const current = TEMPLATES.find((t) => t.id === selected) ?? TEMPLATES[0]

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(current.hcl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }
  const modal: React.CSSProperties = {
    background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
    borderRadius: 8, width: 760, height: 520, display: 'flex', flexDirection: 'column',
    fontFamily: 'monospace', color: 'var(--cb-text-primary)', overflow: 'hidden',
  }
  const header: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--cb-border-strong)',
    flexShrink: 0,
  }
  const body: React.CSSProperties = {
    display: 'flex', flex: 1, overflow: 'hidden',
  }
  const sidebar: React.CSSProperties = {
    width: 200, borderRight: '1px solid var(--cb-border)', padding: '8px 0',
    overflowY: 'auto', flexShrink: 0,
  }
  const preview: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  }
  const previewHeader: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', borderBottom: '1px solid var(--cb-border)', flexShrink: 0,
  }
  const code: React.CSSProperties = {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    fontSize: 11, lineHeight: 1.7, color: 'var(--cb-text-primary)',
    background: 'var(--cb-bg-elevated)', whiteSpace: 'pre', margin: 0,
    fontFamily: 'monospace',
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        <div style={header}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--cb-accent)' }}>
            Starter Templates
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cb-text-muted)', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={body}>
          <div style={sidebar}>
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelected(t.id)}
                style={{
                  padding: '8px 16px', cursor: 'pointer', fontSize: 11,
                  background: selected === t.id ? 'var(--cb-bg-elevated)' : 'transparent',
                  borderLeft: `2px solid ${selected === t.id ? 'var(--cb-accent)' : 'transparent'}`,
                  color: selected === t.id ? 'var(--cb-text-primary)' : 'var(--cb-text-secondary)',
                }}
              >
                <div style={{ fontWeight: selected === t.id ? 600 : 400 }}>{t.name}</div>
                <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                  {t.description}
                </div>
              </div>
            ))}
          </div>
          <div style={preview}>
            <div style={previewHeader}>
              <span style={{ fontSize: 11, color: 'var(--cb-text-secondary)' }}>
                {current.name} — main.tf
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: copied ? '#22c55e' : 'var(--cb-bg-elevated)',
                  border: `1px solid ${copied ? '#22c55e' : 'var(--cb-border)'}`,
                  borderRadius: 3, padding: '3px 12px', cursor: 'pointer',
                  color: copied ? '#000' : 'var(--cb-text-secondary)',
                  fontFamily: 'monospace', fontSize: 10, fontWeight: copied ? 'bold' : 'normal',
                  transition: 'all 0.15s',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre style={code}>{current.hcl}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
