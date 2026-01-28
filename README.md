# ponto-venda

## Infraestrutura de dados local
Provisiona Traefik, Portainer, MinIO, Hive Metastore, Postgres, Trino,
Airflow, Spark (Delta) e dbt.

### Subir tudo
```bash
make up
```

### Acessos (via Traefik)
- Traefik: `http://traefik.localhost`
- Portainer: `http://portainer.localhost`
- MinIO API: `http://minio.localhost`
- Trino: `http://trino.localhost`
- Airflow: `http://airflow.localhost`
- Spark UI: `http://spark.localhost`
- Airbyte: `http://airbyte.localhost`

### Desligar
```bash
make down
```

### Limpeza total (volumes)
```bash
make clean
```