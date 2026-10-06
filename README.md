# Dynamic Request Form

Angular application that renders request forms (**Software Request** / **Hardware Request**) from a JSON schema, with one page per section, validation, **autosave** with visible save states and retries, and a read-only summary at the end.

> Stack: Angular 18 (standalone components + signals), Reactive Forms, RxJS 7. No state libraries. API mocked locally with RxJS.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Application flow](#2-application-flow)
3. [Architecture and data flow](#3-architecture-and-data-flow)
4. [Project structure (and why this one)](#4-project-structure-and-why-this-one)
5. [Code walkthrough](#5-code-walkthrough)
6. [The autosave pipeline, operator by operator](#6-the-autosave-pipeline-operator-by-operator)
7. [Styling](#7-styling)
8. [Quality: tests, linting, formatting, hooks and CI](#8-quality-tests-linting-formatting-hooks-and-ci)
9. [Decisions, trade-offs and possible improvements](#9-decisions-trade-offs-and-possible-improvements)
10. [Requirements checklist](#10-requirements-checklist)

---

## 1. Quick start

Requirements: **Node 18.19+ / 20 / 22** (see `.nvmrc`) and npm.

```bash
npm install        # also installs the git hooks ("prepare" script -> husky)
npm start          # http://localhost:4200
```

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `npm start`            | Dev server with live reload                                     |
| `npm run build`        | Production build into `dist/`                                   |
| `npm test`             | Unit tests (Karma + Jasmine) in watch mode                      |
| `npm run test:ci`      | Single headless Chrome run with a coverage report               |
| `npm run lint`         | ESLint (TypeScript + HTML templates, incl. accessibility rules) |
| `npm run lint:fix`     | ESLint with autofix                                             |
| `npm run format`       | Prettier over the whole repo                                    |
| `npm run format:check` | Checks formatting without writing (used by CI)                  |
| `npm run check`        | Everything: format + lint + tests + build (same as CI)          |

> **Running tests without Google Chrome** (e.g. Windows with only Edge): Karma accepts any Chromium-based browser through `CHROME_BIN`.
>
> ```powershell
> $env:CHROME_BIN = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"; npm run test:ci
> ```

---

## 2. Application flow

```text
 /                                   /request/:schemaId/section/:i              /request/:schemaId/summary
┌───────────────────────┐  Start    ┌──────────────────────────────┐  Submit   ┌─────────────────────────┐
│ What do you need to   │ ────────► │ [Nav]  Section i             │ ────────► │ Awesome!                │
│ purchase?             │           │        field 1  (autosave)   │           │ Question ....... Answer │
│ (Software) (Hardware) │           │        field 2  (autosave)   │           │ Question .. not answered│
└───────────────────────┘           │ [Previous]  [Next | Submit]  │           │ [Create New Request]    │
           ▲                        └──────────────────────────────┘           └────────────┬────────────┘
           └────────────────────────────────── reset ───────────────────────────────────────┘
```

- **Chooser**: the user picks a schema (pills) and **Start** becomes enabled.
- **Form**: one section per page. **Next** moves forward; on the last section it becomes **Submit**. Both look blocked while the section is invalid; if clicked anyway, they don't navigate, they highlight the invalid fields and move focus to the first one. The side nav allows going back to previous sections (never jumping forward, so validation can't be skipped).
- **Autosave**: each field saves itself ~700 ms after the user stops typing, showing `Saving…`, `Saved`, `Error – retrying…` or `Error – could not save` + **Retry**.
- **Summary**: read-only list of every answer and a single **Create New Request** button that resets everything and returns to the chooser.

Routes:

| Route                                      | Component                 | Why                                                                                    |
| ------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------- |
| `/`                                        | `SchemaChooserComponent`  | Entry point.                                                                           |
| `/request/:schemaId/section/:sectionIndex` | `RequestFormComponent`    | The section lives in the URL: the browser's back button works and the page can reload. |
| `/request/:schemaId/summary`               | `RequestSummaryComponent` | Final page.                                                                            |
| `**`                                       | redirect to `/`           | Any unknown URL goes back to the start.                                                |

---

## 3. Architecture and data flow

```text
                ┌───────────────────────── core/ ─────────────────────────┐
                │                                                          │
 schemas.data ─►│ SchemaApiService      GET /api/schemas  (mock, delay)    │
                │                                                          │
                │ RequestStoreService   state (signals) + RxJS pipeline    │
                │   schema, requestId, answers, saveStatus                 │
                │   queueAnswer() ──► Subject ──► autosave ──┐             │
                │                                            ▼             │
                │ RequestApiService     PUT /api/requests/:id/question/:q  │
                │                       (mock: 600–1000ms latency,         │
                │                        15% failures)                     │
                └──────────────▲──────────────────────────┬────────────────┘
                               │ queueAnswer(id, value)   │ answers(), saveStatus()
                ┌──────────────┴──────────────────────────▼────────────────┐
 features/      │ SchemaChooser    RequestForm (one FormGroup per section) │
                │                  RequestSummary                          │
                └──────────────────────────┬───────────────────────────────┘
                                           │ @Input field/control/saveStatus
 shared/        ┌──────────────────────────▼───────────────────────────────┐
                │ DynamicField (text | number | radio | toggle)            │
                │ SaveIndicator (Saving… / Saved / Error – retrying…)      │
                └──────────────────────────────────────────────────────────┘
```

Key ideas:

- **Single source of truth**: `RequestStoreService`. It holds the active schema, a `requestId`, the answers and the save status **per question**, and exposes all of it as read-only signals.
- **Forms are ephemeral**: the `FormGroup` is built per section from the schema and hydrated with the answers in the store. When the section changes, it's discarded and a new one is built. Going back to a section therefore shows what the user already entered, without keeping a giant `FormGroup` alive.
- **Signals for state, RxJS for time/async**: signals represent "what the value is right now" (simple and efficient for the view); RxJS is used where it shines — debouncing, cancellation, grouping, retries with backoff.
- **"Dumb" presentational components**: `DynamicField` and `SaveIndicator` don't know about the store; they receive data through `@Input` and emit events through `@Output`. They're reusable and easy to test.

---

## 4. Project structure (and why this one)

```text
src/
├── index.html, main.ts, styles.scss     # bootstrap + global design tokens
└── app/
    ├── app.component.*                  # shell: just <router-outlet>
    ├── app.config.ts                    # providers (router, change detection)
    ├── app.routes.ts                    # route table
    │
    ├── core/                            # singletons and domain, no UI
    │   ├── models/schema.models.ts      #   types: FormSchema, SectionSchema, FieldSchema, SaveStatus
    │   ├── data/schemas.data.ts         #   the 2 schemas from the brief (mock fixture)
    │   └── services/
    │       ├── schema-api.service.ts    #   mock GET /api/schemas
    │       ├── request-api.service.ts   #   mock PUT /api/requests/:id/question/:questionId
    │       └── request-store.service.ts #   state + autosave pipeline
    │
    ├── features/                        # one folder per screen/route ("smart components")
    │   ├── schema-chooser/
    │   ├── request-form/
    │   └── request-summary/
    │
    └── shared/components/               # reusable, stateless UI ("dumb components")
        ├── dynamic-field/
        └── save-indicator/
```

Each component lives in its own folder with its `.ts`, `.html`, `.scss` and `.spec.ts` side by side.

### Why `core / features / shared`

It's the convention recommended by the Angular style guide for small-to-medium apps, and it splits code by **responsibility and dependency direction**:

- `features/` **may** import from `core/` and `shared/`.
- `shared/` does **not** import from `features/` nor inject `core/` services (it only uses types from `core/models`).
- `core/` does **not** import from `features/` or `shared/`.

The dependency graph therefore flows in one direction, and every new file has an obvious home: is it a screen? → `features`. A reusable visual piece? → `shared`. App-wide logic/state/domain? → `core`.

### Alternatives considered

| Structure                                                                                           | Pros                                                                                | Cons for this project                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flat / by file type** (`components/`, `services/`, `models/`)                                     | Zero decisions; fine for 3-file demos.                                              | Doesn't express what is a screen vs. what is reusable; as it grows, `components/` becomes a junk drawer and there are no dependency rules.                                              |
| **NgModules per feature** (`RequestFormModule`, `SharedModule`, `CoreModule`)                       | Classic pattern (Angular ≤ 14), explicit encapsulation, per-module lazy loading.    | With standalone components (the default since Angular 17) modules are boilerplate: each component already declares its `imports`. `SharedModule` tends to import everything everywhere. |
| **Self-contained features** (each feature with its own `services/`, `models/`, `components/`)       | Maximum cohesion; easy to delete/move a whole feature.                              | Here all 3 screens share the same state (the store) and the same models: they'd have to be arbitrarily assigned to one feature, or duplicated.                                          |
| **Nx monorepo with libs** (`libs/request/data-access`, `libs/request/ui`, `libs/request/feature-*`) | Lint-enforced dependency boundaries, incremental build/test, scales to large teams. | Oversized for 3 screens: adds tooling, configuration and concepts that don't pay off in a coding challenge.                                                                             |
| **Layered / DDD** (`domain/`, `application/`, `infrastructure/`, `presentation/`)                   | Isolates the domain from frameworks; useful for complex domains.                    | The domain here is small (schemas + answers); the ceremony outweighs the benefit.                                                                                                       |

**Conclusion**: `core / features / shared` gives just the right separation of concerns for the size of the problem, and it **maps 1:1 to the other options if the project grows**: `core/services` → a `data-access` lib, `shared/components` → a `ui` lib, each `features/x` → a `feature-x` lib. In other words, it doesn't close any doors.

---

## 5. Code walkthrough

### 5.1 Models — `core/models/schema.models.ts`

```ts
type FieldType = 'text' | 'number' | 'radio' | 'toggle';
interface FieldSchema {
  id: number;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  default?: unknown;
}
interface SectionSchema {
  id: string;
  title: string;
  fields: FieldSchema[];
}
interface FormSchema {
  id: string;
  title: string;
  sections: SectionSchema[];
}
type SaveStatus = 'idle' | 'saving' | 'retrying' | 'saved' | 'error';
```

They type the brief's JSON exactly. `required`, `options` and `default` are optional because not every field has them (e.g. the hardware toggle only has `default`).

### 5.2 API mocks — `core/services/*-api.service.ts`

The brief allows "a simple RxJS fake service with delay/throwError", so neither `HttpClient` nor in-memory-web-api is used:

- **`SchemaApiService.getSchemas()`** → `of(ALL_SCHEMAS).pipe(delay(250))`. Mocks `GET /api/schemas`.
- **`RequestApiService.saveAnswer(requestId, questionId, value)`** → mocks `PUT /api/requests/:id/question/:questionId`:
  - `timer(600 + random * 400)` → latency between **600 and 1000 ms**.
  - With a **15%** probability (within the requested 10–20% range) it returns `throwError(...)`.

Both are `@Injectable` services with the same signature a real `HttpClient`-based implementation would have, so they could be swapped without touching their callers (and tests replace them with test doubles).

### 5.3 Store — `core/services/request-store.service.ts`

Private state in writable signals, exposed via `asReadonly()`:

| Signal        | Content                                                        |
| ------------- | -------------------------------------------------------------- |
| `schema`      | Active schema (or `null`)                                      |
| `requestId`   | UUID generated when a schema is picked (`crypto.randomUUID()`) |
| `answers`     | `Record<questionId, value>`                                    |
| `saveStatus`  | `Record<questionId, SaveStatus>`                               |
| `isAnySaving` | `computed`: is any field `saving` or `retrying`?               |

Public API:

- `selectSchema(schema)`: starts a new request (new `requestId`, answers seeded with toggle defaults).
- `queueAnswer(questionId, value)`: updates `answers` **immediately** (UI and summary stay in sync) and queues the autosave.
- `retrySave(questionId)`: manual retry after a permanent failure.
- `reset()`: clears everything (used by the chooser and by "Create New Request").

The autosave pipeline is explained in [section 6](#6-the-autosave-pipeline-operator-by-operator).

### 5.4 Dynamic form — `features/request-form/`

1. Subscribes to `route.paramMap` (with `takeUntilDestroyed`) → gets `schemaId` and `sectionIndex`.
2. **Rehydration**: if the store doesn't hold that schema (page reload / deep link), it fetches it from `SchemaApiService` and calls `selectSchema`. Unknown schema → `/`. Unknown section index → section 0.
3. `buildForm(section)` creates a `FormGroup` with **one `FormControl` per field**, keyed by `field.id`:
   - Validators: `Validators.required` when `required: true`; a custom `numberValidator()` for `type: 'number'` (empty is allowed; if there's a value it must be numeric).
   - Initial value: the answer saved in the store → otherwise the toggle's `default` → otherwise `''`.
   - `control.valueChanges` → `store.queueAnswer(field.id, value)`. Every keystroke updates the store and triggers the autosave.
4. **Blocked Next / Submit** (`goNextOrSubmit`). Blocking has two layers:
   - **Visual**: while the section is invalid the button has `aria-disabled="true"` and looks dimmed (it unblocks itself as soon as everything is valid).
   - **Functional**: if clicked anyway → `markAllAsTouched()` + `forceShowErrors = true`, it **doesn't navigate**, the message "Please fix the highlighted fields to continue." appears (`role="alert"`, announced by screen readers), and **focus + scroll move to the first invalid field**.
   - **Why `aria-disabled` and not `[disabled]`?** A `disabled` button doesn't receive clicks: the user would see a dead button without knowing what's missing, and we couldn't fulfil the "highlighting where the error is" part. With `aria-disabled` the button communicates that it's blocked but can still explain _why_.
   - If valid → next section or `/summary`.
5. **Previous** and the side nav go to previous sections (without validating: going back should never be blocked). The first section has **no Previous** (as in the mockup): there's no previous section, and going back to the chooser would discard the request in progress, so it shouldn't be one accidental click away.

Nothing is hardcoded to the two schemas: the number of sections, fields, labels, types, options and required flags all come from the JSON. A new schema with 5 sections would work unchanged.

### 5.5 Dynamic field — `shared/components/dynamic-field/`

Presentational component that receives `field`, `control`, `saveStatus` and `forceShowErrors`, and uses `ngSwitch` on `field.type`:

| Type     | Renders                                                               |
| -------- | --------------------------------------------------------------------- |
| `text`   | `<input type="text">`                                                 |
| `number` | `<input type="number">` + numeric validator                           |
| `radio`  | One "pill" per option wrapping a styled native `<input type="radio">` |
| `toggle` | `<input type="checkbox" role="switch">` styled as a switch            |

It only shows the error when the control is invalid **and** (it was touched **or** the user tried to move forward), so no red errors appear as soon as the page loads. Accessibility: `label for`, `aria-invalid`, `role="radiogroup"` with `aria-labelledby`, `role="switch"`, and visible focus on every control.

### 5.6 Save indicator — `shared/components/save-indicator/`

Maps `SaveStatus` to text and color: `Saving…` (pulsing dot), `Saved` (green), `Error – retrying…` (amber), `Error – could not save` + a **Retry** button (red). It's shown per field, next to its label, so the user knows exactly what was saved.

### 5.7 Chooser and Summary

- **Chooser**: lists the schemas returned by the "API" (Software/Hardware are not hardcoded); the icon and short label are derived from `id`/`title` with a generic fallback. It calls `store.reset()` on init, so going back to the start always begins clean.
- **Summary**: walks every section/field of the schema and shows the answer (`Yes/No` for toggles, `not answered` for empty ones). Entering it without an active request (e.g. after a reload) redirects to `/`.

---

## 6. The autosave pipeline, operator by operator

```ts
answerChanges$.pipe(
  groupBy((change) => change.questionId),                 // 1
  mergeMap((group$) =>                                    // 2
    group$.pipe(
      debounceTime(700),                                  // 3
      distinctUntilChanged(sameRequestAndValueUnlessForced), // 4
      switchMap((change) => {                             // 5
        if (change.requestId !== currentRequestId) return of(null); // 6
        setStatus('saving');
        return api.saveAnswer(...).pipe(
          retry({ count: 2, delay: (_, n) => { setStatus('retrying'); return timer(300 * n); } }), // 7
          tap(() => setStatus('saved')),
          catchError(() => { setStatus('error'); return of(null); }), // 8
        );
      }),
    ),
  ),
).subscribe();
```

1. **`groupBy(questionId)`** — splits the stream into one sub-stream per question. Without it, typing in "Vendor Name" would cancel the pending save of "Item Name".
2. **`mergeMap`** — runs all sub-streams in parallel: each field saves independently.
3. **`debounceTime(700)`** — waits until the user stops typing for 700 ms. This is the brief's "reasonable interval": it avoids one PUT per keystroke without delaying the save too much.
4. **`distinctUntilChanged`** — if the final value equals the last one sent (e.g. the user typed and then deleted), the API isn't called. Manual retries carry `force: true` to bypass this filter (otherwise "Retry" would resend the same value and be dropped).
5. **`switchMap`** — if a new value for the same field arrives while the previous PUT is in flight, the previous one is **cancelled**: only the latest value matters (it prevents a stale response from overwriting a newer one).
6. **`requestId` guard** — each change captures the `requestId` at the moment it's queued. If the user reset or started another request while it sat in the debounce window, the change is dropped (an old value is never saved under the new id, and no "Saving…" is left hanging).
7. **`retry({ count: 2, delay })`** — up to 2 retries with linear backoff (300 ms, 600 ms), showing `Error – retrying…`.
8. **`catchError`** — if all 3 attempts fail, it marks `error` and returns `of(null)`. It's crucial that the error **doesn't propagate**: an error terminates an RxJS stream, and that field's autosave would stop working for good.

The subscription lives in a `providedIn: 'root'` service, so it lasts as long as the app (there's no leak: there's a single pipeline).

---

## 7. Styling

- **Design tokens** as CSS custom properties in `styles.scss` (`--color-primary: #1db496`, `--color-bg`, radii, shadows), taken from the mockups. Components only use variables, so a rebrand happens in one place.
- **BEM** (`block__element--modifier`) in per-component SCSS, with Angular's style encapsulation.
- Only a few shared global classes: `.card`, `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--caps`.
- **Outfit** font (Google Fonts), the closest free match to the mockup's font; without network access it falls back to the system font.
- Responsive: below 640 px the form's side nav becomes a row of tabs.
- Following the brief ("keep styling minimal"), no component library is used (Material, PrimeNG, etc.).

---

## 8. Quality: tests, linting, formatting, hooks and CI

### Unit tests (Jasmine + Karma)

| Spec                                | What it covers                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request-store.service.spec.ts`     | Debounce (3 changes → 1 PUT with the latest value), independent fields (`groupBy`), no resend of equal values, `retrying` → `saved`, error after 2 retries, manual Retry, dropping stale changes after reset / new request.                 |
| `request-api.service.spec.ts`       | Simulated latency and the mock's error branch (with a controlled `Math.random`).                                                                                                                                                            |
| `request-form.component.spec.ts`    | One control per field, Next blocked and errors highlighted while invalid, focus on the first error, numeric validator, navigation to the next section / summary, Submit + Previous on the last section, answers rehydrated when going back. |
| `dynamic-field.component.spec.ts`   | Rendering per type, binding with the `FormControl`, errors hidden while pristine and shown when forced.                                                                                                                                     |
| `request-summary.component.spec.ts` | Read-only list with `not answered`, "Create New Request" resets and navigates, redirect when there's no active request.                                                                                                                     |

Time-based tests use **`fakeAsync` + `tick`** to advance a virtual clock: 700–1000 ms debounces and retries are tested in real milliseconds, deterministically. `RequestApiService` is replaced by a spy, so tests don't depend on the random 15% failure rate.

### ESLint (`eslint.config.js`)

Flat config with **angular-eslint** + **typescript-eslint**:

- Recommended TS and Angular rules, `app` selector prefix.
- Templates: recommended **and accessibility** rules (`templateAccessibility`).
- Extras: `eqeqeq`, `no-console` (allows warn/error), `no-unused-vars` (ignores `_`-prefixed args), explicit return types (warning).
- `eslint-config-prettier` last, to turn off stylistic rules that would clash with Prettier (ESLint handles **code quality**, Prettier handles **formatting**).

### Prettier (`.prettierrc.json`)

`printWidth: 120`, single quotes, trailing commas, `angular` parser for `.html` files. Consistent with `.editorconfig`.

### Husky + lint-staged + commitlint

| Hook         | What it runs                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | `lint-staged`: ESLint `--fix` + Prettier **on staged files only** (fast, doesn't reformat files you didn't touch). |
| `commit-msg` | `commitlint` with **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`…).                         |

The hooks install themselves on `npm install` (`prepare` script).

### CI (`.github/workflows/ci.yml`)

On every push to `main` and every PR: `npm ci` → `format:check` → `lint` → `test:ci` → `build`. Local hooks can be skipped with `--no-verify`; CI is the safety net that can't.

### Editor

`.vscode/settings.json` enables format-on-save with Prettier and ESLint autofix; `.vscode/extensions.json` recommends the required extensions.

---

## 9. Decisions, trade-offs and possible improvements

### Decisions

- **Standalone components + signals** (Angular 18): less boilerplate than NgModules and finer-grained change detection. Signals for synchronous state, RxJS for anything time-based — each tool for its own job.
- **Store as a signal-based service instead of NgRx**: the brief says "no state libraries required"; at this size a service is clearer and sufficient.
- **Per-field autosave** (one PUT per question, as the API contract defines) instead of saving the whole form: less data per request and precise per-field save states.
- **One `FormGroup` per section** instead of a global one: each page validates only its own fields, and the store is the source of truth across pages.
- **Plain RxJS mocks** instead of in-memory-web-api: fewer dependencies and full control over latency/failures; the function contracts mirror the requested endpoints.

### Known trade-offs / next steps

- **Submit doesn't wait for pending saves**: Submit could be blocked while `isAnySaving()` is `true`, or pending changes could be flushed before navigating to the summary.
- **Persistence across reloads**: answers live in memory; after a reload the schema is recovered but the answers aren't. A `GET /api/requests/:id` (or `localStorage`) would allow rehydrating them.
- **Typed Reactive Forms**: `UntypedFormGroup` is used because the keys are dynamic (schema ids); it could be typed with `FormRecord<FormControl<unknown>>`.
- **`ChangeDetectionStrategy.OnPush`** on every component (they're already compatible since they use signals and immutable inputs).
- **New control flow** (`@if`, `@for`, `@switch`, Angular 17+) instead of `*ngIf`/`*ngFor`/`ngSwitch`.
- **Lazy loading** of each feature with `loadComponent` in the routes.
- **E2E tests** (Playwright/Cypress) of the full flow.
- **Field registry**: if more types are added (`date`, `select`, `textarea`…), replace the `ngSwitch` with a `type → component` map rendered through `NgComponentOutlet`, so new types can be added without touching the base component (Open/Closed).

---

## 10. Requirements checklist

| Requirement from the brief                                       | Where / how                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Choose between the 2 schemas                                     | `features/schema-chooser`                                                      |
| One section per page, Next / Previous, Submit on the last one    | `features/request-form` + `section/:sectionIndex` route                        |
| Next/Submit blocked on invalid input, highlighting the errors    | `aria-disabled` + `goNextOrSubmit()` + `field--invalid` + focus on first error |
| Read-only summary + "Create New Request" that resets             | `features/request-summary`                                                     |
| Angular 16+, Reactive Forms                                      | Angular 18.2, `ReactiveFormsModule`, no template-driven forms                  |
| Autosave at a reasonable interval                                | Per-field `debounceTime(700)` in `RequestStoreService`                         |
| `Saving…`, `Saved`, `Error – retrying…` states                   | `SaveIndicatorComponent`                                                       |
| Local mock, no network                                           | `SchemaApiService`, `RequestApiService` (RxJS `timer`/`delay`/`throwError`)    |
| Retry 1–2 times on autosave failures                             | `retry({ count: 2 })` with backoff + manual Retry                              |
| Field types `text \| number \| radio \| toggle`                  | `DynamicFieldComponent`                                                        |
| Fully dynamic sections/fields                                    | Everything is generated from the `FormSchema`; nothing hardcoded per schema    |
| `PUT /api/requests/:id/question/:questionId`, 600–1000ms latency | `RequestApiService.saveAnswer`                                                 |
| `GET /api/schemas`                                               | `SchemaApiService.getSchemas`                                                  |
| Random failures (10–20%)                                         | `FAILURE_RATE = 0.15`                                                          |
