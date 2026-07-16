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

## Sprint 4 turn endpoint

    POST /api/v1/matches/:matchId/turns

The endpoint requires registered or guest match ownership.

Every request requires an `Idempotency-Key` header.

A new valid turn returns HTTP `201`.

An identical replay returns HTTP `200` with `data.replayed: true`.

Invalid words return HTTP `422` with code `TURN_WORDS_INVALID`.

The response reveals the current turn points but not cumulative totals.
