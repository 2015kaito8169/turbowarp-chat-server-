const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_CLIENTS = 20; // 最大接続人数
const MAX_MESSAGE_LENGTH = 200; // 最大メッセージ長
const COOLDOWN_TIME = 1000; // 連投制限: 1秒

const wss = new WebSocket.Server({ port: PORT });
const clients = new Set();
const lastMessageTime = new Map();

// 💡 追加した禁止ワード・ドメインリスト
const forbiddenWords = [
    '.net', '.jp', '.co.jp', '大麻', 'コカイン', 'MDMA', 'ヘロイン', 'LSD', 
    '向精神薬', '有機溶剤', '海賊版', '殺すぞ', '後で覚悟しとけ', '殺す', 'ハッキング'
];

wss.on('connection', ws => {
  if (clients.size >= MAX_CLIENTS) {
    console.log('Server is full. Connection rejected.');
    ws.close(1013, 'サーバーが満員です');
    return;
  }

  clients.add(ws);
  lastMessageTime.set(ws, Date.now());
  console.log('Client connected. Total clients:', clients.size);

  ws.on('message', message => {
    const messageString = message.toString();

    if (messageString.length > MAX_MESSAGE_LENGTH) {
      console.log('Message too long. Rejected.');
      return;
    }

    const now = Date.now();
    const lastTime = lastMessageTime.get(ws);
    if (lastTime && (now - lastTime) < COOLDOWN_TIME) {
      console.log('Cooldown active. Message rejected.');
      return;
    }
    lastMessageTime.set(ws, now);

    // 💡 禁止ワードチェックの強化 (大文字小文字を区別しないようにtoLowerCase()を使用)
    const lowerCaseMessage = messageString.toLowerCase();
    let isViolation = false;
    for (const word of forbiddenWords) {
      if (lowerCaseMessage.includes(word.toLowerCase())) {
        isViolation = true;
        break;
      }
    }

    if (isViolation) {
      console.log('Violation detected. Closing connection.');
      ws.close(1008, '利用規約違反により切断されました');
      clients.delete(ws);
      lastMessageTime.delete(ws);
      return;
    }

    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
    lastMessageTime.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
  });

  ws.onerror = error => {
    console.error('WebSocket error:', error);
  };
});

console.log(`WebSocket server running on port ${PORT}`);
