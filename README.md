
<div align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=28&pause=1000&color=F7B00A&center=true&vCenter=true&width=500&lines=🚧+Project+Under+Construction+🚧;Deploying+Microservices...;Waking+up+the+AI...;Building+Cloud+Infrastructure..." alt="Under Construction Animation" />
</div>

<div align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=28&pause=1000&color=F7B00A&center=true&vCenter=true&width=500&lines=🎙️+Yap-to-Tale;Cloud-Native+GenAI+Microservice;Bedrock+%7C+Polly+%7C+S3+%7C+DynamoDB" alt="Yap-to-Tale Header" />
</div>

# 🎙️ Yap-to-Tale: Cloud-Native GenAI & Audio Synthesis

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-Backend-black?logo=flask)
![AWS](https://img.shields.io/badge/AWS-Polly%20%7C%20S3%20%7C%20DynamoDB-orange?logo=amazon-aws)
![Kubernetes](https://img.shields.io/badge/Kubernetes-EKS-326CE5?logo=kubernetes)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)

## 📖 Overview
**Yap-to-Tale** is a scalable, cloud-native microservice application designed to ingest unstructured user text (daily micro-logs or "yaps") and dynamically transform them into epic, dramatic multimedia stories. The system acts as a stateless, zero-touch media production pipeline powered by AWS Generative AI services.

---

## 🏗️ System Architecture & Workflow

```
[ User Input / Web UI ]
          │
          ▼  POST /api/transform
[ Flask Microservice (Gunicorn WSGI) ]
          │
          ├────────► 1. Amazon Bedrock (Claude 3) ──► Generates Epic Text Narrative
          │
          ├────────► 2. AWS Polly (Neural Engine) ──► Synthesizes MP3 Audio Stream (In-Memory)
          │
          ├────────► 3. Amazon S3 Bucket ───────────► Stores MP3 File (Direct Buffer Upload)
          │
          └────────► 4. Amazon DynamoDB ───────────► Persists UUID, Original & Epic Text, S3 URL
```

---

## 💻 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Backend Framework** | Python 3.12, Flask 3.1, Gunicorn, `boto3` |
| **Frontend UI** | Vanilla HTML5 / CSS3 (Dark-mode, Glassmorphism) / Modern JS |
| **Containerization & Orchestration** | Docker (`python:3.12-slim`), Kubernetes (3 Replicas, LoadBalancer) |
| **Cloud Services** | Amazon Bedrock, AWS Polly, Amazon S3, Amazon DynamoDB |

---

## 🛠️ Step-by-Step: How to Run the Project

### Prerequisites
1. **Python 3.12+** installed on your system.
2. **AWS CLI** configured (`aws configure`) with credentials that have access to:
   - Amazon Bedrock (`bedrock:InvokeModel` - Claude 3 Sonnet enabled)
   - AWS Polly (`polly:SynthesizeSpeech`)
   - Amazon S3 (`s3:PutObject`)
   - Amazon DynamoDB (`dynamodb:PutItem`)

---

### Option 1: Running Locally (Fastest for Development & Testing)

1. **Create and Activate a Virtual Environment:**
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On Mac/Linux:
   source venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set Environment Variables:**
   ```powershell
   # Windows PowerShell:
   $env:AWS_REGION="us-east-1"
   $env:S3_BUCKET_NAME="your-s3-bucket-name"
   $env:DYNAMODB_TABLE_NAME="yap-to-tale-records"
   ```
   ```bash
   # Linux / macOS / Bash:
   export AWS_REGION="us-east-1"
   export S3_BUCKET_NAME="your-s3-bucket-name"
   export DYNAMODB_TABLE_NAME="yap-to-tale-records"
   ```

4. **Start the Flask Development Server:**
   ```bash
   python app/app.py
   ```

5. **Access the App:**
   Open your browser and navigate to `http://localhost:5000`

---

### Option 2: Running with Docker

1. **Build the Production Container Image:**
   ```bash
   docker build -t yap-to-tale:latest .
   ```

2. **Run the Container with AWS Credentials & Environment Variables:**
   ```bash
   docker run -p 5000:5000 \
     -e AWS_REGION="us-east-1" \
     -e S3_BUCKET_NAME="your-s3-bucket-name" \
     -e DYNAMODB_TABLE_NAME="yap-to-tale-records" \
     -e AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY" \
     -e AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY" \
     yap-to-tale:latest
   ```

3. Open `http://localhost:5000` in your browser.

---

### Option 3: Deploying to Kubernetes (Minikube / EKS)

1. **Apply the Kubernetes Deployment and Service:**
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

2. **Verify Deployment & Pods:**
   ```bash
   kubectl get pods -l app=yap-to-tale
   kubectl get svc yap-to-tale-service
   ```

3. **Access the Application:**
   - **For Minikube:** Run `minikube service yap-to-tale-service`
   - **For Cloud K8s (EKS/GKE):** Access the external IP assigned to `yap-to-tale-service`.

---

## 🎯 What to Do Next (Course Project Action Plan)

### Step 1: Provision AWS Cloud Resources
1. **S3 Bucket**: Create an S3 bucket (e.g., `yap-to-tale-audio-bucket`) and grant public read access or configure signed URLs for MP3 playback.
2. **DynamoDB Table**: Create a DynamoDB table named `yap-to-tale-records` with Partition Key `id` (Type: String).
3. **Bedrock Model Access**: Go to AWS Bedrock Console -> Model Access -> Request access to Anthropic Claude 3 models.

### Step 2: Test End-to-End Pipeline
- Launch the application locally or via Docker.
- Type a daily log entry into the web UI (e.g., *"I woke up, drank coffee, fixed a bug, and went for a walk"*).
- Click **"Epicify My Yap"**.
- Verify that the epic text displays on the UI, the MP3 plays smoothly, the audio file is stored in S3, and metadata is recorded in DynamoDB.

### Step 3: Package & Submit Course Project
1. Take screenshots of:
   - Web UI transforming a text.
   - S3 Bucket containing the generated `.mp3` files.
   - DynamoDB Table with persistent records.
2. Commit your complete codebase to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete production codebase for Yap-to-Tale microservice"
   git push origin main
   ```
3. Submit the repository link and architecture walkthrough for academic evaluation!