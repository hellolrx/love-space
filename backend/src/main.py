import base64
import hashlib
import hmac
import json
import time
from typing import Literal
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from workers import asgi, fetch

app = FastAPI()
SESSION_TTL_SECONDS = 24 * 60 * 60


class LoginRequest(BaseModel):
    identity: Literal["Gogo", "Gigi"]
    password: str = Field(min_length=1, max_length=256)


def _binding(env, name: str, default: str = "") -> str:
    value = getattr(env, name, default)
    return str(value).strip()


def _encode_segment(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode_segment(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _issue_token(profile_id: str, identity: str, secret: str) -> tuple[str, int]:
    expires_at = int(time.time()) + SESSION_TTL_SECONDS
    payload = _encode_segment(
        json.dumps(
            {"profile_id": profile_id, "identity": identity, "exp": expires_at},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    signature = _encode_segment(
        hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    )
    return f"{payload}.{signature}", expires_at


def _read_token(token: str, secret: str) -> dict | None:
    try:
        payload_segment, signature_segment = token.split(".", 1)
        expected_signature = hmac.new(
            secret.encode("utf-8"), payload_segment.encode("ascii"), hashlib.sha256
        ).digest()
        supplied_signature = _decode_segment(signature_segment)
        if not hmac.compare_digest(expected_signature, supplied_signature):
            return None

        payload = json.loads(_decode_segment(payload_segment))
        if (
            payload.get("identity") not in {"Gogo", "Gigi"}
            or not isinstance(payload.get("profile_id"), str)
            or not isinstance(payload.get("exp"), int)
            or payload["exp"] <= int(time.time())
        ):
            return None
        return payload
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


async def _get_identity(request: Request, identity: str) -> dict:
    env = request.scope.get("env")
    project_url = _binding(env, "SUPABASE_URL").rstrip("/")
    server_key = _binding(env, "SUPABASE_SERVER_KEY")

    if not project_url or not server_key:
        raise HTTPException(status_code=503, detail="登录服务尚未配置")

    headers = {"apikey": server_key, "Accept": "application/json"}
    if not server_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {server_key}"

    url = (
        f"{project_url}/rest/v1/app_identities"
        f"?select=profile_id,identity,password_hash&identity=eq.{quote(identity)}&limit=2"
    )
    try:
        response = await fetch(url, method="GET", headers=headers)
        if response.status != 200:
            raise HTTPException(status_code=503, detail="暂时无法验证登录")
        rows = await response.json()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="暂时无法连接登录服务") from error

    if not isinstance(rows, list) or len(rows) != 1:
        raise HTTPException(status_code=401, detail="身份或密码不正确")
    return rows[0]


def _get_session_payload(request: Request) -> dict:
    env = request.scope.get("env")
    session_secret = _binding(env, "SESSION_SECRET")
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or len(session_secret.encode("utf-8")) < 32:
        raise HTTPException(status_code=401, detail="登录状态已失效")

    payload = _read_token(token, session_secret)
    if payload is None:
        raise HTTPException(status_code=401, detail="登录状态已失效")
    return payload


async def _get_profile(request: Request, profile_id: str) -> dict | None:
    env = request.scope.get("env")
    project_url = _binding(env, "SUPABASE_URL").rstrip("/")
    server_key = _binding(env, "SUPABASE_SERVER_KEY")

    if not project_url or not server_key:
        raise HTTPException(status_code=503, detail="登录服务尚未配置")

    headers = {"apikey": server_key, "Accept": "application/json"}
    if not server_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {server_key}"

    url = f"{project_url}/rest/v1/profiles?select=*&id=eq.{quote(profile_id)}&limit=2"
    try:
        response = await fetch(url, method="GET", headers=headers)
        if response.status != 200:
            raise HTTPException(status_code=503, detail="暂时无法读取个人资料")
        rows = await response.json()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="暂时无法连接登录服务") from error

    if not isinstance(rows, list) or len(rows) > 1:
        raise HTTPException(status_code=503, detail="个人资料数据异常")
    return rows[0] if rows else None


async def _get_schedules(request: Request) -> list[dict]:
    env = request.scope.get("env")
    project_url = _binding(env, "SUPABASE_URL").rstrip("/")
    server_key = _binding(env, "SUPABASE_SERVER_KEY")

    if not project_url or not server_key:
        raise HTTPException(status_code=503, detail="日程服务尚未配置")

    headers = {"apikey": server_key, "Accept": "application/json"}
    if not server_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {server_key}"

    try:
        response = await fetch(
            f"{project_url}/rest/v1/schedules?select=*&order=date.asc",
            method="GET",
            headers=headers,
        )
        if response.status != 200:
            raise HTTPException(status_code=503, detail="暂时无法读取日程")
        rows = await response.json()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="暂时无法连接日程服务") from error

    if not isinstance(rows, list):
        raise HTTPException(status_code=503, detail="日程数据格式异常")
    return rows


@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    env = request.scope.get("env")
    allowed_origins = {
        origin.strip()
        for origin in _binding(
            env,
            "ALLOWED_ORIGINS",
            "https://welcome-zjt.pages.dev,http://localhost:8000,http://127.0.0.1:8000",
        ).split(",")
        if origin.strip()
    }
    origin = request.headers.get("origin")

    if request.method == "OPTIONS":
        if origin not in allowed_origins:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        response = JSONResponse({}, status_code=204)
    else:
        response = await call_next(request)

    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        response.headers["Access-Control-Max-Age"] = "86400"
        response.headers["Vary"] = "Origin"
    return response


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
async def login(body: LoginRequest, request: Request):
    env = request.scope.get("env")
    session_secret = _binding(env, "SESSION_SECRET")
    if len(session_secret.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="登录服务尚未配置")

    record = await _get_identity(request, body.identity)
    expected_hash = record.get("password_hash", "")
    supplied_hash = hashlib.sha256(body.password.strip().encode("utf-8")).hexdigest()
    if record.get("identity") != body.identity or not isinstance(expected_hash, str):
        raise HTTPException(status_code=401, detail="身份或密码不正确")
    if not hmac.compare_digest(expected_hash.lower(), supplied_hash):
        raise HTTPException(status_code=401, detail="身份或密码不正确")

    profile_id = record.get("profile_id")
    if not isinstance(profile_id, str):
        raise HTTPException(status_code=503, detail="登录资料配置异常")

    token, expires_at = _issue_token(profile_id, body.identity, session_secret)
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_at": expires_at,
        "profile_id": profile_id,
        "identity": body.identity,
    }


@app.get("/api/auth/session")
async def session(request: Request):
    payload = _get_session_payload(request)
    return {
        "profile_id": payload["profile_id"],
        "identity": payload["identity"],
        "expires_at": payload["exp"],
    }


@app.get("/api/profile")
async def profile(request: Request):
    payload = _get_session_payload(request)
    result = await _get_profile(request, payload["profile_id"])
    if result is None:
        raise HTTPException(status_code=404, detail="找不到对应的个人资料")
    return result


@app.get("/api/schedules")
async def schedules(request: Request):
    _get_session_payload(request)
    return await _get_schedules(request)


Default = asgi.entrypoint(app)
