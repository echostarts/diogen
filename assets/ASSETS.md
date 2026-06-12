# Внешние ассеты для «ДИОГЕНА»

Подборка с kenney.nl, opengameart.org и itch.io. Игра сейчас рисует и озвучивает
всё процедурно, и это её фишка — поэтому отбирались ассеты, которые усиливают
игру, не воюя с вазописью: в первую очередь **звук и музыка** (у синтеза WebAudio
есть потолок), во вторую — частицы, иконки и подсказки клавиш (тонируются под
палитру), и только как референс — тематические тайлсеты.

Всё в этой папке скачано с официальных страниц и лицензионно чисто для
коммерческого использования. Почти всё — CC0; два тайлсета требуют указать
автора (см. последнюю колонку).

## Что взято

| Папка | Что внутри | Источник | Автор | Лицензия |
| --- | --- | --- | --- | --- |
| `../public/audio/music/run.ogg` | **в проде**: фоновая музыка рана, греческие струнные и флейта (бывш. `greek instruments`) | [OGA: Experimenting with Greek Instrument Samples](https://opengameart.org/content/experimenting-with-greek-instrument-samples) | Spring Spring | CC0 |
| `../public/audio/music/boss.ogg` | **в проде**: музыка боя с Александром (бывш. `greek boss battle`) | там же | Spring Spring | CC0 |
| `sfx/ambience/crowd-shouting.ogg` | гул возмущённой толпы. **В проде** (`public/audio/sfx/crowd_0.ogg`): тихо на старте рана, громко на выходе Александра | [OGA: Crowd shouting/speaking ambience](https://opengameart.org/content/crowd-shoutingspeaking-ambience) | StarNinjas | CC0 |
| `sfx/impact/` (25 шт.) | удары. **В проде**: `impactWood_heavy_*` → `ram_*` (бочка-таран), `impactSoft_heavy_*` → `hit_*` (фоли-слой жирных попаданий и ран игрока). Остальные (glass/generic/wood light) — в запасе | [Kenney: Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 |
| `sfx/ui/` (16 шт.) | интерфейс. **В проде**: `click_*` (навигация меню), `confirmation_*` → `confirm_*` (взять карту), `error_*` → `deny_*` (не хватает черепков), `glass_002` → `shard_0` (звон покупки). Остальные — в запасе | [Kenney: Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 |
| `sfx/jingles/` (17 шт.) | джинглы `PIZZI*` — пиццикато-струнные, ближайшие по тембру к кифаре. Три **в проде** (копии в `public/audio/jingles/`): `PIZZI02` → `win.ogg`, `PIZZI01` → `lose.ogg`, `PIZZI16` → `evolve.ogg` — выбраны анализом контура высоты тона (восходящий/нисходящий/короткий взлёт), остальные лежат на замену | [Kenney: Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | CC0 |
| `particles/` (32 шт.) | дым, пыль, свет, искры, звёзды, росчерки — 512px, белые/светлые, тонируются `globalCompositeOperation` под охру и крем | [Kenney: Particle Pack](https://kenney.nl/assets/particle-pack) | Kenney | CC0 |
| `ui/icons/` (16 шт.) | звук вкл/выкл, музыка вкл/выкл, пауза, выход, галочка, крест, шестерёнка, корзина (лавка), замок (Гиппархия), стрелки (выбор героя), трофей | [Kenney: Game Icons](https://kenney.nl/assets/game-icons) | Kenney | CC0 |
| `ui/prompts/keyboard/` (18 шт.) | клавиши WASD, стрелки, SPACE, ENTER, ESC, P, M, L, R, 1–3 — для экрана управления | [Kenney: Input Prompts](https://kenney.nl/assets/input-prompts) | Kenney | CC0 |
| `ui/prompts/touch/`, `ui/prompts/gamepad/` | жесты тача (стик/тап) и стик геймпада | там же | Kenney | CC0 |
| `tilesets/land-of-pixels/` | топ-даун тайлсет античной Греции (16/32/48px): храмы, колонны, рыночные лотки, террейн | [itch.io: Land of pixels — Ancient greeks tileset](https://marceles.itch.io/land-of-pixels-ancient-greeks-inspired-tileset-top-down) | marceles | **CC BY 4.0** — указать автора в титрах |
| `tilesets/lpc-ancient-greece/` | исторически выверенная архитектура: дорика/ионика/коринфика, черепичные крыши, **много керамики**, алтари, мозаики | [OGA: LPC compatible Ancient Greek Architecture](https://opengameart.org/content/lpc-compatible-ancient-greek-architecture) | Wolthera van Hövell tot Westerflier (TheraHedwig) | мульти: CC-BY-SA 3.0 / GPL 3.0 / **OGA-BY 3.0** — берём OGA-BY (только указание автора) |

## Как это применяется

1. **Музыка — подключена** (`src/engine/audio.ts`): `run.ogg` лупом на ран,
   `boss.ogg` с кроссфейдом на выходе Александра, приглушение в паузе,
   фейд на финале. Синтез-секвенсор остался фолбэком, если файлы не загрузились.
2. **Джинглы — подключены**: победа/поражение в `stinger()`, фанфара на
   выбор карты-эволюции. Фолбэк — прежние синтез-аккорды.
3. **Удары и UI-звуки — подключены** (банк сэмплов в `audio.ts`, случайные
   варианты с разбросом высоты): дерево на таран (раз в тик, рейт-лимит),
   мягкий тяжёлый удар слоем под синтез на жирных попаданиях и ранах,
   клики/подтверждение/отказ/звон в меню и лавке, гул толпы на старте рана
   и выходе босса. У каждого метода остался синтез-фолбэк.
4. **Частицы — решено не вносить.** Рендер уже имеет фирменные эффекты в
   стиле вазописи (глиняные черепки с кромкой глазури, чернильные всплески,
   свечение фонаря пре-рендеренным спрайтом, корона лучей СОЛНЦА) — мягкие
   аэрографные спрайты Kenney размыли бы графический язык. Лежат в запасе.
5. **Иконки и клавиши — решено не вносить.** Кнопки звука/паузы в HUD и
   текстовые подсказки управления нарисованы вручную в палитре и шрифте игры
   и стилистически целостны. Kenney-наборы остаются на случай отдельного
   экрана настроек/управления.
6. **Тайлсеты** — в пиксель-арте, со стилем игры напрямую не совместимы.
   Лежат как референс пропов агоры (формы амфор, колонн, лотков) и как
   готовая база, если когда-нибудь захочется отдельный пиксельный режим/прототип.

## Осмотрено и не взято (чтобы не искать заново)

- **Antique Pixels: The Vase Collection** (jakaplus.itch.io) — 30+ греческих ваз,
  но платный ($4.99) и рейтинг 2/5.
- **Free Greek Character I–III** (OGA, KrinWolf, CC-BY 4.0) — Dragon Bones-анимация,
  цветной мультяшный side-view: чужой стиль для чернофигурных силуэтов.
- **Temple of Ares Interior** (geimund.itch.io) — интерьер храма, а у нас открытая агора.
- **Walking with Poseidon** (OGA, mvrasseli, CC-BY 3.0) — оркестровая виньетка,
  не в тембре игры, и требует атрибуции при равных альтернативах CC0.
- **Kenney** греческой тематики не делает — у него взята только «нейтральная»
  обвязка (звук, частицы, UI), которая стилю не противоречит.

## Титры (если ассеты пойдут в прод)

Обязательно: `marceles` (тайлсет, CC BY 4.0) и `Wolthera van Hövell tot
Westerflier (TheraHedwig)` (LPC-архитектура, OGA-BY 3.0). Хорошим тоном:
Kenney (kenney.nl), Spring Spring и StarNinjas (opengameart.org), хотя CC0
этого не требует.
