# ScrabbleCalculator API Contract

## Base URL

Local development:

    http://localhost:5050

## Versioned API prefix

    /api/v1

## Success response

A successful response follows this structure:

    {
      "success": true,
      "message": "Human-readable message.",
      "data": {},
      "meta": {
        "requestId": "uuid",
        "timestamp": "ISO-8601 timestamp"
      }
    }

## Error response

An unsuccessful response follows this structure:

    {
      "success": false,
      "message": "Human-readable error message.",
      "error": {
        "code": "MACHINE_READABLE_CODE",
        "details": {}
      },
      "meta": {
        "requestId": "uuid",
        "timestamp": "ISO-8601 timestamp"
      }
    }

The details property is optional.

## Sprint 0 endpoints

    GET /
    GET /api/v1/health
    GET /api/v1/health/database

## Request IDs

Every response includes an x-request-id response header.

A client may provide an x-request-id request header. When it is not supplied,
the API generates a UUID.
