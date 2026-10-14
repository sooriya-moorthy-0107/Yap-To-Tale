# =============================================================================
# Yap-to-Tale — Flask Application (app.py)
# Reddit-Style Anonymous Audio Social Platform Architecture
# =============================================================================
# Core Operational Pillars:
#   1. Two-Column Dashboard Layout (Creation Suite & Recent "My Yaps" Panel)
#   2. Dedicated Public Anonymous Social Feed & Community Discussion Threads
#   3. Direct Amazon S3 Bucket Audio Retrieval Engine with Range Streaming
#   4. Anonymous Handle Management & Dual-Indexed DynamoDB Publishing Logic
#
# IMPORTANT: STRICTLY STATELESS. Audio generation uses in-memory BytesIO buffers.
# Media is synchronized with Amazon S3 and persisted with metadata in DynamoDB.
# =============================================================================

import os
import io
import json
import uuid
import random
import logging
import random
import time
from datetime import datetime, timezone
from decimal import Decimal

from dotenv import load_dotenv
load_dotenv()

import boto3
from botocore.exceptions import ClientError
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context, redirect
from flask_cors import CORS

# =============================================================================
# Application Configuration
# =============================================================================

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

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
    "BEDROCK_MODEL_ID", "us.anthropic.claude-3-sonnet-20240229-v1:0"
)
POLLY_VOICE_ID = os.environ.get("POLLY_VOICE_ID", "Matthew")

# Set MOCK_AWS=true in environment or leave AWS credentials unconfigured for local demo mode
MOCK_AWS = os.environ.get("MOCK_AWS", "false").lower() in ("true", "1", "yes")

# Supported story genres
STORY_GENRES = frozenset({
    "fantasy",
    "horror",
    "science-fiction",
    "romance",
    "mystery",
    "thriller",
    "comedy",
    "epic",
})

# Curated Anonymous Handles
ANONYMOUS_HANDLES = [
    "Girly", "Baddie", "007Bond", "NeonViper", "CyberWizard",
    "PixelBard", "ShadowWalker", "EchoQueen", "NightOwl", "RogueScholar",
    "StarlightYap", "MidnightPoet", "TechnoMage", "ChaosGremlin", "VibeMaster"
]

def get_audio_assets(story_genre: str | None) -> dict:
    """Returns background music and SFX URLs for a given genre."""
    genre = story_genre or "epic"
    assets = {
        "fantasy": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/magic/magical_ping.ogg"
        },
        "horror": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/horror/monster_zombie_growl.ogg"
        },
        "science-fiction": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/science_fiction/sci_fi_door_open.ogg"
        },
        "romance": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/instruments/harp_strum.ogg"
        },
        "mystery": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/horror/creepy_wind.ogg"
        },
        "thriller": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/alarms/beeps_and_flashes.ogg"
        },
        "comedy": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg"
        },
        "epic": {
            "bg_music_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "sfx_url": "https://actions.google.com/sounds/v1/weapons/large_explosion.ogg"
        }
    }
    return assets.get(genre, assets["epic"])

def decimal_to_native(obj):
    """Recursively converts DynamoDB Decimal objects to standard Python ints or floats."""
    if isinstance(obj, list):
        return [decimal_to_native(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

def get_default_anonymous_handle(seed: str | None = None) -> str:
    """Returns a deterministic or random anonymous handle."""
    if seed:
        idx = hash(seed) % len(ANONYMOUS_HANDLES)
        return ANONYMOUS_HANDLES[idx]
    return random.choice(ANONYMOUS_HANDLES)

# =============================================================================
# In-Memory Cache & Fallback Store
# =============================================================================
AUDIO_CACHE = {}
MOCK_POSTS = []

# =============================================================================
# AWS Service Clients Initialization
# =============================================================================
bedrock_runtime = None
polly_client = None
s3_client = None
dynamodb_table = None

def get_aws_clients():
    """Initializes AWS clients; returns True if configured, False otherwise."""
    global bedrock_runtime, polly_client, s3_client, dynamodb_table
    if bedrock_runtime is not None and s3_client is not None and dynamodb_table is not None:
        return True
    try:
        session = boto3.Session(
            region_name=AWS_REGION,
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        )
        credentials = session.get_credentials()
        if not credentials or not credentials.access_key:
            logger.info("No AWS credentials detected. Operating in DEMO / MOCK mode.")
            return False

        bedrock_runtime = session.client("bedrock-runtime")
        polly_client = session.client("polly")
        s3_client = session.client("s3")
        dynamodb = session.resource("dynamodb")
        dynamodb_table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        logger.info(f"Connected to AWS services in {AWS_REGION}. S3: {S3_BUCKET_NAME}, DynamoDB: {DYNAMODB_TABLE_NAME}")
        return True
    except Exception as e:
        logger.warning(f"Could not initialize AWS clients: {e}. Falling back to DEMO mode.")
        return False

# =============================================================================
# Production Security & Performance Middleware
# =============================================================================

@app.before_request
def enforce_https():
    """Enforce HTTPS sitewide in production behind reverse proxies and load balancers."""
    if os.environ.get("FLASK_ENV") == "production" or os.environ.get("ENFORCE_HTTPS", "false").lower() == "true":
        proto = request.headers.get("X-Forwarded-Proto")
        if proto == "http":
            url = request.url.replace("http://", "https://", 1)
            return redirect(url, code=301)

@app.after_request
def apply_security_and_cache_headers(response):
    """Enforce HSTS, modern browser security headers, and asset caching."""
    # Strict-Transport-Security (HSTS)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    # Cross-site scripting filter
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Static asset caching
    if request.path.startswith("/static/"):
        if any(request.path.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".ico", ".svg", ".webp", ".mp3", ".ogg"]):
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        elif any(request.path.endswith(ext) for ext in [".css", ".js"]):
            response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=600"

    return response

# =============================================================================
# Route: Serve Frontend (index.html), Favicon & Health Checks
# =============================================================================
@app.route("/")
def serve_index():
    """Serve the main frontend single-page application."""
    return send_from_directory(app.static_folder, "index.html")

@app.route("/favicon.ico")
def serve_favicon():
    """Serve the application favicon with long-term cache headers."""
    return send_from_directory(app.static_folder, "favicon.ico", mimetype="image/vnd.microsoft.icon")

@app.route("/health", methods=["GET"])
def health_check():
    """Kubernetes / Docker health check probe endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "yap-to-tale",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200

# =============================================================================
# Pillar 3: Direct Amazon S3 Bucket Audio Retrieval Engine
# =============================================================================
@app.route("/api/audio/<audio_id>", methods=["GET"])
def stream_audio(audio_id):
    """
    Direct Amazon S3 Media Streaming Engine.
    Streams MP3 audio directly from the designated Amazon S3 bucket,
    supporting HTTP Range requests (RFC 7233) for seeking and responsive streaming.
    Falls back to in-memory cache or demo audio if S3 is unavailable.
    """
    clean_id = audio_id.removesuffix(".mp3")
    s3_key = f"audio/{clean_id}.mp3"

    # 1. Direct stream from designated Amazon S3 storage bucket
    if not MOCK_AWS and get_aws_clients() and s3_client is not None:
        try:
            range_header = request.headers.get("Range")
            s3_params = {"Bucket": S3_BUCKET_NAME, "Key": s3_key}
            if range_header:
                s3_params["Range"] = range_header

            s3_obj = s3_client.get_object(**s3_params)
            body = s3_obj["Body"]
            content_length = s3_obj.get("ContentLength")
            status_code = s3_obj.get("ResponseMetadata", {}).get("HTTPStatusCode", 200)

            response = Response(
                stream_with_context(body.iter_chunks(chunk_size=65536)),
                status=status_code,
                mimetype="audio/mpeg",
            )
            response.headers["Accept-Ranges"] = "bytes"
            if "ContentRange" in s3_obj:
                response.headers["Content-Range"] = s3_obj["ContentRange"]
            if content_length:
                response.headers["Content-Length"] = str(content_length)
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"
            return response
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            logger.info(f"S3 get_object note ({error_code}) for {s3_key}")
        except Exception as e:
            logger.warning(f"S3 direct streaming error for {s3_key}: {e}")

    # 2. Check in-memory AUDIO_CACHE
    if clean_id in AUDIO_CACHE:
        data = AUDIO_CACHE[clean_id]
        return Response(
            data,
            mimetype="audio/mpeg",
            headers={"Content-Length": str(len(data)), "Accept-Ranges": "bytes"}
        )

    # 3. Fallback demo sound if neither exists
    sample_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    import urllib.request
    try:
        req = urllib.request.Request(sample_url, headers={"User-Agent": "Yap-To-Tale"})
        with urllib.request.urlopen(req) as stream:
            return Response(stream.read(), mimetype="audio/mpeg")
    except Exception:
        return jsonify({"error": "Audio not found"}), 404

@app.route("/api/posts/<post_id>/audio-url", methods=["GET"])
def get_post_audio_url(post_id):
    """
    Returns a fresh presigned S3 media URL and the direct streaming endpoint
    to guarantee reliable cross-tab audio streaming.
    """
    clean_id = post_id.removesuffix(".mp3")
    s3_key = f"audio/{clean_id}.mp3"
    presigned_url = None

    if not MOCK_AWS and get_aws_clients() and s3_client is not None:
        try:
            presigned_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET_NAME, "Key": s3_key},
                ExpiresIn=604800  # 7 days
            )
        except Exception as e:
            logger.warning(f"Presigned URL generation failed: {e}")

    stream_url = f"/api/audio/{clean_id}"
    return jsonify({
        "post_id": clean_id,
        "audio_url": presigned_url or stream_url,
        "stream_url": stream_url,
    }), 200

# =============================================================================
# Pillar 4: Anonymous Handle Management & Self-Publishing Dual Indexing
# =============================================================================
@app.route("/api/identity/random-handle", methods=["GET"])
def get_random_handle():
    """Generates a random catchy anonymous handle."""
    return jsonify({
        "handle": random.choice(ANONYMOUS_HANDLES),
        "suggested_handles": ANONYMOUS_HANDLES,
    }), 200

# =============================================================================
# Pillar 1 & 4: Story Transformation & Dual Indexing Endpoint
# =============================================================================
@app.route("/api/transform", methods=["POST"])
def transform_text():
    """
    Main Story Generation Endpoint.
    Transforms raw "yap" into an epic audio tale via Bedrock & Polly.
    Stores audio directly in Amazon S3 and dual-indexes into DynamoDB:
      - Creator's private history ("My Yaps" via session_id / handle)
      - Global Reddit-style anonymous social feed (via is_public flag)
    """
    logger.info("Received transformation request")
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        logger.warning("Invalid request: missing 'text' field")
        return jsonify({"error": "Missing required field: 'text'"}), 400

    original_text = data["text"].strip()
    if not original_text:
        return jsonify({"error": "Text field cannot be empty"}), 400
    if len(original_text) > 5000:
        return jsonify({"error": "Text exceeds maximum length of 5000 characters"}), 400

    raw_genre = data.get("genre")
    story_genre = None
    if raw_genre:
        story_genre = str(raw_genre).strip().lower()
        if story_genre == "epic":
            story_genre = None
        elif story_genre not in STORY_GENRES:
            story_genre = "epic"

    voice_preference = str(data.get("voice") or POLLY_VOICE_ID)
    handle = (str(data.get("handle") or "")).strip() or get_default_anonymous_handle()
    session_id = str(data.get("session_id") or "").strip()
    is_public = bool(data.get("is_public", True))

    record_id = str(uuid.uuid4())
    s3_key = f"audio/{record_id}.mp3"
    created_at = datetime.now(timezone.utc).isoformat()

    use_aws = not MOCK_AWS and get_aws_clients()

    req_alias = data.get("author_alias")
    author_alias = req_alias if req_alias and isinstance(req_alias, str) and len(req_alias) < 50 else generate_anonymous_handle()

    if not use_aws:
        logger.info("Running in DEMO / MOCK mode (No AWS credentials configured)")
        epic_text = mock_narrative(original_text, story_genre)
        audio_url = f"/api/audio/{record_id}"
        stream_url = f"/api/audio/{record_id}"

        mock_item = {
            "id": record_id,
            "original_text": original_text,
            "epic_text": epic_text,
            "audio_url": audio_url,
            "stream_url": stream_url,
            "s3_key": s3_key,
            "genre": story_genre or "epic",
            "voice": voice_preference,
            "handle": handle,
            "session_id": session_id,
            "is_public": is_public,
            "created_at": created_at,
            "upvotes": 0,
            "comments": [],
            "comments_count": 0,
            "demo_mode": True,
        }
        audio_assets = get_audio_assets(story_genre)
        mock_item.update(audio_assets)
        MOCK_POSTS.insert(0, mock_item)

        return jsonify(mock_item), 200

    try:
        # 1. Amazon Bedrock Narrative Generation
        logger.info(f"Invoking Bedrock narrative transformation (genre={story_genre})")
        epic_text = invoke_bedrock(original_text, story_genre)

        # 2. AWS Polly Speech Synthesis
        logger.info(f"Synthesizing speech via AWS Polly (Voice: {voice_preference})")
        audio_stream = synthesize_speech(epic_text, voice_id=voice_preference)

        # Cache in memory for instant local replay
        audio_bytes = audio_stream.getvalue()
        AUDIO_CACHE[record_id] = audio_bytes

        # 3. Direct Upload to Amazon S3
        logger.info(f"Uploading audio to Amazon S3 bucket {S3_BUCKET_NAME}: {s3_key}")
        try:
            audio_url = upload_to_s3(audio_stream, s3_key)
            logger.info("Audio uploaded successfully to S3 with presigned URL")
        except Exception as s3_err:
            logger.warning(f"S3 upload error ({s3_err}). Falling back to stream endpoint.")
            audio_url = f"/api/audio/{record_id}"

        stream_url = f"/api/audio/{record_id}"

        # 4. Dual Indexing to DynamoDB
        logger.info(f"Persisting metadata & anonymous identity to DynamoDB: {record_id}")
        save_to_dynamodb(
            record_id=record_id,
            original_text=original_text,
            epic_text=epic_text,
            audio_url=audio_url,
            s3_key=s3_key,
            story_genre=story_genre,
            voice_preference=voice_preference,
            handle=handle,
            session_id=session_id,
            is_public=is_public,
            created_at=created_at,
        )

        response_payload = {
            "id": record_id,
            "original_text": original_text,
            "epic_text": epic_text,
            "audio_url": audio_url,
            "stream_url": stream_url,
            "s3_key": s3_key,
            "genre": story_genre or "epic",
            "voice": voice_preference,
            "handle": handle,
            "session_id": session_id,
            "is_public": is_public,
            "created_at": created_at,
            "upvotes": 0,
            "comments": [],
            "comments_count": 0,
        }
        response_payload.update(get_audio_assets(story_genre))
        return jsonify(response_payload), 200

    except Exception as e:
        logger.warning(f"Transformation pipeline failed ({e}). Falling back to demo mode.")
        epic_text = mock_narrative(original_text, story_genre)
        audio_url = f"/api/audio/{record_id}"
        stream_url = f"/api/audio/{record_id}"

        payload = {
            "id": record_id,
            "original_text": original_text,
            "epic_text": epic_text,
            "audio_url": audio_url,
            "stream_url": stream_url,
            "s3_key": s3_key,
            "genre": story_genre or "epic",
            "voice": voice_preference,
            "handle": handle,
            "session_id": session_id,
            "is_public": is_public,
            "created_at": created_at,
            "upvotes": 0,
            "comments": [],
            "comments_count": 0,
            "demo_mode": True,
        }
        payload.update(get_audio_assets(story_genre))
        MOCK_POSTS.insert(0, payload)
        return jsonify(payload), 200

# =============================================================================
# Pillar 2: Dedicated Public Social Feed & Community Forum Endpoints
# =============================================================================
@app.route("/api/feed", methods=["GET"])
def get_feed():
    """
    Anonymous Public Community Feed (Reddit-style global board).
    Returns published tales from Amazon DynamoDB, refreshed with
    active S3 presigned URLs, comments, and real-time upvote scores.
    Supports sorting ('new', 'top') and genre filtering.
    """
    sort_by = request.args.get("sort", "new").lower()
    genre_filter = request.args.get("genre", "all").lower()

    posts = []

    # 1. Fetch from Amazon DynamoDB
    if not MOCK_AWS and get_aws_clients() and dynamodb_table is not None:
        try:
            response = dynamodb_table.scan(Limit=100)
            items = response.get("Items", [])

            for raw_item in items:
                item = decimal_to_native(raw_item)

                # Filter out private tales
                if item.get("is_public") is False:
                    continue

                item_genre = (item.get("genre") or "epic").lower()
                if genre_filter != "all" and item_genre != genre_filter:
                    continue

                item_id = item.get("id")
                s3_key = item.get("s3_key", f"audio/{item_id}.mp3")

                # Generate a fresh S3 presigned URL
                audio_url = None
                if s3_client is not None:
                    try:
                        audio_url = s3_client.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": S3_BUCKET_NAME, "Key": s3_key},
                            ExpiresIn=604800,  # 7 days
                        )
                    except Exception:
                        pass

                stream_url = f"/api/audio/{item_id}"
                item["audio_url"] = audio_url or item.get("audio_url") or stream_url
                item["stream_url"] = stream_url
                item["handle"] = item.get("handle") or get_default_anonymous_handle(item_id)
                item["upvotes"] = int(item.get("upvotes") or 0)
                item["comments"] = item.get("comments") or []
                item["comments_count"] = len(item["comments"])

                assets = get_audio_assets(item_genre)
                item.setdefault("bg_music_url", assets.get("bg_music_url"))
                item.setdefault("sfx_url", assets.get("sfx_url"))

                posts.append(item)

        except Exception as e:
            logger.warning(f"DynamoDB scan failed ({e}). Proceeding to fallback cache.")

    # 2. Add or merge MOCK_POSTS if any
    for p in MOCK_POSTS:
        if p.get("is_public") is False:
            continue
        item_genre = (p.get("genre") or "epic").lower()
        if genre_filter != "all" and item_genre != genre_filter:
            continue
        # Deduplicate
        if not any(existing["id"] == p["id"] for existing in posts):
            posts.append(dict(p))

    # Sort posts
    if sort_by == "top":
        posts.sort(key=lambda x: (int(x.get("upvotes") or 0), str(x.get("created_at") or "")), reverse=True)
    else:  # "new"
        posts.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    return jsonify({"posts": posts, "count": len(posts)}), 200

# =============================================================================
# Pillar 1 & 4: Personal History Feed ("My Yaps")
# =============================================================================
@app.route("/api/my-yaps", methods=["GET"])
def get_my_yaps():
    """
    Recent Activity Panel: Personal History ("My Yaps").
    Fetches tales created by the active session_id or anonymous handle.
    """
    session_id = request.args.get("session_id", "").strip()
    handle = request.args.get("handle", "").strip()

    if not session_id and not handle:
        return jsonify({"posts": [], "count": 0}), 200

    user_posts = []

    if not MOCK_AWS and get_aws_clients() and dynamodb_table is not None:
        try:
            response = dynamodb_table.scan(Limit=100)
            items = response.get("Items", [])

            for raw_item in items:
                item = decimal_to_native(raw_item)
                item_session = item.get("session_id", "")
                item_handle = item.get("handle", "")

                if (session_id and item_session == session_id) or (handle and item_handle == handle):
                    item_id = item.get("id")
                    s3_key = item.get("s3_key", f"audio/{item_id}.mp3")

                    audio_url = None
                    if s3_client is not None:
                        try:
                            audio_url = s3_client.generate_presigned_url(
                                "get_object",
                                Params={"Bucket": S3_BUCKET_NAME, "Key": s3_key},
                                ExpiresIn=604800,
                            )
                        except Exception:
                            pass

                    stream_url = f"/api/audio/{item_id}"
                    item["audio_url"] = audio_url or item.get("audio_url") or stream_url
                    item["stream_url"] = stream_url
                    item["upvotes"] = int(item.get("upvotes") or 0)
                    item["comments"] = item.get("comments") or []
                    item["comments_count"] = len(item["comments"])

                    assets = get_audio_assets(item.get("genre"))
                    item.setdefault("bg_music_url", assets.get("bg_music_url"))
                    item.setdefault("sfx_url", assets.get("sfx_url"))

                    user_posts.append(item)

        except Exception as e:
            logger.warning(f"DynamoDB scan in my-yaps failed ({e})")

    # Check mock posts as well
    for p in MOCK_POSTS:
        if (session_id and p.get("session_id") == session_id) or (handle and p.get("handle") == handle):
            if not any(existing["id"] == p["id"] for existing in user_posts):
                user_posts.append(dict(p))

    user_posts.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return jsonify({"posts": user_posts, "count": len(user_posts)}), 200

# =============================================================================
# Pillar 2: Upvote & Discussion Comments Endpoints
# =============================================================================
@app.route("/api/posts/<post_id>/upvote", methods=["POST"])
def upvote_post(post_id):
    """Atomically increments the upvote counter for a story in DynamoDB & cache."""
    clean_id = post_id.strip()
    new_upvotes = 1

    if not MOCK_AWS and get_aws_clients() and dynamodb_table is not None:
        try:
            res = dynamodb_table.update_item(
                Key={"id": clean_id},
                UpdateExpression="ADD upvotes :inc",
                ExpressionAttributeValues={":inc": 1},
                ReturnValues="UPDATED_NEW",
            )
            attrs = decimal_to_native(res.get("Attributes", {}))
            new_upvotes = attrs.get("upvotes", 1)
        except Exception as e:
            logger.warning(f"DynamoDB upvote failed for {clean_id}: {e}")

    # Also update mock store if present
    for p in MOCK_POSTS:
        if p["id"] == clean_id:
            p["upvotes"] = p.get("upvotes", 0) + 1
            new_upvotes = p["upvotes"]
            break

    return jsonify({"success": True, "post_id": clean_id, "upvotes": int(new_upvotes)}), 200

@app.route("/api/posts/<post_id>/comments", methods=["GET", "POST"])
def handle_comments(post_id):
    """
    GET: Retrieves public discussion comments for a tale.
    POST: Adds a new anonymous comment to the story thread in DynamoDB.
    """
    clean_id = post_id.strip()

    if request.method == "GET":
        if not MOCK_AWS and get_aws_clients() and dynamodb_table is not None:
            try:
                res = dynamodb_table.get_item(Key={"id": clean_id})
                item = decimal_to_native(res.get("Item", {}))
                comments = item.get("comments", [])
                return jsonify({"post_id": clean_id, "comments": comments, "count": len(comments)}), 200
            except Exception as e:
                logger.warning(f"DynamoDB get comments failed for {clean_id}: {e}")

        for p in MOCK_POSTS:
            if p["id"] == clean_id:
                comments = p.get("comments", [])
                return jsonify({"post_id": clean_id, "comments": comments, "count": len(comments)}), 200

        return jsonify({"post_id": clean_id, "comments": [], "count": 0}), 200

    # POST method: Add a comment
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    handle = (data.get("handle") or "").strip() or get_default_anonymous_handle()

    if not text:
        return jsonify({"error": "Comment text cannot be empty"}), 400
    if len(text) > 1000:
        return jsonify({"error": "Comment exceeds 1000 characters limit"}), 400

    comment = {
        "id": str(uuid.uuid4()),
        "handle": handle,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    comments_count = 1

    if not MOCK_AWS and get_aws_clients() and dynamodb_table is not None:
        try:
            res = dynamodb_table.update_item(
                Key={"id": clean_id},
                UpdateExpression="SET comments = list_append(if_not_exists(comments, :empty_list), :new_comment)",
                ExpressionAttributeValues={
                    ":empty_list": [],
                    ":new_comment": [comment],
                },
                ReturnValues="UPDATED_NEW",
            )
            attrs = decimal_to_native(res.get("Attributes", {}))
            comments_count = len(attrs.get("comments", []))
        except Exception as e:
            logger.warning(f"DynamoDB add comment failed for {clean_id}: {e}")

    for p in MOCK_POSTS:
        if p["id"] == clean_id:
            p.setdefault("comments", []).append(comment)
            comments_count = len(p["comments"])
            break

    return jsonify({
        "success": True,
        "post_id": clean_id,
        "comment": comment,
        "comments_count": comments_count,
    }), 201

# =============================================================================
# AWS Generative AI Service Functions (Bedrock, Polly, S3, DynamoDB)
# =============================================================================

def mock_narrative(original_text: str, story_genre: str | None) -> str:
    """Rich narrative generator for fallback and demo operation."""
    genre = (story_genre or "epic").lower()
    templates = {
        "fantasy": [
            f"By ancient torchlight in the elder woods, the scribes etched the day's saga into eternal parchment: '{original_text}'. Mystic runes flared along the castle parapets, as prophecy decreed that this moment would alter the balance of the nine realms forever.",
            f"The crystal sphere pulsed with arcane power as the traveler uttered their truth: '{original_text}'. Across the elven glades, mythical beasts paused, sensing that destiny had woven an unbroken thread through this hour."
        ],
        "horror": [
            f"The journal entry should never have been read aloud: '{original_text}'. Each word seemed to draw the chilling dark closer, until the shadows on the wall took form, whispering secrets that no mortal soul was meant to bear.",
            f"A sudden draft extinguished every candle, leaving only the reverberation of that confession: '{original_text}'. From beneath the creaking floorboards, the cadence of slow footsteps began to match their breathing."
        ],
        "science-fiction": [
            f"Starship log, orbit cycle 4412: '{original_text}'. Quantum telemetry flickered wildly across the bridge holo-displays; what began as routine protocol had ruptured the continuum, setting a course for unexplored sectors.",
            f"The neural interface registered unprecedented synaptic spikes upon logging the entry: '{original_text}'. The central synthetic core hummed, recalculating human survival probabilities across all known dimensional timelines."
        ],
        "romance": [
            f"Soft amber light bathed the quiet evening as words long held back were finally whispered: '{original_text}'. In that breathless instant, two divergent paths converged toward the very same horizon.",
            f"The bustling city faded into quiet background rain, leaving only the warmth of a shared realization: '{original_text}'. A gentle glance confirmed what both had known before words were ever spoken."
        ],
        "mystery": [
            f"The confidential case dossier noted only this cryptic clue: '{original_text}'. Every detail seemed too perfectly arranged—someone had orchestrated the day's events like pieces on an obsidian chessboard.",
            f"Smoke curled from the detective's pipe as the surveillance transcript was laid out: '{original_text}'. A hidden timestamp in the margin cracked the alibi wide open, unveiling the conspiracy lurking behind closed doors."
        ],
        "thriller": [
            f"The encrypted burner phone vibrated once: '{original_text}'. Heart rates skyrocketed, surveillance cameras rotated, and the extraction team had exactly ninety seconds before the compound locked down.",
            f"The secure terminal flashed red across the command room: '{original_text}'. There was no time to second-guess; the countdown had begun, and every exit was already monitored."
        ],
        "comedy": [
            f"So apparently today unfolded like this: '{original_text}'. By dinner time, everyone agreed this entire ordeal belonged in a prime-time sitcom—minus the laugh track and plus extra spilled coffee.",
            f"If life were an instruction manual, today was clearly assembled backwards: '{original_text}'. The sheer absurdity of the situation defied physics, common sense, and the patience of innocent bystanders."
        ],
        "epic": [
            f"In the darkest hour of the realm, a lone warrior stepped into the crucible of destiny to declare: '{original_text}'. The heavens split asunder, thunder roared across ancient mountain peaks, and their chronicle was etched forever into the halls of legend!",
            f"The war horn sounded through the misty valley as the decree resounded: '{original_text}'. Banners unfurled across the battlefield, signaling the dawn of an unstoppable crusade that would echo through eternity!"
        ]
    }
    options = templates.get(genre, templates["epic"])
    return random.choice(options)

def build_transformation_prompt(input_text: str, story_genre: str | None) -> str:
    """Build the prompt for Amazon Bedrock."""
    genre = story_genre or "epic"
    genre_labels = {
        "fantasy": "high fantasy",
        "horror": "psychological horror",
        "science-fiction": "hard science fiction",
        "romance": "poetic romance",
        "mystery": "noir mystery",
        "thriller": "high-stakes thriller",
        "comedy": "witty comedic",
        "epic": "epic legendary",
    }
    label = genre_labels.get(genre, "epic dramatic")
    return (
        f"You are a master {label} author and narrator. Transform the following everyday "
        f"micro-log / yap into an unforgettable short {label} narrative (3-5 sentences).\n\n"
        "Rules:\n"
        "1. Preserve ALL key factual details, names, and happenings from the original text.\n"
        f"2. Imbue the narrative with vivid {label} atmosphere, immersive sensory language, and drama.\n"
        "3. Keep the output to exactly one punchy, captivating paragraph.\n"
        "4. Return ONLY the story text without preamble, titles, or quotes.\n\n"
        f"Original log entry:\n\"{input_text}\"\n\n"
        "Story narrative:"
    )

def invoke_bedrock(input_text: str, story_genre: str | None = None) -> str:
    """Invokes Amazon Bedrock Claude model; falls back to narrative generator if unavailable."""
    prompt = build_transformation_prompt(input_text, story_genre)
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "temperature": 0.8,
        "messages": [{"role": "user", "content": prompt}],
    })

    for model_id in [BEDROCK_MODEL_ID, "us.anthropic.claude-3-haiku-20240307-v1:0"]:
        try:
            response = bedrock_runtime.invoke_model(
                modelId=model_id,
                contentType="application/json",
                accept="application/json",
                body=request_body,
            )
            response_body = json.loads(response["body"].read())
            epic_text = response_body["content"][0]["text"].strip()
            if epic_text:
                return epic_text
        except Exception as e:
            logger.info(f"Bedrock invocation note for {model_id}: {e}")

    # Fallback to narrative generator
    return mock_narrative(input_text, story_genre)

def synthesize_speech(text: str, voice_id: str | None = None) -> io.BytesIO:
    """Converts narrative text into MP3 audio stream using AWS Polly (in-memory BytesIO)."""
    voice = voice_id or POLLY_VOICE_ID
    audio_buffer = io.BytesIO()

    try:
        response = polly_client.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice,
            Engine="neural",
        )
        audio_buffer.write(response["AudioStream"].read())
    except Exception as e:
        logger.warning(f"Polly neural synthesis failed ({e}). Retrying with standard engine.")
        response = polly_client.synthesize_speech(
            Text=text,
            OutputFormat="mp3",
            VoiceId=voice,
            Engine="standard",
        )
        audio_buffer.write(response["AudioStream"].read())

    audio_buffer.seek(0)
    return audio_buffer

def upload_to_s3(audio_buffer: io.BytesIO, s3_key: str) -> str:
    """Uploads in-memory audio buffer directly to Amazon S3 bucket and generates presigned URL."""
    s3_client.upload_fileobj(
        Fileobj=audio_buffer,
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        ExtraArgs={"ContentType": "audio/mpeg"},
    )

    audio_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=604800  # 7 days presigned URL
    )
    return audio_url

def save_to_dynamodb(
    record_id: str,
    original_text: str,
    epic_text: str,
    audio_url: str,
    s3_key: str,
    story_genre: str | None = None,
    voice_preference: str | None = None,
    handle: str | None = None,
    session_id: str | None = None,
    is_public: bool = True,
    created_at: str | None = None,
) -> None:
    """Dual-indexes audio tale into Amazon DynamoDB."""
    item = {
        "id": record_id,
        "status": "PUBLIC",
        "created_at": int(time.time()),
        "author_alias": author_alias,
        "prompt_preview": original_text[:120] + "..." if len(original_text) > 120 else original_text,
        "original_text": original_text,
        "epic_text": epic_text,
        "audio_url": audio_url,
        "s3_key": s3_key,
        "genre": story_genre or "epic",
        "voice": voice_preference or POLLY_VOICE_ID,
        "handle": handle or get_default_anonymous_handle(record_id),
        "session_id": session_id or "",
        "is_public": is_public,
        "created_at": created_at or datetime.now(timezone.utc).isoformat(),
        "upvotes": 0,
        "comments": [],
    }
    dynamodb_table.put_item(Item=item)

# =============================================================================
# Development Entry Point
# =============================================================================
if __name__ == "__main__":
    logger.info("Starting Yap-to-Tale Social Platform server on port 5000")
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
