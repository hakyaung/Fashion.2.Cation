from fastapi import WebSocket
from typing import Dict

class Notifier:
    def __init__(self):
        # 현재 사이트에 접속해 있는 유저들의 무전기(WebSocket) 목록을 저장하는 명부
        self.connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.connections:
            del self.connections[user_id]

    # 💡 특정 유저에게 콕 집어서 알림 쏘기!
    async def push(self, user_id: str, title: str, body: str):
        if user_id in self.connections:
            await self.connections[user_id].send_json({"title": title, "body": body})

# 앱 전체에서 쓸 수 있게 하나 만들어둠
notifier = Notifier()