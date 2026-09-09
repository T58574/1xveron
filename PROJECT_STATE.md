# Veron — Project State & Architectural Memory 🧠

> **Документ памяти проекта Veron**. Содержит полный контекст архитектуры, историю исправлений, спецификацию протоколов и дорожную карту для будущих сессий.

---

## 1. Концепция и цели проекта

- **Название**: Veron (быстрый, модульный терминальный мультиплексор под Windows).
- **Стек ядра**: Rust (1.97+), `portable-pty` (Windows ConPTY), `tokio` (runtime), `axum` (HTTP & WebSocket server), `tower-http`.
- **Стек интерфейса**: React 18, TypeScript, Tailwind CSS, `@xterm/xterm` (v5.5 с fit & webgl addons), Lucide/Material vector icons.
- **Дизайн**: Вдохновлен **BridgeMind** и **Warp.dev** — модульные карточки со скруглениями (`rounded-xl`), мягкими границами, независимыми заголовками окон, палитра Dark (матовый графит `#121316` / `#16171d`, не OLED) и Light. Никаких цветных эмодзи.
- **Ключевые фичи**:
  1. Сетка из **1 \ 2 \ 3 \ 4 \ 5 \ 6 окон** с гарантированным сохранением слотов (**Slot-to-Session Persistence**).
  2. Левый сайдбар управления воркспейсами и инстансами с индикацией скриншотов и очисткой.
  3. Киллер-фича: перехват картинок из буфера (`Ctrl+V` / Drag-and-Drop) -> сохранение в `.veron/captures/` -> автоподстановка пути в строку ввода терминала.
  4. Мобильный «Диванный режим» (Local Wi-Fi Remote): доступ со смартфона по `http://192.168.x.x:4567?token=...` (QR-код на десктопе), 1 полноэкранный терминал, верхний переключатель сессий и нижний тулбар быстрых клавиш (`[ESC]`, `[TAB]`, `[CTRL+C]`, `[CTRL+Z]`, `[↑]`, `[↓]`, `[Clear]`).
  5. **Безопасность в локальной сети**: автоматическая генерация 8-значного Auth PIN / Token при старте, блокировка неавторизованных запросов (HTTP 401).

---

## 2. Архитектура системы и потоки данных

```
  ┌─────────────────────────────────────────────────────────────┐
  │                        RUST CORE                            │
  │                                                             │
  │  [Shell Processes]                                          │
  │  powershell.exe / cmd.exe / wsl.exe / bash.exe              │
  │        ▲                                                    │
  │        │ (ConPTY pipes: stdin / stdout / resize)            │
  │        ▼                                                    │
  │  [PtyInstance] (src/pty.rs)                                 │
  │  Master / Slave PTY pair via `portable-pty`                 │
  │  Background thread: continuous stdout reader                │
  │  Kill: `taskkill /PID <pid> /T /F` (защита от зомби)        │
  │        ▲                                                    │
  │        │                                                    │
  │  [SessionManager] (src/session.rs)                          │
  │  ├── sessions: HashMap<id, Arc<Session>>                    │
  │  ├── history: Arc<Mutex<Vec<u8>>> (512KB scrollback buffer) │
  │  ├── output_tx: broadcast::Sender<Vec<u8>>                  │
  │  ├── captures_dir: .veron/captures/                         │
  │  └── get_captures_info() / clear_captures()                 │
  │        ▲                                                    │
  │        │                                                    │
  │  [Axum HTTP & WS Server] (src/server.rs : 4567)             │
  │  ├── Auth: Token validation (query / Bearer header)         │
  │  ├── GET  /api/system      -> IP, shells, token, hostname   │
  │  ├── POST /api/auth/verify -> validate token                │
  │  ├── GET  /api/sessions    -> list active sessions (Auth)   │
  │  ├── POST /api/sessions    -> spawn new shell (Auth)        │
  │  ├── DEL  /api/sessions/:id-> kill session process tree     │
  │  ├── POST /api/upload      -> save base64 image & paste     │
  │  ├── GET/DEL /api/captures -> info and clear screenshots    │
  │  ├── WS   /ws/terminal/:id -> binary & control JSON stream  │
  │  └── fallback -> ServeDir("./dist") (Frontend SPA)          │
  └────────┬────────────────────────────────────┬───────────────┘
           │ (WebSocket / HTTP)                 │ (LAN Wi-Fi)
           ▼                                    ▼
  ┌─────────────────────────┐          ┌─────────────────────────┐
  │   Desktop Client (PC)   │          │  Mobile Phone (Remote)  │
  │  - Grid Layout (1-6)    │          │  - Single Fullscreen    │
  │  - Slot Persistence     │          │  - Top Session Switcher │
  │  - Card Panes           │          │  - Dev Touch Toolbar    │
  │  - Captures widget      │          │  - PIN Auth Modal       │
  │  - Auto-token auth      │          │  - VisualViewport adapt │
  └─────────────────────────┘          └─────────────────────────┘
```

---

## 3. Выполненные исправления аудита (Changelog)

| Проблема из аудита | Реализованное исправление |
|--------------------|---------------------------|
| **1. Уязвимость открытой локальной сети (0.0.0.0)** | Внедрен динамический Auth PIN / Token (`auth_token`). Запросы без валидного токена отсекаются с кодом `401 Unauthorized`. В QR-код токен зашит в URL (`?token=...`), а десктопный клиент получает его автоматически. Для мобилки без токена доступно окно ввода PIN. |
| **2. Процессы-зомби на Windows (Orphaned Processes)** | В `src-tauri/src/pty.rs` в метод `kill()` встроено завершение дерева процессов через `taskkill /PID <pid> /T /F`. При закрытии окна терминала все дочерние сервера (Node.js, Python, и т.д.) гарантированно удаляются из памяти. |
| **3. Кракозябры и лишний шум PowerShell** | В `src-tauri/src/pty.rs` PowerShell запускается с флагом `-NoLogo` (чистый моментальный запуск) и переменными `PYTHONIOENCODING=utf-8`, `TERM=xterm-256color`, `COLORTERM=truecolor`. |
| **4. Скачущие окна при закрытии (Slot Persistence)** | В `src/App.tsx` введена модель 6 фиксированных слотов `slots: (string \| null)[]`. При закрытии сессии слот становится пустым ("Empty Pane"), а соседние окна остаются строго на своих позициях. Клик по сессии в сайдбаре переносит ее в выбранный слот. |
| **5. Переполнение папки скриншотов** | В `SessionManager` и `server.rs` добавлены эндпоинты `GET /api/captures` и `DELETE /api/captures`. В сайдбар добавлен виджет с объемом скриншотов и кнопкой быстрой очистки в 1 клик. |

---

## 4. Повторный аудит системы (Fresh Post-Fix Audit)

По итогам проверки всех 5 исправлений:
1. **Безопасность**: попытки несанкционированного доступа к `/api/sessions` и `/ws/terminal/*` возвращают `401 Unauthorized`. Локальный компьютер и авторизованный телефон с QR-кода работают без трения.
2. **Стабильность процессов**: закрытие терминалов не оставляет висящих дочерних процессов в Windows Task Manager.
3. **UX раскладки**: сетки от 1 до 6 окон стабильны, окна не меняются местами самопроизвольно.
4. **Компиляция**: чистый билд как в `debug`, так и в `release` (`0 errors, 0 warnings`).

---

## 5. Дорожная карта на будущие сессии

1. **Фаза 2 (Нативное окно Tauri / WebView2)**:
   - Добавление `tauri.conf.json` для упаковки в единый `.exe` инсталлятор / портабельный бинарник.
   - Сворачивание в системный трей (System Tray) с горячей клавишей вызова (например, `Ctrl+\``).
2. **Фаза 3 (Интеграция с ИИ и Quick Actions)**:
   - Настраиваемая панель быстрых скриптов (`git status`, `cargo test`, `npm run dev`).
   - Кнопка «Отправить скриншот ассистенту» с прямой передачей контекста.
