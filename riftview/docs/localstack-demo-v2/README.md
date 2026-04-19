# RiftView LocalStack Demo v2

A comprehensive Terraform fixture that creates a realistic "static website with API" architecture in LocalStack. Exercises every service type RiftView can visualise, intentionally misconfigures several resources to trigger advisory rules, and wires up integration edges between services.

---

## Prerequisites

1. **LocalStack** running locally:
   ```sh
   pip install localstack
   localstack start
   # or via Docker:
   docker run --rm -it -p 4566:4566 localstack/localstack
   ```

2. **tflocal** (Terraform wrapper that auto-configures LocalStack endpoints):
   ```sh
   pip install terraform-local
   ```

3. **Terraform** >= 1.5:
   ```sh
   brew install terraform
   ```

4. **local provider** — the `hashicorp/local` provider is used to write Lambda source inline. It is fetched automatically on `tflocal init`.

---

## Run

```sh
cd docs/localstack-demo-v2

# Initialise providers
tflocal init

# Preview changes
tflocal plan

# Apply (takes ~60s on first run)
tflocal apply

# Tear down when done
tflocal destroy
```

The apply outputs the API Gateway invoke URL:

```
api_url = "http://localhost:4566/_aws/execute-api/<id>/$default"
```

You can smoke-test it:

```sh
API=$(tflocal output -raw api_url)
curl "$API/items"                          # GET — returns empty list
curl -X POST "$API/items" -d '{"name":"test"}' -H 'Content-Type: application/json'
curl "$API/items"                          # GET — shows new item
```

---

## Connect RiftView

1. Open RiftView → **Settings** (gear icon) → **Add Profile**
2. Fill in:
   | Field    | Value                    |
   |----------|--------------------------|
   | Name     | LocalStack Demo v2       |
   | Endpoint | `http://localhost:4566`  |
   | Region   | `us-east-1`              |
   | Key      | `test`                   |
   | Secret   | `test`                   |
3. Click **Save** then **Scan**

---

## What to expect in RiftView

After a successful scan you should see nodes for all of the following services:

| Service | Node(s) |
|---------|---------|
| VPC | `demo-vpc` |
| Subnet | `demo-public-subnet`, `demo-private-subnet` |
| IGW | `demo-igw` |
| Security Group | `demo-bastion-sg`, `demo-app-sg` |
| EC2 | `demo-bastion` (inside public subnet) |
| S3 | `demo-static-assets-riftview`, `demo-artifacts-riftview` |
| DynamoDB | `demo-items`, `demo-sessions` |
| Lambda | `demo-api-handler`, `demo-workflow-processor`, `demo-timeout-test` |
| SQS | `demo-workflow-dlq`, `demo-workflow-queue`, `demo-notifications` |
| SNS | `demo-alerts`, `demo-events` |
| API Gateway | `demo-api` |
| API Gateway Routes | `GET /items`, `POST /items`, `DELETE /items/{id}`, `GET /health` |
| ACM | `demo.riftview.local` certificate |
| CloudFront | `demo-distribution` |
| Route 53 | `riftview.local` hosted zone |
| EventBridge | `demo-events-bus` |
| Step Functions | `demo-order-workflow` |
| Secrets Manager | `demo/api-key`, `demo/db-credentials` |
| SSM Parameter | `/demo/app/config`, `/demo/app/api-endpoint`, `/demo/db/host` |
| Cognito | `demo-user-pool` |
| SES | `riftview.local` domain identity, `notifications@riftview.local` email identity |

---

## Integration edges you should see

These are rendered as arrows between nodes on the canvas:

| From | To | Edge type |
|------|----|-----------|
| SNS `demo-alerts` | SQS `demo-notifications` | subscription |
| SNS `demo-events` | SQS `demo-workflow-queue` | subscription |
| SQS `demo-workflow-queue` | Lambda `demo-workflow-processor` | trigger (event source mapping) |
| Lambda `demo-api-handler` | DynamoDB `demo-items` | trigger (env var ARN) |
| Lambda `demo-api-handler` | SNS `demo-alerts` | trigger (env var ARN) |
| Lambda `demo-workflow-processor` | DynamoDB `demo-items` | trigger (env var ARN) |
| Lambda `demo-workflow-processor` | EventBridge `demo-events-bus` | trigger (env var ARN) |
| EventBridge `demo-events-bus` | Lambda `demo-workflow-processor` | trigger (rule target) |
| EventBridge `demo-events-bus` | SQS `demo-workflow-queue` | trigger (rule target) |
| SFN `demo-order-workflow` | Lambda `demo-api-handler` | trigger (definition) |
| SFN `demo-order-workflow` | DynamoDB `demo-items` | trigger (definition) |
| SFN `demo-order-workflow` | SNS `demo-alerts` | trigger (definition) |

---

## Advisory badges

The following advisory badges should appear on nodes. Use the **Fix** button in the Inspector to test the guided remediation flow.

### Critical

| Node | Advisory | What triggers it |
|------|----------|-----------------|
| `demo-bastion` (EC2) | `ec2-public-ssh` | Security group `demo-bastion-sg` has port 22 open to `0.0.0.0/0` |
| `demo-static-assets-riftview` (S3) | `s3-public-access` | No `aws_s3_bucket_public_access_block` resource — `publicAccessEnabled=true` |
| `demo-api-handler` (Lambda) | — | (timeout is set, so `lambda-no-timeout` does NOT fire here) |
| `demo-timeout-test` (Lambda) | `lambda-no-timeout` | No `timeout` attribute set — note: LocalStack returns the AWS default (3s) so this advisory fires only if LocalStack omits the Timeout field or returns 0 |

### Warning

| Node | Advisory | What triggers it |
|------|----------|-----------------|
| `demo-static-assets-riftview` (S3) | `s3-no-versioning` | No `aws_s3_bucket_versioning` resource — `versioningEnabled=false` |
| `demo-notifications` (SQS) | `sqs-no-dlq` | No `redrive_policy` on the queue |
| `demo-api-handler` (Lambda) | `lambda-low-memory` | `memory_size = 128` (default) |
| `demo-api-handler` (Lambda) | `lambda-no-dlq` | No `dead_letter_config` block |
| `demo-timeout-test` (Lambda) | `lambda-low-memory` | No `memory_size` set — defaults to 128 |
| `demo-timeout-test` (Lambda) | `lambda-no-dlq` | No `dead_letter_config` block |

### No advisories (correctly configured)

| Node | Reason |
|------|--------|
| `demo-artifacts-riftview` (S3) | Public access blocked + versioning enabled |
| `demo-workflow-processor` (Lambda) | timeout=30, memory=512, has DLQ |
| `demo-workflow-queue` (SQS) | Has redrive policy pointing to `demo-workflow-dlq` |
| `demo/api-key`, `demo/db-credentials` (Secrets) | No rule targets secrets currently |

---

## Architecture diagram

```
Internet
  ├── CloudFront ──► S3 demo-static-assets     [⚠ s3-public-access, s3-no-versioning]
  │      └──────────► API Gateway demo-api
  │                        └──► Lambda demo-api-handler  [⚠ lambda-low-memory, lambda-no-dlq]
  │                                  ├──► DynamoDB demo-items
  │                                  └──► SNS demo-alerts
  │                                              └──► SQS demo-notifications  [⚠ sqs-no-dlq]
  └── Cognito demo-user-pool

SNS demo-events ──► SQS demo-workflow-queue ──► Lambda demo-workflow-processor
                                                       └──► DynamoDB demo-items

EventBridge demo-events-bus ──► Lambda demo-workflow-processor
                            └──► SQS demo-workflow-queue

SFN demo-order-workflow ──► Lambda demo-api-handler
                        ├──► DynamoDB demo-items
                        └──► SNS demo-alerts

Lambda demo-timeout-test  [⚠ lambda-no-timeout, lambda-low-memory, lambda-no-dlq]

VPC demo-vpc
  ├── Subnet public ──► EC2 demo-bastion  [⚠ ec2-public-ssh]
  │                         IGW demo-igw
  └── Subnet private

Supporting:
  Secrets: demo/api-key, demo/db-credentials
  SSM: /demo/app/config, /demo/app/api-endpoint, /demo/db/host
  ACM: demo.riftview.local
  Route53: riftview.local
  SES: riftview.local, notifications@riftview.local
```
