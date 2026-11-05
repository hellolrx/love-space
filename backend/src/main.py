import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
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


class StoreItemCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    price: int = Field(ge=10, le=500)
    icon_key: str = Field(min_length=1, max_length=40)


class StorePurchaseRequest(BaseModel):
    item_id: int = Field(gt=0)


def _binding(env, name: str, default: str = "") -> str:
    value = getattr(env, name, default)
    return str(value).strip()


def _supabase_headers(request: Request, prefer: str | None = None) -> tuple[str, dict[str, str]]:
    env = request.scope.get("env")
    project_url = _binding(env, "SUPABASE_URL").rstrip("/")
    server_key = _binding(env, "SUPABASE_SERVER_KEY")
    if not project_url or not server_key:
        raise HTTPException(status_code=503, detail="数据服务尚未配置")

    headers = {
        "apikey": server_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if not server_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {server_key}"
    if prefer:
        headers["Prefer"] = prefer
    return project_url, headers


async def _supabase_request(
    request: Request,
    path: str,
    method: str = "GET",
    body: dict | None = None,
    prefer: str | None = None,
):
    project_url, headers = _supabase_headers(request, prefer)
    try:
        response = await fetch(
            f"{project_url}/rest/v1/{path}",
            method=method,
            headers=headers,
            body=json.dumps(body) if body is not None else None,
        )
        payload = await response.json() if response.status != 204 else None
    except Exception as error:
        raise HTTPException(status_code=503, detail="暂时无法连接数据服务") from error

    if response.status < 200 or response.status >= 300:
        detail = payload.get("message") if isinstance(payload, dict) else None
        detail = detail or (payload.get("details") if isinstance(payload, dict) else None)
        raise HTTPException(
            status_code=400 if response.status < 500 else 503,
            detail=detail or "数据操作失败",
        )
    return payload


async def _get_authenticated_profile(request: Request) -> tuple[dict, dict]:
    session = _get_session_payload(request)
    profile = await _get_profile(request, session["profile_id"])
    if not profile or not isinstance(profile.get("nickname"), str) or not profile["nickname"].strip():
        raise HTTPException(status_code=403, detail="账号未关联有效资料")
    return session, profile


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


async def _get_calendar_events(request: Request) -> list[dict]:
    env = request.scope.get("env")
    project_url = _binding(env, "SUPABASE_URL").rstrip("/")
    server_key = _binding(env, "SUPABASE_SERVER_KEY")

    if not project_url or not server_key:
        raise HTTPException(status_code=503, detail="日历服务尚未配置")

    headers = {"apikey": server_key, "Accept": "application/json"}
    if not server_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {server_key}"

    query = "select=*,profiles(nickname)&order=created_at.desc&limit=100"
    try:
        response = await fetch(
            f"{project_url}/rest/v1/calendar_events?{query}",
            method="GET",
            headers=headers,
        )
        if response.status != 200:
            raise HTTPException(status_code=503, detail="暂时无法读取日历事件")
        rows = await response.json()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="暂时无法连接日历服务") from error

    if not isinstance(rows, list):
        raise HTTPException(status_code=503, detail="日历事件数据格式异常")
    return rows


async def _get_store_items(request: Request) -> list[dict]:
    env = request.scope.get("env")
    project_url = _binding(env, "SUPABASE_URL").rstrip("/")
    server_key = _binding(env, "SUPABASE_SERVER_KEY")

    if not project_url or not server_key:
        raise HTTPException(status_code=503, detail="商店服务尚未配置")

    headers = {"apikey": server_key, "Accept": "application/json"}
    if not server_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {server_key}"

    try:
        response = await fetch(
            f"{project_url}/rest/v1/love_store?select=*&order=id.asc",
            method="GET",
            headers=headers,
        )
        if response.status != 200:
            raise HTTPException(status_code=503, detail="暂时无法读取商品目录")
        rows = await response.json()
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="暂时无法连接商店服务") from error

    if not isinstance(rows, list):
        raise HTTPException(status_code=503, detail="商品目录数据格式异常")
    return rows


async def _get_store_inventory(request: Request, nickname: str) -> list[dict]:
    rows = await _supabase_request(
        request,
        f"user_inventory?select=*&owner_name=eq.{quote(nickname, safe='')}&order=created_at.desc",
    )
    if not isinstance(rows, list):
        raise HTTPException(status_code=503, detail="背包数据格式异常")
    return rows


async def _sync_purchase_note(
    request: Request, item_name: str, buyer_nickname: str, inventory_id: int | None
) -> bool:
    source_ref = str(inventory_id) if inventory_id is not None else None
    if source_ref:
        rows = await _supabase_request(
            request,
            "shared_notes?select=id&source_type=eq.store_purchase&source_ref=eq." + quote(source_ref, safe=""),
        )
        if isinstance(rows, list) and rows:
            return True

    now = datetime.now(timezone.utc).isoformat()
    await _supabase_request(
        request,
        "shared_notes",
        method="POST",
        body={
            "title": f"待兑现：{item_name}",
            "content": f"{buyer_nickname} 在商店兑换了「{item_name}」，记得尽快兑现这份心意。",
            "note_type": "redeem",
            "status": "active",
            "is_pinned": True,
            "created_by_nickname": buyer_nickname,
            "updated_by_nickname": buyer_nickname,
            "source_type": "store_purchase",
            "source_ref": source_ref,
            "created_at": now,
            "updated_at": now,
        },
        prefer="return=minimal",
    )
    return True


async def _complete_purchase_note(
    request: Request, inventory_id: int, item_name: str, operator_nickname: str
) -> bool:
    rows = await _supabase_request(
        request,
        "shared_notes?select=id,content&source_type=eq.store_purchase&source_ref=eq."
        + quote(str(inventory_id), safe=""),
    )
    if not isinstance(rows, list) or not rows:
        return True

    note = rows[0]
    content = str(note.get("content") or "")
    if "已兑现" not in content:
        content = f"{content}\n\n已兑现：{operator_nickname} 已经完成了这条兑换。"
    await _supabase_request(
        request,
        f"shared_notes?id=eq.{int(note['id'])}",
        method="PATCH",
        body={
            "status": "done",
            "is_pinned": False,
            "content": content,
            "updated_by_nickname": operator_nickname,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="return=minimal",
    )
    return True


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


@app.get("/api/calendar-events")
async def calendar_events(request: Request):
    _get_session_payload(request)
    return await _get_calendar_events(request)


@app.get("/api/store/items")
async def store_items(request: Request):
    _get_session_payload(request)
    return await _get_store_items(request)


@app.get("/api/store/inventory")
async def store_inventory(request: Request):
    _, profile = await _get_authenticated_profile(request)
    return await _get_store_inventory(request, profile["nickname"].strip())


@app.post("/api/store/items")
async def create_store_item(body: StoreItemCreateRequest, request: Request):
    _, profile = await _get_authenticated_profile(request)
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="商品名称不能为空")
    if body.price % 10 != 0:
        raise HTTPException(status_code=422, detail="价格必须以 10 为单位")
    rows = await _supabase_request(
        request,
        "love_store",
        method="POST",
        body={
            "title": title,
            "price": body.price,
            "stock": 99,
            "owner": profile["nickname"].strip(),
            "icon_key": body.icon_key,
        },
        prefer="return=representation",
    )
    return rows[0] if isinstance(rows, list) and rows else {}


@app.delete("/api/store/items/{item_id}")
async def delete_store_item(item_id: int, request: Request):
    session, _ = await _get_authenticated_profile(request)
    aliases = ["Gogo", "Boy", "daddy", "Daddy"] if session["identity"] == "Gogo" else ["Gigi"]
    alias_filter = "in.(" + ",".join(aliases) + ")"
    await _supabase_request(
        request,
        f"love_store?id=eq.{item_id}&owner={quote(alias_filter, safe='')}",
        method="DELETE",
        prefer="return=representation",
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="商品不存在或不属于当前身份")
    return {"deleted": True}


@app.post("/api/store/purchases")
async def purchase_store_item(body: StorePurchaseRequest, request: Request):
    session, profile = await _get_authenticated_profile(request)
    buyer_nickname = profile["nickname"].strip()
    items = await _supabase_request(
        request,
        f"love_store?select=id,title&id=eq.{body.item_id}",
    )
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=404, detail="商品不存在")

    purchase = await _supabase_request(
        request,
        "rpc/purchase_store_item",
        method="POST",
        body={"p_item_id": body.item_id, "p_buyer_nickname": buyer_nickname},
    )
    inventory_id = purchase.get("inventory_id") if isinstance(purchase, dict) else None
    try:
        await _sync_purchase_note(request, items[0].get("title") or "商品", buyer_nickname, inventory_id)
        note_synced = True
    except Exception:
        note_synced = False

    return {
        **(purchase if isinstance(purchase, dict) else {}),
        "identity": session["identity"],
        "note_synced": note_synced,
    }


@app.post("/api/store/inventory/{inventory_id}/use")
async def use_store_item(inventory_id: int, request: Request):
    _, profile = await _get_authenticated_profile(request)
    nickname = profile["nickname"].strip()
    rows = await _supabase_request(
        request,
        "user_inventory?id=eq."
        + str(inventory_id)
        + "&owner_name=eq."
        + quote(nickname, safe="")
        + "&or=(is_used.eq.false,is_used.is.null)",
        method="PATCH",
        body={"is_used": True},
        prefer="return=representation",
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="背包物品不存在或已使用")

    item_name = rows[0]["item_name"]
    china_date = (datetime.now(timezone.utc) + timedelta(hours=8)).date().isoformat()
    try:
        await _supabase_request(
            request,
            "calendar_events",
            method="POST",
            body={
                "author_name": nickname,
                "date": china_date,
                "content": f"{nickname} 使用了【{item_name}】，请尽快兑现！",
                "type": "diary",
                "mood": "happy",
            },
            prefer="return=minimal",
        )
        event_synced = True
    except Exception:
        event_synced = False

    try:
        await _complete_purchase_note(request, inventory_id, item_name, nickname)
        note_synced = True
    except Exception:
        note_synced = False

    return {
        "used": True,
        "event_synced": event_synced,
        "note_synced": note_synced,
    }


Default = asgi.entrypoint(app)
