import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "yap-to-tale-records")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

def create_table_if_not_exists():
    dynamodb = boto3.client('dynamodb', region_name=AWS_REGION)
    
    print(f"Checking if table '{DYNAMODB_TABLE_NAME}' exists...")
    try:
        dynamodb.describe_table(TableName=DYNAMODB_TABLE_NAME)
        print(f"✅ Table '{DYNAMODB_TABLE_NAME}' already exists.")
        return
    except ClientError as e:
        if e.response['Error']['Code'] != 'ResourceNotFoundException':
            print(f"❌ Error describing table: {e}")
            return
            
    print(f"Table not found. Creating '{DYNAMODB_TABLE_NAME}' with GSI 'PublicRecentIndex'...")
    try:
        response = dynamodb.create_table(
            TableName=DYNAMODB_TABLE_NAME,
            KeySchema=[
                {'AttributeName': 'id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'id', 'AttributeType': 'S'},
                {'AttributeName': 'status', 'AttributeType': 'S'},
                {'AttributeName': 'created_at', 'AttributeType': 'N'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'PublicRecentIndex',
                    'KeySchema': [
                        {'AttributeName': 'status', 'KeyType': 'HASH'},
                        {'AttributeName': 'created_at', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {
                        'ProjectionType': 'ALL'
                    },
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print(f"⏳ Creating table (this takes a minute)...")
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(TableName=DYNAMODB_TABLE_NAME)
        print(f"✅ Table '{DYNAMODB_TABLE_NAME}' created successfully with PublicRecentIndex!")
    except Exception as e:
        print(f"❌ Error creating table: {e}")

if __name__ == "__main__":
    create_table_if_not_exists()
