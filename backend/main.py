import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from websocket.handler import SessionHandler
from config import settings

app = FastAPI(title="日语实时翻译字幕服务", version="1.0.0")

active_sessions: dict = {}


@app.on_event("startup")
async def startup():
    print(f"Starting server on {settings.host}:{settings.port}")
    print(f"Local ASR: {'enabled' if settings.local_asr_model else 'disabled'}")
    print(f"Cloud ASR: {settings.cloud_asr_provider or 'disabled'}")
    print(f"Translation provider: {settings.translation_provider}")


@app.on_event("shutdown")
async def shutdown():
    for session_id, handler in active_sessions.items():
        handler.reset()
    active_sessions.clear()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection accepted")

    session_id = id(websocket)
    handler = SessionHandler()
    active_sessions[session_id] = handler

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "init":
                print(f"Session {session_id} initialized with config:", message.get("config"))
                continue

            if message.get("type") == "audio_chunk":
                chunk_size = len(message["data"])
                print(f"Received audio chunk: {chunk_size} bytes, seq: {message.get('seq')}")
                
                # 使用流式处理
                await handler.handle_audio_chunk_streaming(message["data"], websocket)

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected")
    except Exception as e:
        print(f"Session {session_id} error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        handler.reset()
        active_sessions.pop(session_id, None)
        print(f"Session {session_id} cleaned up")


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "active_sessions": len(active_sessions),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=True,
    )
