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
