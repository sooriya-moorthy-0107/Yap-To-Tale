# 🎙️ Yap-to-Tale: Cloud-Native GenAI & Audio Synthesis

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-Backend-black?logo=flask)
![AWS](https://img.shields.io/badge/AWS-Polly%20%7C%20S3%20%7C%20DynamoDB-orange?logo=amazon-aws)
![Kubernetes](https://img.shields.io/badge/Kubernetes-EKS-326CE5?logo=kubernetes)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)

## 📖 Overview
**Yap-to-Tale** is a scalable, cloud-native application designed to ingest unstructured, anonymous user text (daily micro-logs or "yaps") and dynamically transform them into rich, dramatic multimedia content. By orchestrating distributed microservices and serverless cognitive APIs, the system acts as an intelligent, zero-touch media production pipeline.

## 🏗️ System Architecture
The application is built on a decoupled, stateless microservices architecture:
*   **Client Interface:** A lightweight web frontend for user input and audio playback.
*   **API Gateway & Orchestration:** A Flask backend containerized via Docker and orchestrated on Kubernetes. It intercepts traffic and routes payloads without local state persistence.
*   **Generative Transformation:** Integration with Amazon Bedrock to systematically rewrite mundane text into epic, dramatic narratives using automated prompt engineering.
*   **Audio Synthesis:** The transformed narrative is piped via `boto3` to AWS Polly, generating high-quality TTS audio streams.
*   **Cloud Persistence:** Audio streams are uploaded directly to **Amazon S3** (Object Storage), while contextual metadata (S3 URLs, original text, transformed text) is logged in **Amazon DynamoDB** (NoSQL).

## 💻 Tech Stack
| Component | Technology |
| :--- | :--- |
| **Application Logic** | Python (Flask), HTML/CSS/JavaScript, `boto3` |
| **Containerization & Orchestration** | Docker, Kubernetes (Amazon EKS) |
| **Cloud Infrastructure** | Amazon S3, Amazon DynamoDB |
| **Cognitive Services & AI** | AWS Polly (TTS), Amazon Bedrock (GenAI) |

## 🚀 Development Setup (Antigravity IDE)
This project is configured for rapid deployment using the Google Antigravity 2.0 IDE agentic workflow. 
1. Initialize the workspace and ensure the `.agents/rules/workspace.md` is active.
2. Ensure AWS CLI is configured with the necessary IAM roles for S3, DynamoDB, Bedrock, and Polly access.
3. Build and deploy the cluster:
   ```bash
   docker build -t yap-to-tale:latest .
   kubectl apply -f k8s/deployment.yaml