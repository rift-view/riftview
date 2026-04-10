import json

def handler(event, _ctx):
    return {'statusCode': 200, 'body': json.dumps({'ok': True})}
