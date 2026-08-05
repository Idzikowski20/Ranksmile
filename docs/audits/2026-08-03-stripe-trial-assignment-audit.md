# Audyt: trial bez karty + Stripe.js (wiele instancji)

**Data:** 2026-08-03  
**Kontekst:** Konto dostało trial bez świadomego podpięcia karty. W konsoli przeglądarki ostrzeżenia Stripe o wielu konstruktorach Stripe.js.  
**Cel dokumentu:** pełna mapa kodu, hipotezy root-cause, luki, checklista weryfikacji — **bez wdrożonej naprawy** (do omówienia / planu).

---

## 1. Executive summary

### Co system *powinien* robić dziś (intencja w kodzie)

Trial **nie** powstaje przy samym wejściu na checkout. Ścieżka trial:

1. `POST /api/billing/create-subscription` z `mode: "trial"` → **tylko** `SetupIntent` (bez `Subscription`).
2. Użytkownik wypełnia Payment Element i klika start → `stripe.confirmSetup`.
3. Po sukcesie:
   - klient: `POST /api/billing/activate-trial` **oraz**
   - webhook: `setup_intent.succeeded` → ta sama funkcja `activateTrialFromSetupIntent`.
4. Dopiero wtedy Stripe dostaje `subscriptions.create({ trial_period_days: 7, default_payment_method })`.
5. Sync do DB (`syncSubscriptionToOrg`) nadaje `plan_slug` tylko gdy status lokalnie jest „paid-like”; `trialing` **bez** `default_payment_method` jest **projektowany jako `incomplete`** i **nie** dostaje entitlementów.

### Co użytkownik zgłasza

- Trial przypisany „bez żadnej akcji”.
- Karta nie była podpinana (świadomie).
- Ostrzeżenia Stripe.js (wiele instancji / optymalizacja / dynamic payment methods).

### Werdykt audytu (hipotezy, nie potwierdzone na żywym koncie)

Najbardziej prawdopodobne wyjaśnienia (kolejność wiarygodności):

| # | Hipoteza | Prawdopodobieństwo | Czy tłumaczy „bez karty”? |
|---|----------|--------------------|---------------------------|
| H1 | Trial **został** aktywowany przez SetupIntent (Link / zapisana karta / one-click wallet) — użytkownik nie postrzega tego jako „podpięcie karty” | Wysokie | Częściowo — karta *jest* w Stripe, tylko UX tego nie komunikuje |
| H2 | UI wygląda jak trial/Growth, ale DB nie ma `subscription_status=trialing` (`DEFAULT_PLAN_SLUG=growth` dla free) | Średnie | Tak (false positive UI) |
| H3 | Stary / równoległy flow `checkout-session` + `trial_period_days` albo orphan z reconcile | Średnie/niskie | Możliwe jeśli coś nadal woła ten endpoint / stary sub w Stripe |
| H4 | Webhook + klient podwójnie aktywują (idempotencja) — nie tworzy „pustego” trialu | Niskie jako root-cause | Nie |
| H5 | Samo wejście na checkout tworzy SetupIntent — **nie** tworzy Subscription/trial | Wykluczone jako bezpośredni grant | Nie grantuje trialu |

**Stripe.js warnings** są osobnym, potwierdzonym problemem architektonicznym klienta (brak singletonu + remount Elements przy każdej zmianie intentu) i **nie** są root-cause grantowania trialu, ale pogarszają checkout i mogą zwiększać ryzyko dziwnych race’ów UI.

---

## 2. Mapa przepływu (as-is)

```text
[/plans] → [/billing/checkout/:plan?mode=trial|upfront]
                │
                ▼
     CheckoutStripeProvider (mount)
                │
                ▼  useEffect → POST /api/billing/create-subscription
                │
     ┌──────────┴──────────┐
     │ mode=trial          │ mode=upfront
     ▼                     ▼
 SetupIntent only     Subscription incomplete
 (client_secret)      + PaymentIntent secret
     │                     │
     ▼                     ▼
 PaymentElement        PaymentElement
     │                     │
     ▼ submit()            ▼ submit()
 confirmSetup          confirmPayment
     │                     │
     ├─► POST activate-trial
     └─► webhook setup_intent.succeeded
                │
                ▼
     activateTrialFromSetupIntent
     → subscriptions.create(trial_period_days: 7, default_pm)
                │
                ▼
     syncSubscriptionToOrg → organizations.*
                │
                ▼
     hasActiveBillingEntitlement / plan-summary / quotas
```

### Kluczowe pliki

| Rola | Plik |
|------|------|
| Eager intent na mount | `components/billing/CheckoutStripeProvider.tsx` |
| SetupIntent / incomplete sub | `pages/api/billing/create-subscription.ts` |
| Aktywacja trialu | `lib/billingActivateTrial.ts`, `pages/api/billing/activate-trial.ts` |
| Webhook | `pages/api/webhooks/stripe.ts` (`setup_intent.succeeded`, `customer.subscription.*`, …) |
| Projekcja statusu / entitlement | `lib/stripeBillingSync.ts`, `lib/billingEntitlement.ts` |
| Legacy Hosted Checkout | `pages/api/billing/checkout-session.ts` (**wciąż ma `trial_period_days`**) |
| Reconcile orphanów | `lib/stripeBillingReconcile.ts`, cron `pages/api/cron/stripe-billing-reconcile.ts` |
| UI Usage / „Trial · …” | `pages/api/billing/plan-summary.ts`, `components/settings/UsageSettings.tsx` |
| Stripe.js (server) | `lib/stripe.ts` (singleton OK) |
| Stripe.js (browser) | `CheckoutStripeProvider.tsx` + `pages/billing/checkout/[plan].tsx` (upgrade path) |

---

## 3. Ścieżki, które **nadają** trial / entitlement

### 3.1 Ścieżka kanoniczna (Elements + SetupIntent) — wymaga PM

`activateTrialFromSetupIntent` (`lib/billingActivateTrial.ts`):

- Wymaga `setupIntent.status === 'succeeded'`.
- Wymaga `payment_method` na SetupIntent (inaczej 409).
- Tworzy sub z `trial_period_days: 7` + `default_payment_method`.
- Idempotency key: `org-{orgId}-trial-activate-{checkout_attempt_id|setupIntent.id}`.

**Wniosek:** W tej ścieżce Stripe **zawsze** dostaje payment method. „Bez karty” po stronie Ranksmile oznacza zwykle: **karta/Link istniała w Stripe**, user tego nie wpisywał ręcznie.

### 3.2 Webhook `setup_intent.succeeded` — aktywacja bez kliknięcia „activate” w kliencie

`pages/api/webhooks/stripe.ts`:

```ts
case 'setup_intent.succeeded':
  if (metadata.checkout_mode !== 'trial') break;
  activateTrialFromSetupIntent(...)
```

Skutki:

- Nawet jeśli klient **nie** wywoła `/api/billing/activate-trial`, webhook i tak stworzy trial po udanym SetupIntent.
- To jest **feature** (recovery po redirect / crash UI), ale też **ukryta aktywacja**: wystarczy, że `confirmSetup` się uda (np. Link).

**Warunek nadal:** SetupIntent must succeed ⇒ PM musi być potwierdzony.

### 3.3 Legacy Hosted Checkout (`checkout-session.ts`)

Nadal dostępne API (używane w testach guardów / payment-lock allowlist; **brak** aktywnego calla z UI grep-em, ale endpoint żyje):

```ts
subscription_data: {
  ...(mode === 'trial' ? { trial_period_days: 7 } : {}),
}
```

Uwagi:

- Stripe Checkout Session w trybie subscription **domyślnie zbiera kartę** (nie ustawiono `payment_method_collection: 'if_required'`).
- Po `checkout.session.completed` webhook syncuje sub → przy `trialing` + PM grantuje plan.
- **Ryzyko residualne:** zewnętrzny klient / stary bookmark / skrypt / manual test woła ten endpoint.

### 3.4 Reconcile orphanów (`reconcileStripeBilling`)

Skanuje Stripe `incomplete` / `active` / **`trialing`** i jeśli sub ma `org_id` w metadata (lub customer map) → `syncSubscriptionToOrg`.

Skutek:

- Orphan `trialing` **z** PM → lokalny grant.
- Orphan `trialing` **bez** PM → lokalnie `incomplete`, `plan_slug=null` (dzięki `projectSubscriptionStatus`).

**Ryzyko:** stary sub z poprzedniej architektury (gdy trial tworzył się przed kartą) może nadal istnieć w Stripe; reconcile go „przywróci” do org.

### 3.5 Czego **nie** ma (potwierdzone grepem)

- Brak auto-trial przy signup / `ensureUserTenancy` / onboarding.
- Samo `create-subscription` w `mode=trial` **czyści** lokalnie: `planSlug=null`, `subscriptionStatus=null`, `trialEndsAt=null` (nie grantuje).
- Mock checkout (`stripeCheckoutEnabled=false`) tylko robi `router.push` na confirmation — **bez** zapisu billing w DB.

---

## 4. Gate „karta wymagana” — szczegóły

### 4.1 Projekcja statusu

`lib/stripeBillingSync.ts`:

```ts
if (status === 'trialing' && !subscription.default_payment_method) {
  return 'incomplete'; // lokalnie
}
```

Entitlement (`hasActiveBillingEntitlement`) **nie** daje dostępu dla `incomplete`.

Testy pokrywają to: `__tests__/lib/stripeBillingSync.test.ts`.

### 4.2 Luki gate’u

1. **Sprawdzane jest tylko `default_payment_method`.**  
   Nie: `default_source`, invoice PM, customer’s invoice_settings.default_payment_method.  
   Jeśli Stripe kiedyś ustawi PM inaczej niż na polu sub.default_pm, projekcja może się rozjechać.

2. **`active` bez PM nie jest remapowane** do incomplete — grantuje `planSlug` (edge, raczej nie trial).

3. **`trialEndsAt` jest zapisywane zawsze** z `subscription.trial_end`, nawet gdy status lokalny = `incomplete`.  
   UI Usage pokazuje „Trial · …” tylko przy `subscriptionStatus === 'trialing'`, więc sam `trialEndsAt` nie powinien mylić — o ile status jest poprawny.

4. **Webhook aktywuje trial niezależnie od UI** po `setup_intent.succeeded`.

---

## 5. Eager checkout intent (ważne dla „bez akcji”)

`CheckoutStripeProvider` przy **mount** (i przy zmianie `planSlug|billing|mode`):

```ts
useEffect(() => {
  const checkoutAttemptId = crypto.randomUUID();
  fetch('/api/billing/create-subscription', { ... mode, checkoutAttemptId });
}, [planSlug, billing, mode]);
```

Skutki uboczne (nawet bez kliknięcia „Start trial”):

1. Tworzy Stripe Customer (jeśli brak) via `ensureStripeCustomer`.
2. Tworzy SetupIntent (trial) lub incomplete Subscription (upfront).
3. Woła `cancelDanglingCheckouts` — kasuje inne incomplete / cardless-trialing.
4. Ustawia `last_checkout_started_at`.
5. Przy każdej zmianie planu/okresu → **nowy** intent + remount `<Elements key={clientSecret}>`.

To **nie** grantuje trialu, ale:

- wygląda w Stripe Dashboard jak „aktywność billing”,
- generuje wiele SetupIntentów,
- potęguje ostrzeżenia Stripe.js,
- zwiększa powierzchnię race (Strict Mode podwójny mount w dev).

---

## 6. Ostrzeżenia Stripe.js (osobny bug UX/perf)

Komunikaty użytkownika (PL):

- wiele wystąpień konstruktora Stripe.js w jednej sesji → singleton,
- ładować Stripe.js wcześnie,
- Dynamic Payment Methods.

### Źródła w kodzie

**A. `CheckoutStripeProvider.tsx`**

```ts
const stripePromise = useMemo(
  () => (intent ? loadStripe(intent.publishableKey) : null),
  [intent],
);
```

- `intent` zmienia się przy każdym nowym SetupIntent/PaymentIntent.
- `loadStripe(pk)` *powinien* cache’ować po kluczu, ale remount `Elements` + nowe promise + Strict Mode często = warning „multiple instances”.
- Brak module-level singleton współdzielonego z innymi stronami.

**B. `pages/billing/checkout/[plan].tsx` (upgrade path)**

```ts
const stripe = await loadStripe(data.publishableKey);
await stripe.confirmPayment({ clientSecret, ... });
```

Druga ścieżka inicjalizacji poza Providerem.

**C. PaymentElement options**

```ts
wallets: { applePay: 'auto', googlePay: 'auto' }
layout: 'tabs'
```

Stripe rekomenduje Dynamic Payment Methods (Dashboard + mniej hardcode’owanych typów). Obecnie `create-subscription` dla trial wymusza `payment_method_types: ['card']` na SetupIntent — ogranicza DPM.

### Relacja do trialu

Stripe.js multi-instance **nie grantuje** trialu.  
Może jednak: pogarszać confirm, powodować podwójne submity / dziwne stany Elements, mylić debug.

---

## 7. False positives UI („wygląda jak mam Growth / trial”)

| Mechanizm | Plik | Efekt |
|-----------|------|--------|
| `DEFAULT_PLAN_SLUG = 'growth'` | `lib/planLimits.ts` | Free / nie-entitled nadal widzi nazwę **Growth** w summary |
| `planSlug` w summary gdy `!entitled` | `plan-summary.ts` | Używa default growth, ale `subscriptionStatus` powinno być null |
| Napis „Trial · …” | `UsageSettings` / `formatPlanStatus` | Tylko gdy `subscriptionStatus === 'trialing'` |

**Jak odróżnić false positive od prawdziwego trialu**

Sprawdź w DB `organizations` dla org:

- `subscription_status` — musi być `trialing` (nie `null` / `incomplete`)
- `plan_slug` — np. `growth`
- `trial_ends_at` — data
- `stripe_subscription_id` — `sub_…`
- `stripe_customer_id` — `cus_…`

W Stripe Dashboard:

- Subscription status `trialing`
- Default payment method **obecny / brak**
- Metadata: `checkout_mode=trial`, `setup_intent_id`, `checkout_attempt_id`

---

## 8. Hipotezy root-cause (do potwierdzenia danymi)

### H1 — SetupIntent + Link / saved card (najbardziej prawdopodobne)

1. User otworzył `/billing/checkout/growth?mode=trial`.
2. Mount utworzył SetupIntent.
3. Payment Element pokazał Link / zapisaną metodę.
4. User kliknął CTA (lub flow redirect) → `confirmSetup` succeeded.
5. Webhook i/lub `/activate-trial` utworzyły sub trialing z PM.
6. User pamięta „nie wpisywałem karty” = prawda subiektywnie, fałsz w Stripe.

**Weryfikacja:** Stripe → Customer → Payment methods; Events: `setup_intent.succeeded`, `customer.subscription.created`.

### H2 — UI false positive (Growth default)

**Weryfikacja:** `subscription_status` w DB ≠ `trialing`.

### H3 — Legacy / orphan

- Ktoś wywołał `POST /api/billing/checkout-session`.
- Albo stary `sub_` trialing w Stripe + cron reconcile.

**Weryfikacja:** Stripe events + `subscription.metadata.checkout_mode`; logi cron reconcile.

### H4 — Podwójna aktywacja

Klient + webhook — idempotentne; nie tworzy drugiego trialu przy tym samym attempt id, ale przy **różnych** `checkout_attempt_id` (remount / Strict Mode / zmiana planu) może powstać kilka SetupIntentów; `cancelDanglingCheckouts` sprząta incomplete, niekoniecznie udane trial z PM.

---

## 9. Lista luk / debt (priorytet dla naprawy)

### P0 — bezpieczeństwo produktu / trust

1. **Webhook aktywuje trial przy każdym `setup_intent.succeeded`** bez dodatkowej weryfikacji „user clicked Start trial” poza samym SetupIntent.  
   Rozważyć: aktywacja tylko z klienta **albo** tylko z webhooka (jedna ścieżka), + jawny flag `activation_requested` w metadata ustawiany dopiero przy submit.

2. **Brak twardego UX „card on file”** po aktywacji (confirmation czasem pokazuje `paymentMethodLabel: null` gdy brak invoice z expand PM).

3. **Legacy `checkout-session` z `trial_period_days`** — żywy endpoint; usunąć / zablokować / zunifikować z SetupIntent flow.

### P1 — eager side effects

4. **Tworzenie SetupIntent na mount** zamiast na klik „Start trial” / „Continue to payment”.  
   Samo wejście na stronę = Stripe customer + intent + dangling cleanup.

5. **Remount intent przy toggle planu/okresu** bez debounce / reuse.

### P1 — Stripe.js

6. **Brak singletonu** `loadStripe(pk)` na poziomie modułu współdzielonego przez checkout + upgrade.

7. **Hardcoded `payment_method_types: ['card']`** na SetupIntent vs rekomendacja Dynamic Payment Methods.

### P2 — projekcja / observability

8. Gate PM tylko na `default_payment_method`.

9. Brak audit logu „dlaczego org dostał trial” (source: client activate vs webhook; setup_intent_id; user_id).

10. Reconcile skanuje `trialing` orphans — dokumentować / guardy przeciw starym cardless trialom.

### P2 — UX copy

11. `DEFAULT_PLAN_SLUG=growth` myli free users.

---

## 10. Stripe.js — rekomendowany kierunek (nie wdrożone)

```ts
// np. lib/stripeBrowser.ts
import { loadStripe, type Stripe } from '@stripe/stripe-js';

let cached: Promise<Stripe | null> | null = null;
let cachedKey: string | null = null;

export function getStripeBrowser(publishableKey: string) {
  if (cached && cachedKey === publishableKey) return cached;
  cachedKey = publishableKey;
  cached = loadStripe(publishableKey);
  return cached;
}
```

- Używać w `CheckoutStripeProvider` i upgrade `confirmPayment`.
- Opcjonalnie prefetch `getStripeBrowser(pk)` w `_app` / layout checkout.
- Elements: nie tworzyć nowego `stripe={}` identity bez potrzeby; trzymać ten sam Promise.
- Dashboard Stripe: włączyć Dynamic Payment Methods; po stronie SetupIntent rozważyć usunięcie sztywnego `payment_method_types: ['card']` (gdy API na to pozwala dla setup).

---

## 11. Checklista weryfikacji na zepsutym koncie

Wykonaj w kolejności i zapisz wyniki (do decyzji o fixie):

### A. Baza (org użytkownika)

```sql
SELECT id, plan_slug, billing_period, subscription_status,
       trial_ends_at, stripe_customer_id, stripe_subscription_id,
       last_checkout_started_at, updated_at
FROM organizations
WHERE id = <ORG_ID>;
```

### B. Stripe Dashboard / API

1. Customer `cus_…` → lista PaymentMethods (czy jest karta / Link).
2. Subscription `sub_…` → status, `trial_end`, `default_payment_method`, metadata.
3. Events chronologicznie:
   - `setup_intent.created` / `succeeded`
   - `customer.subscription.created` / `updated`
   - `checkout.session.*` (czy w ogóle Hosted Checkout?)
4. SetupIntent powiązany: status, PM, metadata `checkout_attempt_id`, `user_id`.

### C. App logs

- `[stripe webhook] activate-trial …`
- requesty `POST /api/billing/create-subscription`, `POST /api/billing/activate-trial`
- cron `stripe-billing-reconcile` w czasie grantu

### D. UI

- Settings → Usage: czy napis dokładnie `Trial · … left`?
- Czy `/plans` blokuje re-checkout (`already on this plan`)?

### E. Devtools

- Ile razy `js.stripe.com` / ile warningów „multiple instances” przy jednym wejściu na checkout + zmianie monthly/yearly.

---

## 12. Proponowane kierunki naprawy (do dyskusji z ChatGPT — nie zaimplementowane)

### Fix A — „Trial tylko po świadomym submit + PM”

- SetupIntent tworzyć **przy submit** (lub po „Continue”), nie na mount.
- Jedyna aktywacja: webhook **lub** client (wybrać jedną).
- Po aktywacji wymusić sync i pokazać last4 karty na confirmation.
- Odrzucać aktywację jeśli PM brak (już jest) + alert w UI.

### Fix B — „Zamknąć legacy”

- Deprecate/remove `pages/api/billing/checkout-session.ts` albo wymusić ten sam SetupIntent contract.
- Cron: nie recoverować `trialing` bez PM (już lokalnie incomplete, ale można cancel w Stripe).

### Fix C — Stripe.js singleton + DPM

- Module singleton `getStripeBrowser`.
- Prefetch.
- Align payment method config z Dashboard DPM.

### Fix D — Observability

- Tabela / log `billing_activation_events` (org_id, source, setup_intent_id, subscription_id, at).
- Admin view: „granted by webhook at … with pm_…”.

### Fix E — UX clarity

- Free plan label ≠ Growth.
- Copy: „Saved card / Link will be charged after trial” przed confirmSetup.

---

## 13. Testy istniejące (co już chroni)

| Test | Co sprawdza |
|------|-------------|
| `__tests__/lib/stripeBillingSync.test.ts` | `trialing` bez PM → incomplete, bez planSlug |
| `__tests__/lib/billingActivateTrial.test.ts` | activate wymaga succeeded + PM |
| `__tests__/api/billing-guards.test.ts` | auth/guards na create-subscription / checkout-session |

**Braki testów:**

- Eager mount nie grantuje entitlement (integration).
- Webhook `setup_intent.succeeded` happy path.
- Reconcile nie grantuje cardless trialing.
- Singleton Stripe.js (trudny w unit; e2e).

---

## 14. Aneks: timeline typowego „fałszywego” poczucia

```text
t0  User otwiera checkout (mode=trial)
t1  create-subscription → SetupIntent (DB: plan wyczyszczony)
t2  Elements ładuje Link / zapisaną kartę (user: „nic nie wpisałem”)
t3  User klika Start trial / Enter
t4  confirmSetup → setup_intent.succeeded
t5  webhook/client → subscription trialing + PM
t6  UI: Trial · X left  |  User: „nie podpinałem karty”
```

Jeśli timeline **bez** t3/t4 istnieje w logach Events — wtedy szukać buga (auto-confirm) lub innego źródła (H3).

---

## 15. Pytania decyzyjne przed implementacją

1. Czy na zepsutym koncie w Stripe **jest** PaymentMethod na customer/sub?
2. Czy akceptujemy aktywację trialu przez sam webhook, czy tylko po jawnym CTA?
3. Czy SetupIntent ma powstawać na mount (szybszy Elements) czy dopiero przy CTA (mniej side effects)?
4. Czy Hosted Checkout (`checkout-session`) ma zostać uśmiercony?
5. Czy free tier ma przestawać wyświetlać „Growth” jako default label?

---

---

## 16. Appendix — observability (2026-08-03 diagnostyka)

Instrumentacja **bez** fixów produktowych (exempt `/billing/**`, DEFAULT_PLAN, Stripe.js singleton — Faza 3, po dowodzie).

### 16.1 Writers `updateOrgBillingState` (+ wyjątki)

Wszystkie ścieżki muszą podać `BillingAuditContext` (`source: BillingSource`, `reason`, opcjonalnie `correlationId`).

| Writer | Source | Typowe reason |
|--------|--------|---------------|
| `pages/api/billing/create-subscription.ts` | `CHECKOUT` | `mode=trial clear_entitlements_pre_setup`, `mode=upfront incomplete` |
| `lib/billingActivateTrial.ts` | `ACTIVATE_TRIAL` / `WEBHOOK_SETUP` | `activateTrialFromSetupIntent` (+ customer_link) |
| `lib/stripeBillingSync.ts` | z callera | sync sub / checkout session ids only |
| `pages/api/webhooks/stripe.ts` | `WEBHOOK_SUB` / `WEBHOOK_SETUP` | `customer.subscription.*`, `invoice.*`, `subscription.deleted.*` |
| `lib/stripeBillingReconcile.ts` | `RECONCILE` | `reconcile.tracked_subscription`, `clear_canceled`, `orphan_recover` |
| `lib/stripeCustomer.ts` | `STRIPE_CUSTOMER` | customer create |
| `lib/emails/runStarterNudgeCron.ts` | `STARTER_NUDGE` | nudge sent timestamp |

**Ledger bez `updateOrgBillingState`:** `emitBillingEvent` z create-subscription (`SETUP_INTENT_CREATED`), activate (`SETUP_INTENT_SUCCEEDED` / `TRIAL_ACTIVATED`), sync (`SUBSCRIPTION_SYNCED`), OnboardingGuard beacon + `POST /api/workspaces/setup` (`ONBOARDING_REDIRECT`).

Raw SQL lock/unlock w webhooku (`payment_failed_*`) **nie** idzie przez choke point — poza grantem planu.

### 16.2 OnboardingGuard — `/billing` nieexempt

W `pages/_app.tsx` auto-redirect do `/workspace/{id}/setup` gdy `workspaces.length === 0` exemptuje: `/plans`, `/setup`, `/`, onboarding, public — **nie** `/billing/checkout/*`.

Przy redirect: `logOnboardingRedirect` → console `[BILLING_EVENT]` + `POST /api/billing/audit-beacon` → wiersz `ONBOARDING_REDIRECT` w `billing_activation_events`.

### 16.3 Macierz Stripe × DB × UI

Po: checkout trial → **zero** kliknięć w Payment Element → czekaj na redirect:

| Stripe `sub_` trialing | DB `subscription_status` / `plan_slug` | UI „Trial/Growth paid” | Wniosek |
|------------------------|----------------------------------------|------------------------|---------|
| NIE | NIE (null/incomplete) | TAK | **UI / DEFAULT_PLAN / copy** |
| NIE | TAK (trialing + slug) | TAK | **App-side writer** — ledger `source` |
| TAK | TAK | TAK | **Stripe path** — SetupIntent/webhook/Link |
| TAK | NIE | TAK/NIE | Sync broken — `SUBSCRIPTION_SYNCED` / reconcile |
| NIE/TAK | TAK | NIE | Entitlement OK, inny symptom |

### 16.4 Event chain + `correlation_id`

`correlation_id` = `checkoutAttemptId` (UUID z body/response `create-subscription`) albo wygenerowany request id.

```text
SETUP_INTENT_CREATED
  → SETUP_INTENT_SUCCEEDED?
  → TRIAL_ACTIVATED?
  → SUBSCRIPTION_SYNCED
  → PLAN_CHANGED? / ENTITLEMENT_GRANTED?
(+ ONBOARDING_REDIRECT w tym samym oknie czasowym)
```

Każdy emit: `{ kind, source, reason, decision: ALLOW|DENY|SKIP|ROLLBACK, correlationId, orgId, … }`.  
`PLAN_CHANGED` + stack tylko przy realnej zmianie plan/status; no-op → `decision=SKIP`.

Env: `BILLING_AUDIT_LOG=1` (domyślnie on poza production).

Tabela: `billing_activation_events` (`lib/ensureBillingTables.ts`).

### 16.5 Protokół reprodukcji → jedno źródło prawdy

1. DevTools Network: `POST /api/billing/create-subscription` → skopiuj `checkoutAttemptId` z request/response.
2. Checkout trial, **zero** submit Payment Element; pozwól na redirect (jeśli nastąpi).
3. Query ledger:

```sql
SELECT at, kind, source, reason, decision, old_plan_slug, new_plan_slug, old_status, new_status,
       stripe_subscription_id, stripe_setup_intent_id, meta
  FROM billing_activation_events
 WHERE correlation_id = '<checkoutAttemptId>'
 ORDER BY at ASC;
```

4. Równolegle: Stripe Dashboard (czy jest `sub_` trialing + PM) oraz DB org (`subscription_status`, `plan_slug`).
5. Mapuj na jedną przyczynę:

| Łańcuch | Przyczyna |
|---------|-----------|
| `SETUP_INTENT_CREATED` + `ONBOARDING_REDIRECT`, brak `PLAN_CHANGED` / brak `sub_` | Guard + UI false positive |
| `PLAN_CHANGED` / `ENTITLEMENT_GRANTED` z `source` ≠ webhook/activate, brak `sub_` | App grant |
| `SETUP_INTENT_SUCCEEDED` → `TRIAL_ACTIVATED` → `ENTITLEMENT_GRANTED` + `sub_` | Stripe path |
| Stripe `sub_` TAK, DB NIE, ledger ma `SUBSCRIPTION_SYNCED` SKIP/incomplete | Sync gap |

Sukces diagnostyki = **jedna** przyczyna z tej listy — nie zgadywanie z trzech niespójnych logów.

---

*Appendix observability dopisany wraz z instrumentacją. Fixy produktowe (Faza 3) poza tym PR.*
