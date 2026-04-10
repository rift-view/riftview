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
