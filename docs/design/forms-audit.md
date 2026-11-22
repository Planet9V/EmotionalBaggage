# Forms audit

Checked 2026-11-22 on branch `ws7-reuse`. Counts every `<form>` element under `src/` except the
folders other workstreams own (`src/lib/auth2`, `src/app/(account)`, `src/app/api/auth2`,
`src/components/status`, `src/app/status`, `src/components/welcome/scenes`) and the copied-in kits
(`src/components/ui`, `src/components/ai-elements`).

## The shared pattern

A conforming form:

- keeps its values in `react-hook-form` (`useForm`), checked by a zod schema through `zodResolver`;
- shows each field's problem beside the field: `<Field id=... error=...>` from
  `src/components/ui/field.tsx`, with `describe(id, { hint, error })` on the control so
  `aria-invalid` and `aria-describedby` point at the hint and the error;
- puts the server's refusal in `setError("root", ...)` and shows it below the fields
  (`ErrorLine`, `FormError` or the form's own alert line), keeping what was typed;
- submits through `handleSubmit`, so nothing is sent while a field is invalid and focus goes to the
  first invalid field.

Examples: `production/BatchDialog.tsx`, `compliance/ComplianceDialog.tsx`,
`economics/CostLineDialog.tsx`, `schematic/FirstConnection.tsx`. Tests: `tests/ui/forms.test.tsx`.

Where a control is not a plain input (the shared `WhyField`, a picker), it is wired with
`Controller`. `WhyField` takes an `error` and links its hint and error itself.

## Counts

| | Before | After |
|---|---:|---:|
| Forms (`<form>` elements) | 55 in 51 files | 55 |
| Conforming | 15 | 40 |
| Hand-wired | 40 | 15 |

The earlier audit's "51 forms" counted files.

## Every form

Size: S one or two fields and one check; M three to eight fields or a few checks; L more fields,
fields that depend on each other, a list of rows, or checks spread over several handlers.

| File | Form | Size | State |
|---|---|:-:|---|
| views/WizardView.tsx | the concept wizard | L | conforming |
| story/StoryEditor.tsx | story part | M | conforming |
| story/FilesView.tsx | paste a file | M | conforming |
| story/FilesView.tsx | edit a file entry | M | conforming |
| enclosure/PartOpeningEditor.tsx | opening on a part | L | conforming |
| printing/OwnSlicer.tsx | attach an own slice | M | conforming |
| printing/NewJobDialog.tsx | new print job | L | conforming |
| printing/ResultForm.tsx | print result | M | conforming |
| welcome/AccessRequestForm.tsx | access request | M | conforming |
| compliance/ComplianceDialog.tsx | compliance row | M | conforming |
| economics/CostLineDialog.tsx | cost line | M | conforming |
| production/BatchDialog.tsx | batch | M | conforming |
| schematic/FirstConnection.tsx | first wire | M | conforming |
| plan/AddStepForm.tsx | add plan step | M | conforming (own mono labels, not `Field`) |
| concepts/EditConceptDialog.tsx | edit concept | M | conforming (own mono labels, not `Field`) |
| schematic/PinDialog.tsx | name a pin | S | converted, batch 1 |
| process/OverrideDialog.tsx | override a gate | S | converted, batch 1 (own mono label) |
| process/ReasonDialog.tsx | optional why | S | converted, batch 1 |
| trace/movedToast.tsx | reason after a drop | S | converted, batch 1 |
| concepts/SmallDialogs.tsx | duplicate concept | S | converted, batch 1 (own mono label) |
| concepts/SmallDialogs.tsx | archive concept | S | converted, batch 1 |
| trace/HistoryEntryView.tsx | add a reason later | S | converted, batch 2 |
| items/AddItemDialog.tsx | add a row | M | converted, batch 2 |
| admin/SlicerSection.tsx | slicer address | S | converted, batch 2 |
| concepts/DeleteConceptDialog.tsx | delete concept | S | converted, batch 2 (own mono label) |
| sourcing/OfferForm.tsx | add an offer | M | converted, ws17 (path prefix dropped, wording kept) |
| layout/EnvelopePanel.tsx | create enclosure | S | hand-wired: decision needed (2) |
| production/PriceBreaksDialog.tsx | price breaks | M | hand-wired: list of rows |
| views/SocialView.tsx | compose post | M | converted, batch 3 |
| campaigns/PlanCard.tsx | marketing budget and rules | M | converted, batch 5 |
| campaigns/LinksView.tsx | tracked link | M | converted, batch 5 |
| campaigns/LaunchView.tsx | start a launch | M | converted, batch 4 |
| campaigns/ResultsView.tsx | enter a day's results | M | converted, batch 5 |
| campaigns/CampaignDialog.tsx | campaign | L | hand-wired: nine checks, money inputs |
| market/PersonasView.tsx | persona | M | converted, batch 3 |
| market/NamesView.tsx | add a name or tagline | S | converted, batch 3 |
| market/PositioningView.tsx | positioning line | M | converted, batch 6 |
| market/PricingView.tsx | price point | M | converted, batch 4 |
| market/CompetitorsView.tsx | competitor | L | hand-wired |
| channels/ReviewsView.tsx | add a review | M | converted, batch 4 |
| channels/ReviewsView.tsx | import reviews | L | hand-wired: file upload with column mapping |
| views/ResearchView.tsx | ask research | M | converted, batch 6 (own label) |
| views/MonitorView.tsx | sales entry | M | converted, batch 4 |
| views/bom/dialogs.tsx | part / import | L | hand-wired |
| items/ItemDrawer.tsx | edit a row | L | hand-wired: autosave per field |
| schematic/WireDialog.tsx | wire | L | hand-wired |
| decisions/DecisionEditor.tsx | decision with options | L | hand-wired: list of options |
| sourcing/PartCard.tsx | order status | M | converted, ws17 (path prefix dropped, wording kept) |
| admin/CredentialsTab.tsx | provider credentials | M | hand-wired: fields come from the provider |
| admin/ModelsTab.tsx | model choice | M | hand-wired: left (5) |
| admin/ModelsTab.tsx | planner address | S | converted, batch 3 |
| admin/PrintersTab.tsx | printer | L | hand-wired |
| three/PartPanel.tsx | part geometry | L | hand-wired: held file (knip list), another branch is changing it |
| app/sign-in/SignInForm.tsx | sign in | S | left: accounts workstream (WS2) replaces sign-in |
| app/account/ChangePassword.tsx | change password | M | left: accounts workstream (WS2) |

A hand-wired form with no note needs no decision: it was not reached in this pass and can be
converted the same way, starting with the M forms. Where a note names a reason (a list of rows,
autosave per field, a file upload with column mapping, fields that come from the provider), the
conversion needs `useFieldArray` or a per-field save and is a larger change than a batch.

## Needs a decision

1. ~~**OfferForm**~~ Done (ws17): each message of `offerSchema` now shows beside its field, without the
   `<field path>:` prefix, and every problem shows at once. The wording of the messages is unchanged.
2. **EnvelopePanel** uses `NumField`, which commits a number on blur and keeps its own text. The
   form has no messages: Create stays disabled until the three sizes and the basis are given.
   Moving it to `react-hook-form` means either a registered `NumField` or a different input that
   validates on submit, which changes how the size fields behave while typing.
3. **Mono labels.** The Concepts dialogs, OverrideDialog, AddStepForm and EditConceptDialog label
   their fields in the small mono capitals (`fieldLabel`), not in `Field`'s label style. They now
   keep their values in `react-hook-form`, but use their own label markup. Moving them onto
   `Field` changes how the labels look; that is a design decision, not a refactor.

4. ~~**PartCard's order status form**~~ Done (ws17): the same change as OfferForm (1), for `orderSchema`.
5. **ModelsTab's model choice** already uses `Field`, `describe()` and per-field messages, but its
   checks live in `check()`, which Test and Save share, and a provider choice or a preset rewrites
   several fields at once. Putting it on `react-hook-form` means changing how Test validates and
   how presets fill the form, which is more than a batch and is left for its own change.

## What changes for a user in a converted form

- A field's problem is shown beside the field (it was a line below the form in PinDialog and
  AddItemDialog, and in the history's Add reason), linked to it by `aria-describedby`, and the
  field is marked invalid.
- After a first failed submit, the message updates as you type (react-hook-form re-validates on
  change), instead of waiting for the next submit.
- Focus goes to the first invalid field on submit.
- Message wording, labels, buttons and what is sent are unchanged.
