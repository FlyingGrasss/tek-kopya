# Tek Kopya

Aynı medya bir kez saklanır, alıcı sadece açtığında indirir. WhatsApp'ın her cihazda
her dosyayı tekrar tutmasına karşı bir demo.

- Bir görseli 4 sohbette de paylaşsan diskte **tek** blob (SHA-256 adresli).
- Mesaj sadece blob kimliğini taşır; `ref_count` sıfırlanınca dosya silinir.
- "Depolama" paneli canlı metrik gösterir: blob sayısı, toplam boyut, kazanılan bayt,
  dedupe oranı, 24 saatteki indirme sayısı.
- Tarayıcıda LRU blob cache: aynı görsel tekrar açıldığında ağa çıkmaz.

## Çalıştırma

```bash
pnpm install
pnpm seed          # 3 sohbet, 6 mesaj, 4 kez referanslanan tek görsel
pnpm dev           # Next 3000 + API 4700
```

## API

- `POST /api/chats/:id/messages` — `{ sender, body, blob?: { dataUrl, mime } }`
- `GET /api/chats`, `GET /api/chats/:id/messages`
- `GET|HEAD /api/blobs/:id` — baytlar; her istek metrik olarak sayılır
- `DELETE /api/messages/:id` — ref_count azaltır, sıfırda dosyayı siler
- `GET /api/metrics`

## Docker

```bash
cat > .env <<'EOF'
APP_ORIGINS=http://192.168.1.116:8087
HOST_PORT=8087
EOF
docker compose up -d --build
```

Veri `./data` (SQLite + blobs) altında kalır.

## Sınırlar

- Kimlik doğrulama yok; yerel demo. Gerçek üründe: uçtan uca şifreleme, kullanıcı başına
  tuzlu adresleme (hash eşleştirme saldırısına karşı), replikasyon ve moderasyon gerekir.
- Yükleme limiti 2 MB; büyük video için parçalı yükleme gerekir.
