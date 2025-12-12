const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_CLIENTS = 20; // 💡 最大接続人数を20人に設定
const MAX_MESSAGE_LENGTH = 200; // 💡 最大メッセージ長を200文字に設定
const COOLDOWN_TIME = 1000; // 💡 連投制限: 1秒 (1000ミリ秒)

const wss = new WebSocket.Server({ port: PORT });
const clients = new Set();
// 各クライアントの前回送信時刻を記録するマップ
const lastMessageTime = new Map();

wss.on('connection', ws => {
  // 1. 人数制限のチェック
  if (clients.size >= MAX_CLIENTS) {
    console.log('Server is full. Connection rejected.');
    ws.close(1013, 'サーバーが満員です'); // 理由コード 1013 (TOO_BIG)
    return;
  }

  clients.add(ws);
  // 初回接続時のタイムスタンプを記録
  lastMessageTime.set(ws, Date.now());
  console.log('Client connected. Total clients:', clients.size);

  ws.on('message', message => {
    const messageString = message.toString();

    // 2. メッセージ長さ制限のチェック
    if (messageString.length > MAX_MESSAGE_LENGTH) {
      console.log('Message too long. Rejected.');
      return; // 転送しない
    }

    // 3. 連投制限のチェック
    const now = Date.now();
    const lastTime = lastMessageTime.get(ws);
    if (lastTime && (now - lastTime) < COOLDOWN_TIME) {
      console.log('Cooldown active. Message rejected.');
      return; // 転送しない
    }
    // 最終送信時刻を更新
    lastMessageTime.set(ws, now);

    // 4. 禁止ワードのチェック（既存のロジック）
    const forbiddenWords = ['死ね', 'バカ','はなくそにき','生きてる価値ない','住所を教えて', ];
    let isViolation = false;
    for (const word of forbiddenWords) {
      if (messageString.includes(word)) {
        isViolation = true;
        break;
      }
    }

    if (isViolation) {
      console.log('Violation detected. Closing connection.');
      ws.close(1008, '利用規約違反により切断されました'); // 理由コード 1008 (POLICY_VIOLATION)
      clients.delete(ws);
      lastMessageTime.delete(ws);
      return;
    }

    // 5. 全員にブロードキャスト
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
    lastMessageTime.delete(ws); // 切断時にマップから削除
    console.log('Client disconnected. Total clients:', clients.size);
  });

  ws.onerror = error => {
    console.error('WebSocket error:', error);
  };
});

console.log(`WebSocket server running on port ${PORT}`);
