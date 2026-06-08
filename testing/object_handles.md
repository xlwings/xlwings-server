# Object Handles — Manual Excel Verification Checklist

Manual checks that exercise the object-handle behavior that can't be covered by the
automated test suite (the real Office.js Entity round-trip in Excel). Each item maps to a
specific mechanism, noted in _italics_, so a failure points at the code to look at.

## Setup

- [ ] Run the dev server against the **local** xlwings: `make serve-dev`. This links
      `../xlwings`, which has the coupled core changes (`ObjectHandle`,
      `ObjectCacheMissError`, the `ObjectHandle[T]` extractor). A plain `make serve` uses
      released xlwings and will misbehave.
- [ ] Sideload the add-in and reload the task pane so the latest static JS + Python load.
- [ ] Functions are namespaced. In **dev** they are `XLWINGS_DEV.GET_DF`, etc. — adjust
      the prefix to your environment/namespace below.
- [ ] Keep the task pane devtools console open; errors in the argument-rewrite JS surface
      there.
- [ ] Run on **desktop Excel** (Windows or Mac) first, then repeat the starred (★) items
      on **Excel on the web**, where behavior differs.

## 1. Produce a handle + the card (the rename / hiding fix)

- [ ] `=XLWINGS_DEV.GET_DF()` → cell shows an **object-handle card** (icon + text).
- [ ] ★ Open the card. It shows `Type`, `Shape`, `Columns`, `Index` — and **must NOT show
      `object_handle_cache_key`**. _(`excludeFrom.cardView` — the originally reported bug.)_
- [ ] `=FIELDVALUE(A1, "object_handle_cache_key")` (A1 = the `GET_DF` cell) → returns
      **`#FIELD!`** (field not retrievable), not the UUID. _(`excludeFrom.dotNotation` — the
      `#FIELD!` error is the pass condition here.)_

## 2. Resolve a handle as an argument (round-trip + `ObjectHandle[T]`)

- [ ] `=XLWINGS_DEV.VIEW(A1)` → spills the DataFrame values. _(Handle resolves;
      `ObjectHandle[object]` delivers the object.)_
- [ ] `=XLWINGS_DEV.DF_QUERY(A1, "A > B")` → returns the filtered rows.
      _(`ObjectHandle[pd.DataFrame]` resolves and `df.query` runs on a real DataFrame.)_

## 3. The bugs this redesign fixes (the headline wins)

- [ ] **Temporary**: `=XLWINGS_DEV.VIEW(XLWINGS_DEV.GET_DF())` (nested, no intermediate
      cell) → spills values. _(Old design: failed — no producing-cell address.)_
- [ ] **`=A1` copy**: put `=A1` in B1 (A1 = a `GET_DF` card), then `=XLWINGS_DEV.VIEW(B1)`
      → resolves the same object. _(Old design: broke.)_
- [ ] **Copy/paste by value**: copy the `GET_DF` cell, Paste Special → Values into C1, then
      `=XLWINGS_DEV.VIEW(C1)` → resolves correctly; no phantom, no stale-occupant reuse.
      _(Old design: broke.)_
- [ ] **Paste onto an old handle**: make a second handle in D1
      (`=XLWINGS_DEV.GET_HEALTHEXP()`), then paste-by-value the GET_DF card on top of D1.
      `VIEW(D1)` → returns the **pasted** object, not D1's prior occupant.

## 4. Per-object presentation (`ObjectHandle` wrapper)

- [ ] `=XLWINGS_DEV.GET_HEALTHEXP()` → card shows the `table` icon and `healthexp` text
      (function-level `@ret`).
- [ ] Return `ObjectHandle(df, text=f"{len(df)} rows", icon=...)` from a function → the
      **per-call** text/icon appears, overriding any function-level default.

## 5. Expired-object card (expiry / eviction)

- [ ] Evict the cache. **Don't** leave `=XLWINGS_DEV.CLEAR_OBJECT_CACHE()` in a cell — as a
      custom function it re-fires on every recalc and wipes the cache continuously. Instead
      restart the dev server (the in-memory cache is per-process), or trigger the clear once
      from a button/script.
- [ ] Re-trigger a consumer of the evicted handle (recalc a `VIEW(A1)` pointing at it) → the
      cell shows a card with the **warning icon** and the text **"Expired object"**, not a
      `#VALUE!` error or a Python traceback. _(Central `ObjectCacheMissError` catch.)_
- [ ] ★ Open the card → its `Status` points at Excel's built-in recalc (**Formulas →
      Calculate Now**, or **Ctrl+Alt+F9** on the desktop). There's no custom refresh button:
      a button could only do a full recalc too, which Excel already provides everywhere.
- [ ] **Recover**: recalc the producing formula (re-enter `=GET_DF()`, or Ctrl+Alt+F9) → a
      fresh handle appears and consumers resolve again.

## 6. Foreign Entity rejected (the 3-way JS branch)

- [ ] Pass a non-xlwings entity into a handle argument — e.g. a **Stocks** data type:
      `=XLWINGS_DEV.VIEW(<a stock cell>)` → clear **"not an xlwings object handle"** error,
      not a crash. _(`__xlwingsNotAHandle` marker path.)_

## 7. Sharing / persistence

- [ ] Save, close, reopen the workbook → cards still **render** (persisted in the file)
      before any recalc.
- [ ] ★ **Sharing (default global keys)**: open the workbook on another machine pointed at
      the same server while the object is still cached → `VIEW(A1)` **resolves**.
      _(Portable-while-cached.)_
- [ ] **Partitioning (opt-in)**: only if `XLWINGS_OBJECT_CACHE_PARTITION_BY_USER=true` and
      two authenticated users — user B's `VIEW(A1)` gets an **"Expired object" card** instead
      of user A's object. _(Opt-in isolation.)_

## Notes / gotchas

- **`make serve-dev`, not `serve`** — otherwise you run released xlwings without the
  coupled core changes and behavior is confusing.
- **Production needs Redis** (`XLWINGS_OBJECT_CACHE_URL`). The dev in-memory cache is
  per-process and never purged; a worker restart wipes handles (a handy way to trigger the
  stale path in section 5).
- **`to_df`** expects a range, e.g. `=XLWINGS_DEV.TO_DF(E1:G6)`. Use an Excel **table** as
  the source to see it update dynamically as the table resizes.
- If section 1's card **still shows** `object_handle_cache_key`, suspect the Excel API
  version: `excludeFrom` needs **ExcelApi 1.16+**. Check the host's supported API set.
