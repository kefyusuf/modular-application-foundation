# Infrastructure Standards

Infrastructure must remain adapter-based.

The architecture may support:

- PostgreSQL;
- Redis;
- Kafka;
- RabbitMQ;
- AWS SQS/SNS/EventBridge;
- MinIO/S3;
- Prometheus;
- OpenTelemetry;
- Kong/API Gateway;
- Jenkins/GitHub Actions/GitLab CI;
- Docker;
- Kubernetes as optional future deployment target.

Infrastructure must not leak into domain logic.
