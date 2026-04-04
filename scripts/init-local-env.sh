#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ENV_EXAMPLE_FILE="${ROOT_DIR}/.env.example"

if [[ -f "${ENV_FILE}" ]]; then
  echo ".env already exists at ${ENV_FILE}"
  exit 0
fi

if [[ ! -f "${ENV_EXAMPLE_FILE}" ]]; then
  echo ".env.example not found at ${ENV_EXAMPLE_FILE}" >&2
  exit 1
fi

cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
echo "Created ${ENV_FILE} from .env.example"
echo "Fill real credentials in .env before running docker compose or real E2E."
