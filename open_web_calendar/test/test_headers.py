# SPDX-FileCopyrightText: 2024 Nicco Kunzmann and Open Web Calendar Contributors <https://open-web-calendar.quelltext.eu/>
#
# SPDX-License-Identifier: GPL-2.0-only

"""Test the headers of responses."""

from urllib.parse import unquote

import pytest

CAL_JSON = "/calendar.events.json"
CAL_ICS = "/calendar.ics"


def test_json_result(client):
    """Check the JS headers."""
    response = client.get(CAL_JSON)
    assert response.access_control_allow_origin == "*"
    assert response.content_type.startswith("application/json")


def test_ics(client):
    """Check the JS headers."""
    response = client.get(CAL_ICS)
    print(dir(response))
    assert response.access_control_allow_origin == "*"
    assert response.content_type.startswith("text/calendar")


@pytest.mark.parametrize("endpoint", [CAL_ICS, CAL_JSON])
@pytest.mark.parametrize("h", ["", "asd asd2"])
def test_allow_headers(endpoint, client, h):
    """Check the allowed headers"""
    response = client.get(CAL_ICS, headers={"Access-Control-Request-Headers": h})
    print(response.text)
    assert response.headers.get("Access-Control-Allow-Headers") == h


@pytest.mark.parametrize("endpoint", [CAL_ICS, CAL_JSON])
def test_return_code(client, endpoint):
    """Check the return code"""
    result = client.get(endpoint)
    print(result, dir(result))
    assert result.status_code == 200


def test_ascii_filename_sets_content_disposition(client):
    """An ASCII filename is offered as a plain attachment."""
    response = client.get(CAL_ICS, query_string={"filename": "my event.ics"})
    assert response.status_code == 200
    assert response.headers["Content-Disposition"] == (
        'attachment; filename="my event.ics"'
    )


def test_unicode_filename_does_not_crash(client):
    """A filename with non-Latin-1 characters must not 500.

    HTTP header values are Latin-1 encoded, so a title with em/en dashes
    (e.g. "Saturday Morning — Mixed Age (0–5)") used to crash the WSGI
    header encoding. The filename must be offered via an ASCII fallback
    plus an RFC 5987 ``filename*`` instead.
    """
    filename = "Saturday Morning — Mixed Age (0–5).ics"
    response = client.get(CAL_ICS, query_string={"filename": filename})
    assert response.status_code == 200
    disposition = response.headers["Content-Disposition"]
    # Header must be Latin-1 encodable (WSGI requirement) — no crash.
    disposition.encode("latin-1")
    assert disposition.startswith("attachment;")
    assert "filename*=UTF-8''" in disposition
    # The percent-encoded UTF-8 name round-trips to the original.
    encoded = disposition.split("filename*=UTF-8''", 1)[1]
    assert unquote(encoded) == filename
