import json
import os
import time
import random
import string
import boto3

# LocalStack sets AWS_ENDPOINT_URL automatically for Lambda functions (v2.x+).
# Fallback covers older LocalStack versions.
_endpoint = os.environ.get('AWS_ENDPOINT_URL', 'http://localhost.localstack.cloud:4566')
_region   = os.environ.get('AWS_REGION', 'us-east-1')

dynamo = boto3.resource('dynamodb', region_name=_region, endpoint_url=_endpoint)
table  = dynamo.Table(os.environ['TABLE_NAME'])


def _id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))


def _ok(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps(body),
    }


def handler(event, _ctx):
    ctx   = event.get('requestContext', {}).get('http', {})
    method = ctx.get('method', 'GET')
    path   = event.get('rawPath', '/')
    params = event.get('pathParameters') or {}

    # CORS pre-flight
    if method == 'OPTIONS':
        return _ok(200, {})

    # GET /items — list all
    if method == 'GET' and path.rstrip('/').endswith('/items'):
        result = table.scan()
        items  = sorted(result.get('Items', []), key=lambda x: x.get('ts', '0'), reverse=True)
        return _ok(200, {'items': items, 'count': len(items)})

    # POST /items — create
    if method == 'POST' and path.rstrip('/').endswith('/items'):
        body = json.loads(event.get('body') or '{}')
        item = {
            'id':   _id(),
            'name': (body.get('name') or 'Untitled').strip()[:120],
            'note': (body.get('note') or '').strip()[:300],
            'ts':   str(int(time.time() * 1000)),
        }
        table.put_item(Item=item)
        return _ok(201, {'item': item})

    # DELETE /items/{id} — remove one
    if method == 'DELETE':
        item_id = params.get('id') or path.rstrip('/').split('/')[-1]
        if item_id:
            table.delete_item(Key={'id': item_id})
        return _ok(200, {'deleted': item_id})

    return _ok(404, {'error': f'No route for {method} {path}'})
