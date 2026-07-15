from pathlib import Path
import json
import uuid

POSTMAN_DIRECTORY = Path("postman")
POSTMAN_DIRECTORY.mkdir(parents=True, exist_ok=True)

BASE_URL = "{{baseUrl}}/api/{{apiVersion}}"


def event(listen: str, lines: list[str]) -> dict:
    return {
        "listen": listen,
        "script": {
            "type": "text/javascript",
            "exec": lines,
        },
    }


def request_item(
    name: str,
    method: str,
    path: str,
    *,
    body: dict | None = None,
    headers: list[dict] | None = None,
    pre_request: list[str] | None = None,
    tests: list[str] | None = None,
) -> dict:
    request_headers = [
        {
            "key": "Accept",
            "value": "application/json",
        }
    ]

    if body is not None:
        request_headers.append(
            {
                "key": "Content-Type",
                "value": "application/json",
            }
        )

    request_headers.extend(headers or [])

    request = {
        "method": method,
        "header": request_headers,
        "url": BASE_URL + path,
    }

    if body is not None:
        request["body"] = {
            "mode": "raw",
            "raw": json.dumps(body, indent=2),
            "options": {
                "raw": {
                    "language": "json",
                }
            },
        }

    item = {
        "name": name,
        "request": request,
    }

    events = []

    if pre_request:
        events.append(
            event(
                "prerequest",
                pre_request,
            )
        )

    if tests:
        events.append(
            event(
                "test",
                tests,
            )
        )

    if events:
        item["event"] = events

    return item


AUTH_HEADER = {
    "key": "Authorization",
    "value": "Bearer {{accessToken}}",
}

GUEST_HEADER = {
    "key": "x-guest-session-token",
    "value": "{{guestSessionToken}}",
}


environment = {
    "id": str(uuid.uuid4()),
    "name": "ScrabbleCalculator - Local",
    "values": [
        {
            "key": "baseUrl",
            "value": "http://localhost:5050",
            "enabled": True,
        },
        {
            "key": "apiVersion",
            "value": "v1",
            "enabled": True,
        },
        {
            "key": "email",
            "value": "",
            "enabled": True,
        },
        {
            "key": "displayName",
            "value": "Marcus Sprint Two",
            "enabled": True,
        },
        {
            "key": "password",
            "value": "SecurePassword123!",
            "type": "secret",
            "enabled": True,
        },
        {
            "key": "registeredUserId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "accessToken",
            "value": "",
            "type": "secret",
            "enabled": True,
        },
        {
            "key": "refreshToken",
            "value": "",
            "type": "secret",
            "enabled": True,
        },
        {
            "key": "registeredMatchId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "registeredPlayerId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "localPlayerId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "guestSessionId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "guestSessionToken",
            "value": "",
            "type": "secret",
            "enabled": True,
        },
        {
            "key": "guestPlayerOneId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "guestPlayerTwoId",
            "value": "",
            "enabled": True,
        },
        {
            "key": "guestMatchId",
            "value": "",
            "enabled": True,
        },
    ],
    "_postman_variable_scope": "environment",
}


collection = {
    "info": {
        "_postman_id": str(uuid.uuid4()),
        "name": "ScrabbleCalculator API - Sprint 2",
        "description": (
            "Complete Sprint 2 workflow for registered and guest match setup, "
            "player management, ordering, starting, cancelling and ownership transfer."
        ),
        "schema": (
            "https://schema.getpostman.com/json/"
            "collection/v2.1.0/collection.json"
        ),
    },
    "item": [
        {
            "name": "01 - Foundation",
            "item": [
                request_item(
                    "API Health",
                    "GET",
                    "/health",
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('API version is 0.3.0', function () {",
                        "  pm.expect(body.data.status).to.eql('healthy');",
                        "  pm.expect(body.data.version).to.eql('0.3.0');",
                        "});",
                    ],
                ),
                request_item(
                    "Database Health",
                    "GET",
                    "/health/database",
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Database is connected', function () {",
                        "  pm.expect(body.data.status).to.eql('connected');",
                        "});",
                    ],
                ),
            ],
        },
        {
            "name": "02 - Registered Identity",
            "item": [
                request_item(
                    "Register Sprint 2 User",
                    "POST",
                    "/auth/register",
                    body={
                        "email": "{{email}}",
                        "displayName": "{{displayName}}",
                        "password": "{{password}}",
                    },
                    pre_request=[
                        "pm.environment.set(",
                        "  'email',",
                        "  'sprint2.' + Date.now() + '@example.com'",
                        ");",
                    ],
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.environment.set('registeredUserId', body.data.user.id);",
                        "pm.environment.set('accessToken', body.data.tokens.accessToken);",
                        "pm.environment.set('refreshToken', body.data.tokens.refreshToken);",
                    ],
                ),
                request_item(
                    "Get Current User",
                    "GET",
                    "/auth/me",
                    headers=[AUTH_HEADER],
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('User ID matches', function () {",
                        "  pm.expect(body.data.user.id)",
                        "    .to.eql(pm.environment.get('registeredUserId'));",
                        "});",
                    ],
                ),
            ],
        },
        {
            "name": "03 - Registered Match Setup",
            "item": [
                request_item(
                    "Reject Unauthenticated Match Creation",
                    "POST",
                    "/matches",
                    body={
                        "dictionaryPolicy": "OXFORD_ONLY",
                    },
                    tests=[
                        "pm.test('Status is 401', function () {",
                        "  pm.response.to.have.status(401);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Actor is required', function () {",
                        "  pm.expect(body.error.code).to.eql('MATCH_ACTOR_REQUIRED');",
                        "});",
                    ],
                ),
                request_item(
                    "Create Registered Match",
                    "POST",
                    "/matches",
                    headers=[AUTH_HEADER],
                    body={
                        "name": "Sprint 2 Registered Match",
                        "dictionaryPolicy": "EITHER_ACCEPTED",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.environment.set('registeredMatchId', body.data.match.id);",
                        "pm.test('Draft is created', function () {",
                        "  pm.expect(body.data.match.status).to.eql('DRAFT');",
                        "  pm.expect(body.data.match.ownerType)",
                        "    .to.eql('REGISTERED_USER');",
                        "});",
                    ],
                ),
                request_item(
                    "Reject Starting Without Players",
                    "POST",
                    "/matches/{{registeredMatchId}}/start",
                    headers=[AUTH_HEADER],
                    body={},
                    tests=[
                        "pm.test('Status is 409', function () {",
                        "  pm.response.to.have.status(409);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Minimum players are required', function () {",
                        "  pm.expect(body.error.code)",
                        "    .to.eql('MATCH_REQUIRES_MORE_PLAYERS');",
                        "});",
                    ],
                ),
                request_item(
                    "Add Registered Player",
                    "POST",
                    "/matches/{{registeredMatchId}}/players",
                    headers=[AUTH_HEADER],
                    body={
                        "source": "REGISTERED_USER",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "const player = body.data.match.players.find(function (item) {",
                        "  return item.source === 'REGISTERED_USER';",
                        "});",
                        "pm.environment.set('registeredPlayerId', player.id);",
                    ],
                ),
                request_item(
                    "Add Local Player",
                    "POST",
                    "/matches/{{registeredMatchId}}/players",
                    headers=[AUTH_HEADER],
                    body={
                        "source": "LOCAL",
                        "displayName": "Lerato",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "const player = body.data.match.players.find(function (item) {",
                        "  return item.displayName === 'Lerato';",
                        "});",
                        "pm.environment.set('localPlayerId', player.id);",
                    ],
                ),
                request_item(
                    "Reject Duplicate Local Name",
                    "POST",
                    "/matches/{{registeredMatchId}}/players",
                    headers=[AUTH_HEADER],
                    body={
                        "source": "LOCAL",
                        "displayName": "  LERATO  ",
                    },
                    tests=[
                        "pm.test('Status is 409', function () {",
                        "  pm.response.to.have.status(409);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Normalized duplicate is rejected', function () {",
                        "  pm.expect(body.error.code)",
                        "    .to.eql('MATCH_PLAYER_NAME_ALREADY_EXISTS');",
                        "});",
                    ],
                ),
                request_item(
                    "Set Seat and Turn Order",
                    "PUT",
                    "/matches/{{registeredMatchId}}/players/order",
                    headers=[AUTH_HEADER],
                    body={
                        "seatOrder": [
                            "{{localPlayerId}}",
                            "{{registeredPlayerId}}",
                        ],
                        "turnOrder": [
                            "{{registeredPlayerId}}",
                            "{{localPlayerId}}",
                        ],
                    },
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Ordering is saved', function () {",
                        "  pm.expect(body.data.match.players[0].seatNumber).to.eql(1);",
                        "  pm.expect(body.data.match.players[1].seatNumber).to.eql(2);",
                        "});",
                    ],
                ),
                request_item(
                    "Start Registered Match",
                    "POST",
                    "/matches/{{registeredMatchId}}/start",
                    headers=[AUTH_HEADER],
                    body={},
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Match is active', function () {",
                        "  pm.expect(body.data.match.status).to.eql('IN_PROGRESS');",
                        "  pm.expect(body.data.match.currentTurnOrder).to.eql(1);",
                        "  pm.expect(body.data.match.currentPlayer.id)",
                        "    .to.eql(pm.environment.get('registeredPlayerId'));",
                        "});",
                    ],
                ),
                request_item(
                    "Reject Editing Active Match",
                    "PATCH",
                    "/matches/{{registeredMatchId}}",
                    headers=[AUTH_HEADER],
                    body={
                        "name": "This Must Not Be Saved",
                    },
                    tests=[
                        "pm.test('Status is 409', function () {",
                        "  pm.response.to.have.status(409);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Active match cannot be edited', function () {",
                        "  pm.expect(body.error.code).to.eql('MATCH_NOT_EDITABLE');",
                        "});",
                    ],
                ),
                request_item(
                    "Get Registered Match",
                    "GET",
                    "/matches/{{registeredMatchId}}",
                    headers=[AUTH_HEADER],
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Scores remain hidden', function () {",
                        "  pm.expect(JSON.stringify(body.data.match).toLowerCase())",
                        "    .not.to.include('score');",
                        "});",
                    ],
                ),
                request_item(
                    "List Registered Matches",
                    "GET",
                    "/matches",
                    headers=[AUTH_HEADER],
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('One registered match exists', function () {",
                        "  pm.expect(body.data.total).to.eql(1);",
                        "});",
                    ],
                ),
                request_item(
                    "Cancel Registered Match",
                    "POST",
                    "/matches/{{registeredMatchId}}/cancel",
                    headers=[AUTH_HEADER],
                    body={},
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Match is cancelled', function () {",
                        "  pm.expect(body.data.match.status).to.eql('CANCELLED');",
                        "  pm.expect(body.data.match.currentTurnOrder).to.eql(null);",
                        "});",
                    ],
                ),
                request_item(
                    "Reject Repeated Cancellation",
                    "POST",
                    "/matches/{{registeredMatchId}}/cancel",
                    headers=[AUTH_HEADER],
                    body={},
                    tests=[
                        "pm.test('Status is 409', function () {",
                        "  pm.response.to.have.status(409);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Repeated cancellation is rejected', function () {",
                        "  pm.expect(body.error.code)",
                        "    .to.eql('MATCH_NOT_CANCELLABLE');",
                        "});",
                    ],
                ),
            ],
        },
        {
            "name": "04 - Guest Match and Ownership Transfer",
            "item": [
                request_item(
                    "Create Guest Session",
                    "POST",
                    "/guest/sessions",
                    body={},
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.environment.set(",
                        "  'guestSessionToken',",
                        "  body.data.guestSessionToken",
                        ");",
                        "pm.environment.set(",
                        "  'guestSessionId',",
                        "  body.data.guestSession.id",
                        ");",
                    ],
                ),
                request_item(
                    "Create Guest Player One",
                    "POST",
                    "/guest/players",
                    headers=[GUEST_HEADER],
                    body={
                        "displayName": "Guest Marcus",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.environment.set('guestPlayerOneId', body.data.player.id);",
                    ],
                ),
                request_item(
                    "Create Guest Player Two",
                    "POST",
                    "/guest/players",
                    headers=[GUEST_HEADER],
                    body={
                        "displayName": "Guest Lerato",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.environment.set('guestPlayerTwoId', body.data.player.id);",
                    ],
                ),
                request_item(
                    "Create Guest Match",
                    "POST",
                    "/matches",
                    headers=[GUEST_HEADER],
                    body={
                        "name": "Sprint 2 Guest Match",
                        "dictionaryPolicy": "BOTH_REQUIRED",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.environment.set('guestMatchId', body.data.match.id);",
                        "pm.test('Guest owns the match', function () {",
                        "  pm.expect(body.data.match.ownerType)",
                        "    .to.eql('GUEST_SESSION');",
                        "});",
                    ],
                ),
                request_item(
                    "Add Guest Player One to Match",
                    "POST",
                    "/matches/{{guestMatchId}}/players",
                    headers=[GUEST_HEADER],
                    body={
                        "source": "GUEST_PLAYER",
                        "guestPlayerId": "{{guestPlayerOneId}}",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                    ],
                ),
                request_item(
                    "Add Guest Player Two to Match",
                    "POST",
                    "/matches/{{guestMatchId}}/players",
                    headers=[GUEST_HEADER],
                    body={
                        "source": "GUEST_PLAYER",
                        "guestPlayerId": "{{guestPlayerTwoId}}",
                    },
                    tests=[
                        "pm.test('Status is 201', function () {",
                        "  pm.response.to.have.status(201);",
                        "});",
                    ],
                ),
                request_item(
                    "Start Guest Match",
                    "POST",
                    "/matches/{{guestMatchId}}/start",
                    headers=[GUEST_HEADER],
                    body={},
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Guest match is active', function () {",
                        "  pm.expect(body.data.match.status).to.eql('IN_PROGRESS');",
                        "  pm.expect(body.data.match.playerCount).to.eql(2);",
                        "});",
                    ],
                ),
                request_item(
                    "Claim Guest Session",
                    "POST",
                    "/guest/claim",
                    headers=[
                        AUTH_HEADER,
                        GUEST_HEADER,
                    ],
                    body={},
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Session is claimed by the registered user', function () {",
                        "  pm.expect(body.data.guestSession.claimedByUserId)",
                        "    .to.eql(pm.environment.get('registeredUserId'));",
                        "});",
                    ],
                ),
                request_item(
                    "Reject Old Guest Token",
                    "GET",
                    "/matches/{{guestMatchId}}",
                    headers=[GUEST_HEADER],
                    tests=[
                        "pm.test('Status is 409', function () {",
                        "  pm.response.to.have.status(409);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Claimed guest token is inactive', function () {",
                        "  pm.expect(body.error.code)",
                        "    .to.eql('GUEST_SESSION_ALREADY_CLAIMED');",
                        "});",
                    ],
                ),
                request_item(
                    "Get Transferred Match as Registered User",
                    "GET",
                    "/matches/{{guestMatchId}}",
                    headers=[AUTH_HEADER],
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Ownership was transferred', function () {",
                        "  pm.expect(body.data.match.ownerType)",
                        "    .to.eql('REGISTERED_USER');",
                        "  pm.expect(body.data.match.id)",
                        "    .to.eql(pm.environment.get('guestMatchId'));",
                        "});",
                    ],
                ),
                request_item(
                    "List All Registered Matches After Claim",
                    "GET",
                    "/matches",
                    headers=[AUTH_HEADER],
                    tests=[
                        "pm.test('Status is 200', function () {",
                        "  pm.response.to.have.status(200);",
                        "});",
                        "const body = pm.response.json();",
                        "pm.test('Both matches belong to the user', function () {",
                        "  pm.expect(body.data.total).to.eql(2);",
                        "});",
                    ],
                ),
            ],
        },
    ],
}


environment_path = (
    POSTMAN_DIRECTORY
    / "ScrabbleCalculator-Local.postman_environment.json"
)

collection_path = (
    POSTMAN_DIRECTORY
    / "ScrabbleCalculator-Sprint-2.postman_collection.json"
)

environment_path.write_text(
    json.dumps(
        environment,
        indent=2,
    )
    + "\n"
)

collection_path.write_text(
    json.dumps(
        collection,
        indent=2,
    )
    + "\n"
)

request_count = sum(
    len(folder.get("item", []))
    for folder in collection["item"]
)

print(f"Created {environment_path}")
print(f"Created {collection_path}")
print(f"Request count: {request_count}")
