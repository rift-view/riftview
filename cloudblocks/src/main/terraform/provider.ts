export function buildLocalStackProvider(region: string, endpoint = 'http://localhost:4566'): string {
  return `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "${region}"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigatewayv2   = "${endpoint}"
    dynamodb       = "${endpoint}"
    ec2            = "${endpoint}"
    iam            = "${endpoint}"
    lambda         = "${endpoint}"
    s3             = "${endpoint}"
    secretsmanager = "${endpoint}"
    sns            = "${endpoint}"
    sqs            = "${endpoint}"
    sts            = "${endpoint}"
  }
}

`
}
