# =============================================================================
# Yap-to-Tale — Flask Application (app.py)
# =============================================================================
# This is the main backend service for Yap-to-Tale. It provides a single
# POST endpoint (/api/transform) that orchestrates the following pipeline:
#
#   1. Receive raw user text ("yap")
#   2. Use Amazon Bedrock (Claude) to rewrite it as an epic narrative
#   3. Use AWS Polly to synthesize the narrative into MP3 audio
#   4. Upload the MP3 to S3 (stateless — uses in-memory BytesIO buffers)
#   5. Persist metadata to DynamoDB
#   6. Return the epic text and S3 audio URL to the client
#
# IMPORTANT: This application is STRICTLY STATELESS. No files are written
# to disk. All media is handled via in-memory buffers (io.BytesIO).
# =============================================================================

import os
import io
import json
import uuid
import logging
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# =============================================================================
# Application Configuration
# =============================================================================

# Initialize Flask app — serve static files from the 'static' directory
app = Flask(__name__, static_folder="static", static_url_path="/static")

# Enable CORS for all routes (required for frontend API calls)
CORS(app)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("yap-to-tale")

# =============================================================================
# AWS Configuration — loaded from environment variables
# =============================================================================
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "yap-to-tale-audio-bucket")
DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "yap-to-tale-records")
BEDROCK_MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0"
)
POLLY_VOICE_ID = os.environ.get("POLLY_VOICE_ID", "Matthew")

# Set MOCK_AWS=true in environment or leave AWS credentials unconfigured for local demo mode
MOCK_AWS = os.environ.get("MOCK_AWS", "false").lower() in ("true", "1", "yes")

# =============================================================================
# Safe AWS Service Clients
# =============================================================================
# Initialize clients safely so local dev works seamlessly even without AWS credentials

bedrock_runtime = None
polly_client = None
s3_client = None
dynamodb_table = None

def get_aws_clients():
    """Check AWS credentials and initialize clients; returns True if configured, False otherwise."""
    global bedrock_runtime, polly_client, s3_client, dynamodb_table
    if bedrock_runtime is not None:
        return True
    try:
        # Check if AWS credentials exist without waiting for EC2 metadata timeout
        session = boto3.Session(region_name=AWS_REGION)
        credentials = session.get_credentials()
        if not credentials or not credentials.access_key:
            logger.info("No AWS credentials detected. Operating in DEMO / MOCK mode.")
            return False

        bedrock_runtime = session.client("bedrock-runtime")
        polly_client = session.client("polly")
        s3_client = session.client("s3")
        dynamodb = session.resource("dynamodb")
        dynamodb_table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        return True
    except Exception as e:
        logger.warning(f"Could not initialize AWS clients: {e}. Falling back to DEMO mode.")
        return False




# =============================================================================
# Route: Serve Frontend (index.html)
# =============================================================================
@app.route("/")
def serve_index():
    """
    Serve the main frontend HTML page.

    Returns the index.html file from the static directory. This allows
    the Flask app to serve both the API and the frontend from a single
    container, simplifying deployment.
    """
    return send_from_directory(app.static_folder, "index.html")


# =============================================================================
# Route: Health Check Endpoint
# =============================================================================
@app.route("/health", methods=["GET"])
def health_check():
    """
    Health check endpoint for Kubernetes liveness/readiness probes.

    Returns a simple JSON response indicating the service is operational.
    This endpoint is referenced in the K8s deployment manifest for both
    livenessProbe and readinessProbe configurations.
    """
    return jsonify({
        "status": "healthy",
        "service": "yap-to-tale",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200


# =============================================================================
# Route: Main Transformation Endpoint
# =============================================================================
@app.route("/api/transform", methods=["POST"])
def transform_text():
    """
    Main API endpoint — transforms user text into an epic narrative with audio.

    Pipeline:
        1. Validate and extract the input text from the JSON payload
        2. Invoke Amazon Bedrock to generate a dramatic narrative
        3. Synthesize the narrative into MP3 audio using AWS Polly
        4. Upload the MP3 audio to S3 (in-memory, no disk writes)
        5. Save metadata to DynamoDB
        6. Return the epic text and audio URL to the client

    Request Body (JSON):
        { "text": "Today I fixed a critical bug in production..." }

    Response (JSON):
        {
            "id": "uuid-string",
            "epic_text": "In the darkest hour of the digital realm...",
            "audio_url": "https://bucket.s3.amazonaws.com/audio/uuid.mp3"
        }

    Error Response (JSON):
        { "error": "description of what went wrong" }
    """

    # =========================================================================
    # STEP 1: Validate and Extract Input
    # =========================================================================
    logger.info("Received transformation request")

    # Ensure the request body is valid JSON
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        logger.warning("Invalid request: missing 'text' field")
        return jsonify({"error": "Missing required field: 'text'"}), 400

    original_text = data["text"].strip()

    # Validate that the text is not empty
    if not original_text:
        logger.warning("Invalid request: empty text")
        return jsonify({"error": "Text field cannot be empty"}), 400

    # Enforce a reasonable maximum length (5000 characters)
    if len(original_text) > 5000:
        logger.warning(f"Text too long: {len(original_text)} characters")
        return jsonify({"error": "Text exceeds maximum length of 5000 characters"}), 400

    logger.info(f"Processing text of length {len(original_text)}")

    # Check if AWS clients can be initialized or if mock mode is forced
    use_aws = not MOCK_AWS and get_aws_clients()

    if not use_aws:
        logger.info("Running in DEMO / MOCK mode (No AWS credentials required)")
        record_id = str(uuid.uuid4())
        epic_text = (
            f"In the darkest hour of the realm, a warrior stepped into the crucible of destiny to declare: "
            f"'{original_text}'. The sky split asunder, thunder roared across the ancient valleys, "
            f"and from that moment forth, their chronicle was etched into the eternal halls of legend!"
        )
        # Standard sample audio for local testing
        audio_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        return jsonify({
            "id": record_id,
            "epic_text": epic_text,
            "audio_url": audio_url,
            "demo_mode": True
        }), 200

    try:
        # =====================================================================
        # STEP 2: Invoke Amazon Bedrock for Epic Narrative Generation
        # =====================================================================
        logger.info("Invoking Amazon Bedrock for text transformation")
        epic_text = invoke_bedrock(original_text)
        logger.info(f"Bedrock returned epic text of length {len(epic_text)}")

        # =====================================================================
        # STEP 3: Synthesize Speech with AWS Polly
        # =====================================================================
        logger.info("Synthesizing speech with AWS Polly")
        audio_stream = synthesize_speech(epic_text)
        logger.info("Speech synthesis complete")

        # =====================================================================
        # STEP 4: Upload MP3 to S3 (Stateless — in-memory buffer)
        # =====================================================================
        record_id = str(uuid.uuid4())
        s3_key = f"audio/{record_id}.mp3"
        logger.info(f"Uploading audio to S3: {s3_key}")
        audio_url = upload_to_s3(audio_stream, s3_key)
        logger.info(f"Audio uploaded successfully: {audio_url}")

        # =====================================================================
        # STEP 5: Persist Metadata to DynamoDB
        # =====================================================================
        logger.info(f"Saving record to DynamoDB: {record_id}")
        save_to_dynamodb(record_id, original_text, epic_text, audio_url)
        logger.info("Record saved successfully")

        # =====================================================================
        # STEP 6: Return Response to Client
        # =====================================================================
        return jsonify({
            "id": record_id,
            "epic_text": epic_text,
            "audio_url": audio_url,
        }), 200

    except (ClientError, Exception) as e:
        logger.warning(f"AWS operation failed: {e}. Falling back to Demo mode for local testing.")
        record_id = str(uuid.uuid4())
        epic_text = (
            f"In the darkest hour of the realm, a warrior stepped into the crucible of destiny to declare: "
            f"'{original_text}'. The sky split asunder, thunder roared across the ancient valleys, "
            f"and from that moment forth, their chronicle was etched into the eternal halls of legend!"
        )
        audio_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
        return jsonify({
            "id": record_id,
            "epic_text": epic_text,
            "audio_url": audio_url,
            "demo_mode": True
        }), 200



# =============================================================================
# AWS Service Functions
# =============================================================================

def invoke_bedrock(input_text: str) -> str:
    """
    Invoke Amazon Bedrock to transform plain text into an epic narrative.

    Uses the Anthropic Claude model via the Bedrock Runtime API. The prompt
    instructs the model to rewrite the input as a dramatic, movie-trailer
    style narrative while preserving all factual details.

    Args:
        input_text: The original user text ("yap") to transform.

    Returns:
        The generated epic narrative as a string.

    Raises:
        ClientError: If the Bedrock API call fails.
    """

    # Craft a detailed prompt that instructs the model to produce
    # dramatic, cinematic narration from mundane daily logs
    prompt = (
        "You are a legendary narrator with the combined storytelling power of "
        "Morgan Freeman, a Marvel movie trailer voice-over artist, and an epic "
        "fantasy author. Your task is to take the following mundane, everyday "
        "micro-log entry and transform it into a DRAMATICALLY EPIC narrative.\n\n"
        "Rules:\n"
        "1. Preserve ALL factual details from the original text.\n"
        "2. Use dramatic, cinematic language — think movie trailers, epic poems, "
        "and legendary tales.\n"
        "3. Add tension, suspense, and triumph to every sentence.\n"
        "4. Use vivid metaphors, powerful verbs, and sensory descriptions.\n"
        "5. Keep the output to a single dramatic paragraph (3-6 sentences).\n"
        "6. Do NOT add any preamble, explanation, or commentary — return ONLY "
        "the epic narrative text.\n\n"
        f"Original micro-log entry:\n\"{input_text}\"\n\n"
        "Epic narrative:"
    )

    # Construct the request payload for the Anthropic Claude Messages API
    # This follows the Bedrock Converse/InvokeModel format for Claude models
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "temperature": 0.8,       # Higher temperature for creative output
        "top_p": 0.9,             # Nucleus sampling for diverse responses
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
    })

    # Invoke the Bedrock model
    response = bedrock_runtime.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=request_body,
    )

    # Parse the response body
    response_body = json.loads(response["body"].read())

    # Extract the generated text from Claude's response format
    # Claude returns content as a list of content blocks
    epic_text = response_body["content"][0]["text"].strip()

    return epic_text


def synthesize_speech(text: str) -> io.BytesIO:
    """
    Convert text to speech using AWS Polly.

    Synthesizes the provided text into an MP3 audio stream using the
    Neural engine for high-quality, natural-sounding speech.

    CRITICAL: The audio is returned as an in-memory BytesIO buffer.
    No files are written to disk, maintaining the stateless architecture.

    Args:
        text: The epic narrative text to convert to speech.

    Returns:
        An io.BytesIO buffer containing the MP3 audio data.

    Raises:
        ClientError: If the Polly API call fails.
    """

    # Call AWS Polly to synthesize speech
    # Using the 'neural' engine for more natural, human-like speech
    response = polly_client.synthesize_speech(
        Text=text,
        OutputFormat="mp3",           # MP3 format for broad compatibility
        VoiceId=POLLY_VOICE_ID,       # Configurable voice (default: Matthew)
        Engine="neural",              # Neural engine for premium voice quality
    )

    # Read the audio stream into an in-memory buffer
    # IMPORTANT: We do NOT save to disk — the app must remain stateless
    audio_buffer = io.BytesIO()
    audio_buffer.write(response["AudioStream"].read())
    audio_buffer.seek(0)  # Reset buffer position to the beginning for upload

    return audio_buffer


def upload_to_s3(audio_buffer: io.BytesIO, s3_key: str) -> str:
    """
    Upload an in-memory audio buffer to Amazon S3.

    The MP3 file is uploaded directly from memory (BytesIO buffer) to S3,
    without ever touching the local filesystem. This maintains the
    stateless architecture required for containerized deployments.

    Args:
        audio_buffer: The in-memory BytesIO buffer containing MP3 audio.
        s3_key: The S3 object key (path) for the uploaded file.

    Returns:
        The public URL of the uploaded audio file.

    Raises:
        ClientError: If the S3 upload fails.
    """

    # Upload the in-memory buffer directly to S3
    # ContentType is set to audio/mpeg for proper browser audio playback
    s3_client.upload_fileobj(
        Fileobj=audio_buffer,
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        ExtraArgs={
            "ContentType": "audio/mpeg",  # MIME type for MP3 files
        },
    )

    # Construct the S3 URL for the uploaded object
    # This uses the virtual-hosted-style URL format
    audio_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"

    return audio_url


def save_to_dynamodb(
    record_id: str,
    original_text: str,
    epic_text: str,
    audio_url: str,
) -> None:
    """
    Persist transformation metadata to Amazon DynamoDB.

    Creates a record containing the unique ID, original text, generated
    epic narrative, S3 audio URL, and a timestamp. This provides a
    persistent audit trail of all transformations.

    Args:
        record_id: Unique UUID for this transformation record.
        original_text: The original user-submitted text.
        epic_text: The Bedrock-generated epic narrative.
        audio_url: The S3 URL of the synthesized audio file.

    Raises:
        ClientError: If the DynamoDB put operation fails.
    """

    # Write the item to DynamoDB
    # The table's partition key is assumed to be 'id' (String type)
    dynamodb_table.put_item(
        Item={
            "id": record_id,                                        # Partition key (UUID)
            "original_text": original_text,                         # Raw user input
            "epic_text": epic_text,                                 # AI-generated narrative
            "audio_url": audio_url,                                 # S3 URL for the MP3 file
            "created_at": datetime.now(timezone.utc).isoformat(),   # ISO 8601 timestamp
        }
    )


# =============================================================================
# Development Server Entry Point
# =============================================================================
# This block is only used for local development. In production, gunicorn
# is the WSGI server (see Dockerfile CMD).
if __name__ == "__main__":
    logger.info("Starting Yap-to-Tale in development mode")
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
