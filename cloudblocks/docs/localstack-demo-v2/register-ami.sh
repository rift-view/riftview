#!/usr/bin/env bash
# Registers a dummy AMI in LocalStack and returns its ID as JSON for Terraform's
# data "external" source. Idempotent — reuses an existing AMI with the same name.
set -euo pipefail

ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
AMI_NAME="localstack-dummy-ami"

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

BASE=(aws --endpoint-url="$ENDPOINT" --region="$REGION" --output text)

# 1. Reuse existing AMI if already registered (idempotent re-applies)
EXISTING=$("${BASE[@]}" ec2 describe-images \
  --filters "Name=name,Values=$AMI_NAME" \
  --query 'Images[0].ImageId' 2>/dev/null || true)

if [[ -n "$EXISTING" && "$EXISTING" != "None" && "$EXISTING" != "null" ]]; then
  printf '{"ami_id":"%s"}' "$EXISTING"
  exit 0
fi

# 2. Register — LocalStack requires: name, description, root-device-name,
#    virtualization-type, architecture, and block-device-mappings (JSON format).
AMI_ID=$("${BASE[@]}" ec2 register-image \
  --name "$AMI_NAME" \
  --description "Dummy AMI for LocalStack testing" \
  --root-device-name /dev/sda1 \
  --virtualization-type hvm \
  --architecture x86_64 \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":8,"VolumeType":"gp2","DeleteOnTermination":true}}]' \
  --query 'ImageId' 2>&1) || true

if [[ -z "$AMI_ID" || "$AMI_ID" == "None" || "$AMI_ID" == "null" || "$AMI_ID" == *"error"* || "$AMI_ID" == *"Error"* ]]; then
  echo "register-image failed: $AMI_ID" >&2
  exit 1
fi

printf '{"ami_id":"%s"}' "$AMI_ID"
