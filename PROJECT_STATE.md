# Veron — Project State & Architectural Memory 🧠

> **Документ долгосрочной памяти проекта Veron**. Содержит полный контекст архитектуры, историю решений, протоколы взаимодействия, известные подводные камни и дорожную карту для будущих сессий и AI-агентов.

---

## 1. Карточка проекта

- **Продукт**: `Veron` — сверхбыстрый, модульный десктопный терминальный мультиплексор для Windows.
- **Архитектура**:
  - **Desktop Native**: `tao 0.37` (Windowing & Event Loop) + `wry 0.57` (WebView2).
  - **Backend Core**: `portable-pty 0.8` (ConPTY), `tokio 1.40`, `axum 0.7`, `tower-http 0.6`, `rust-embed 8.12`.
  - **Frontend UI**: React 18, TypeScript, Tailwind CSS, `@xterm/xterm 5.5` (WebGL + Fit addons), Lucide icons.
  - **Портативность**: Единый автономный бинарник `veron.exe` (3.7 МБ) со вшитыми фронтенд-ассетами.
- **Дизайн**: **Cybran Yellow & Black** (`#090a0d` обсидиан + `#f59e0b` янтарное золото). Строгая инженерная эстетика уровня Apple/BridgeMind/Warp без визуального шума.
- **Репозиторий**: Ветка `main` в `C:\Users\user\Documents\dev\veron`.

---

## 2. Архитектура системы

```
                             ┌───────────────────────────────────┐
                             │       NATIVE WINDOW (Tao + Wry)   │
                             │  WebView2 (1366x820)             │
                             │  URL: localhost:4567?token=...    │
                             └─────────────────┬─────────────────┘
                                               │ (HTTP / WS)
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RUST CORE (veron.exe)                                 │
│                                                                                 │
│  [Main Thread]                                                                  │
│  ├── EventLoop (Tao): WindowEvent::CloseRequested -> session_manager.close_all() │
│  └── Arc<SessionManager>                                                        │
│                                                                                 │
│  [Background Tokio Runtime]                                                     │
│  ├── SessionManager (src/session.rs)                                            │
│  │   ├── sessions: Arc<RwLock<HashMap<id, Arc<Session>>>>                       │
│  │   ├── history: Arc<Mutex<Vec<u8>>> (512KB кольцевой буфер на сессию)         │
│  │   ├── captures_dir: .veron/captures/                                         │
│  │   ├── close_all() -> taskkill /PID <pid> /T /F (Zero Zombies Guarantee)      │
│  │   └── rename_session(id, name)                                               │
│  │                                                                              │
│  ├── ConPTY Engine (src/pty.rs)                                                 │
│  │   └── portable-pty (powershell.exe -NoLogo, cmd.exe, wsl.exe, bash.exe)       │
│  │                                                                              │
│  └── Axum HTTP/WS Server (src/server.rs : 4567)                                 │
│      ├── Security: Token Guard (Bearer / ?token= / X-Veron-Token)               │
│      ├── Static Assets: rust-embed (embedded dist/) + disk fallback             │
│      ├── Terminal WS: /ws/terminal/:id (стриминг ввода/вывода)                  │
│      └── Endpoints: /api/system, /api/sessions, /api/upload, /api/captures      │
└───────────────────────┬───────────────────────────────────┬─────────────────────┘
                        │                                   │ (Wi-Fi 0.0.0.0:4567)
                        ▼                                   ▼
          ┌───────────────────────────┐       ┌───────────────────────────┐
          │     Desktop UI (React)    │       │   Mobile Couch Mode       │
          │ - 1..6 Grid + Persistence │       │ - Fullscreen (No splits)  │
          │ - Command Palette (Ctrl+K)│       │ - Touch Developer Toolbar │
          │ - Captures / Explorer     │       │ - Session Switcher Dropdown│
          │ - Session Rename (DblClick│       │ - VisualViewport Auto-Fit │
          └───────────────────────────┘       └───────────────────────────┘
```

---

## 3. Спецификация REST & WebSocket API

Все приватные endpoints защищены токеном авторизации (`?token=...` или заголовок `Authorization: Bearer <token>`):

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/system` | Информация о системе: локальный IP, shells, QR/LAN URL, токен |
| `POST` | `/api/auth/verify` | Валидация введенного PIN-кода на клиенте |
| `GET` | `/api/sessions` | Список всех активных терминальных сессий |
| `POST` | `/api/sessions` | Создание новой сессии (`shell`, `cwd`, `name`, `workspace_id`) |
| `DELETE` | `/api/sessions/:id` | Завершение сессии со сносом дерева процессов (`taskkill /T /F`) |
| `PATCH` | `/api/sessions/:id` | Переименование сессии (`{ "name": "..." }`) |
| `POST` | `/api/sessions/:id/resize` | Изменение геометрии PTY (`{ "rows": N, "cols": N }`) |
| `POST` | `/api/sessions/:id/input` | Отправка команды в терминал через REST (`{ "data": "..." }`) |
| `POST` | `/api/upload` | Сохранение base64-картинки в `.veron/captures` + вставка пути в stdin |
| `GET` | `/api/captures` | Метаданные скриншотов (кол-во файлов, размер на диске) |
| `DELETE` | `/api/captures` | Полная очистка папки `.veron/captures` |
| `POST` | `/api/captures/open` | Мгновенное открытие папки со скриншотами в Проводнике Windows |
| `GET` | `/api/workspaces` | Список рабочих пространств |
| `GET` | `/ws/terminal/:id` | WebSocket терминала (двусторонний бинарный и текстовый обмен) |
| `*` | `/*` (fallback) | Отдача статики React: сначала диск (`./dist`), затем `rust-embed` |

---

## 4. История ключевых архитектурных вех (Changelog)

### Milestone 1 (`ee8c008`): Нативное окно Tao + Wry
- Добавлены зависимости `wry 0.57` и `tao 0.37`.
- Сервер Axum и ConPTY вынесены в фоновый поток Tokio.
- На главном потоке создано нативное десктопное окно Windows с WebView2.
- Добавлен флаг `--server-only` для возможности запуска в headless-режиме.

### Milestone 2 (`63dbdf9`): Палитра быстрых скриптов (`Ctrl+K`) и Проводник
- Создан компонент `QuickScriptsModal.tsx` с пресетами системных, git и dev-команд.
- Добавлена поддержка кастомных скриптов в `localStorage`.
- Добавлен endpoint `/api/captures/open` с вызовом `explorer.exe` из Rust.
- Добавлен REST input endpoint `/api/sessions/:id/input`.

### Milestone 3 (`9d7d3a3`, `78023b8`): Гарантия чистого завершения процессов (Zero Zombies)
- В `pty.rs` метод `kill()` переписан: синхронный `taskkill /PID <pid> /T /F` с флагом `CREATE_NO_WINDOW` и `child.wait()`.
- В `SessionManager` добавлен метод `close_all()` и `impl Drop`.
- В `main.rs` перехват события `WindowEvent::CloseRequested` (крестик) и `Ctrl+C` теперь принудительно зачищает все деревья процессов.
- Исправлен контекст создания сессии внутри Tokio runtime reactor.

### Milestone 4 (`7e41fc7`, `bae6c98`, `73a6207`): Полная портативность через `rust-embed`
- Все фронтенд-ассеты вшиты в релизный бинарник `veron.exe` (3.7 МБ).
- Бинарник скопирован в корень проекта для запуска в 1 клик.
- Настроен `.gitignore` для исключения бинарников из системы контроля версий.

### Milestone 7: Безупречный перехват скриншотов из буфера обмена и относительные пути
- **DOM Capture Phase Listener**: Перехват события `paste` на уровне DOM container и `window` в фазе capture (`{ capture: true }`), предотвращающий проглатывание скриншота внутренним `textarea` xterm.js (`stopPropagation()`).
- **Relative Path Resolution (`.veron/captures/...`)**: Rust бэкенд вычисляет путь скриншота относительно `cwd` активной сессии/проекта с нормализованными прямыми слэшами (`.veron/captures/screenshot_*.png`).
- **Автоматическая PTY stdin-вставка**: Относительный путь напрямую пишется в шелл PTY, и одновременно копируется в буфер обмена пользователя для мгновенной отправки AI-агенту.
- **Интерактивная кнопка в шапке**: Клик по иконке скриншота в шапке панели считывает буфер через `navigator.clipboard.read()` и вставляет путь в 1 клик.
- **Drag & Drop**: Поддержка перетаскивания файлов изображений прямо в окно терминала с автоматическим автосохранением и вставкой пути.
- **Автообновление виджета скриншотов**: Сайдбар мгновенно обновляет счетчик и размер файлов после сохранения скриншота.

### Milestone 7: Изоляция групп окон по Workspaces (До 6 терминалов в группе)
- **Полная изоляция сессий**: Каждый Workspace — это независимая группа до 6 терминалов со своим персональным layout (1..6) и слотами. Переключение между воркспейсами полностью скрывает терминалы других групп и открывает терминалы выбранного воркспейса.
- **Фоновые PTY-процессы**: Терминалы неактивных воркспейсов продолжают безопасно работать в бэкенде (Tokio/ConPTY); при переключении обратно кольцевой буфер 512 КБ мгновенно восстанавливает историю без потерь.
- **Управление группами (CRUD)**: Добавлены API `POST /api/workspaces`, `DELETE /api/workspaces/:id`, `PATCH /api/workspaces/:id`.
- **UI создания и переключения**: Модальное окно `CreateWorkspaceModal` (с указанием стартовой рабочей директории и оболочки), переключатель групп в TopBar и полнофункциональный список с переименованием и удалением в Sidebar.
- **Лимит 6 окон**: Строгий учет лимита (до 6 сессий на один экран) с визуальным счетчиком `X/6` и блокировкой избыточного спавна.

---

## 5. Инварианты и правила для будущих сессий

1. **PowerShell-синтаксис в Windows**:
   - Никогда не использовать `&&` для цепочки команд в PowerShell! Использовать строго `;` (например: `npm run build; cargo check`).
2. **Встраивание ассетов (`rust-embed`)**:
   - При сборке релиза `cargo build --release` **сначала ОБЯЗАТЕЛЬНО** должен быть запущен `npm run build`, чтобы в папке `dist/` лежали свежие файлы фронтенда.
3. **Безопасность ConPTY**:
   - Никогда не убивать процессы через обычный `child.kill()`, так как дочерние сервера (Node, Vite, Python) остаются в памяти. Только через `PtyInstance::kill()`, вызывающий `taskkill /T /F`.
4. **Запрет на `ArtifactMetadata` в файлах проекта**:
   - При создании файлов в проекте через `write_to_file` параметр `ArtifactMetadata` передавать ЗАПРЕЩЕНО (он только для brain-артефактов).
5. **Дизайн-код**:
   - Строгая палитра Cybran Yellow & Black (`#090a0d` / `#f59e0b`). Нулевая терпимость к неоновому AI-слопу, мигающим радужным кружкам и нерелевантным плашкам.

---

## 6. Дорожная карта на будущее (Next Milestones)

1. **Глобальные хоткеи навигации**:
   - `Alt+1..6` — быстрый фокус квадранта сетки без мыши.
   - `Ctrl+Shift+T` — моментальный сплит текущей панели.
2. **Visual Bell / Уведомления об окончании фоновых задач**:
   - Мягкий янтарный импульс на границе терминала при успешном завершении длительной сборки (код 0) или красный импульс при ошибке.
