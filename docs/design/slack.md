# Slack: specification

Owner instruction, 22 November 2026: "a capability for Slack for interaction, for admin and for users". Confirmed the same day: messages and actions; the assistant in the first version; fuller event lists with examples.

Slack is new to the app. It follows the deployment rule: Docker first; the Slack app's credentials and every setting are entered in the admin area and stored in PostgreSQL; nothing is blocked when Slack is not set up; shared components; every action audited; English only.

## 1. Pieces

| Piece | Who | What |
|---|---|---|
| Slack app credentials | platform administrator | Admin, Slack: client id, client secret, signing secret; a test action; the manifest to paste into Slack; the three addresses Slack calls (events, interactivity, commands) |
| Platform channel | platform administrator | One Slack workspace and channel for the service itself |
| Workspace connection | workspace owner or admin | "Add to Slack" from workspace settings; a default channel; optionally a channel per concept |
| Personal link | every person | Links their Slack identity to their account once; sets their own notification choices |
| Assistant | every linked person | Mention the app or use the command to ask about a concept |

## 2. Platform channel: events and actions

Each event can be switched on or off in Admin, Slack. Buttons act as the linked platform administrator and are refused for anyone else.

| Event | Example message | Buttons |
|---|---|---|
| Access request received | "New access request: Dana Whitfield, dana@example.com, level Maker. 'I have a bike-light idea and a 3D printer.'" | Approve and invite · Decline · Open |
| Sign-up waiting for confirmation (no mail server) | "Sign-up waiting: sam@example.com, 4 minutes ago. No mail server is set, so an administrator confirms." | Confirm · Disable · Open |
| Sign-up confirmed | "sam@example.com confirmed their address and created workspace 'Sam's workshop'." | Open |
| Workspace created or deleted | "Workspace 'Northside Makers' created by lee@example.com (plan Free)." | Open |
| Plan changed | "'Northside Makers' moved from Free to Maker (monthly)." | Open |
| Payment failed | "Payment failed for 'Northside Makers': card declined, $29.00. Stripe retries on 25 Nov." | Open in Stripe · Open |
| Subscription cancelled | "'Northside Makers' cancelled Maker; access ends 21 Dec." | Open |
| AI credits low or exhausted | "'Northside Makers' has used 90% of this month's AI credits (450 of 500)." | Open |
| Service check failing or recovered | "Mail server: test failed, 'connection refused' (smtp.example.com:587). Sign-ups now wait for an administrator." / "Mail server: working again." | Open Admin, Email |
| Sign-in throttled repeatedly | "12 refused sign-ins for lee@example.com from 3 addresses in 10 minutes." | Disable user · Open |
| Two-factor reset by an administrator | "Two-factor reset for lee@example.com by admin@oxot.nl." | Open |
| Platform administrator added or removed | "admin@oxot.nl made kim@example.com a platform administrator." | Open |
| Setting changed | "admin@oxot.nl replaced the Stripe secret key (ends 4x2Q)." Never the value. | Open |
| Daily digest (optional, one message) | "Yesterday: 3 sign-ups (1 waiting), 2 new workspaces, 14 concepts active, 0 failed payments, all services working." | Open |

## 3. Workspace channels: events and actions

Chosen per workspace, and per concept where a concept has its own channel. Buttons act as the linked person and are checked against their role in that workspace.

| Event | Example message | Buttons |
|---|---|---|
| Gate passed | "Baggage Claims MK1 passed the Concept gate (6 of 6). Next: Research, 1 of 2 checks met." | Open status |
| Gate overridden | "Jim passed the Design gate by override: 'firmware check waived for the first print'." | Open |
| Stage blocked or unblocked | "Design is blocked: the requirement 'Firmware sketch compiles' is marked blocked." | Open requirement |
| Decision waiting | "Decision waiting: 'Spend about $750 on the validation batch?' It opens Sourcing, 3D printing and Assembly." | Decide: Yes · Decide: No · Open |
| Decision made | "Jim decided 'Which name ships?': Baggage Claims." | Open |
| Claim verified or found wrong | "Claim found wrong: 'US novelty market was $32.7B in 2025'. The saved source says $28.4B." | Open claim |
| Open question added or answered | "New open question on Baggage Claims MK1: 'Will a talking tag pass airline rules?'" | Mark decided · Open |
| Positioning approved or sent back | "Positioning 'The bag that talks back' cannot be approved: no message has proof." | Open |
| Part changed, with what depends on it | "Speaker changed from 28 mm to 23 mm. Depends on it: enclosure grille, assembly step 4, unit cost." | Open part |
| Unit cost or margin crossed a line | "Unit cost at 5 units rose from $61.20 to $64.80; margin on Amazon FBA is now −$36.85." | Open economics |
| Print job started, finished or failed | "Print failed: 'Tag base, PETG' at layer 41 of 212 on Bambu P1S." | Open print job |
| Slicing finished | "Sliced 'Tag lid': 2 h 14 min, 38 g PETG." | Open |
| File added or replaced | "Jim added 'BuildGuide_RevB.pdf' to Files (replaces Rev A)." | Open |
| Draft ready for review | "The assistant drafted 6 requirements for Baggage Claims MK1. Nothing is applied until you accept." | Review drafts |
| Campaign or listing went live or was refused | "Amazon listing 'Baggage Claims MK1' is live." / "Listing refused: missing proof for 'lasts a full trip'." | Open |
| Reply or review received | "New Amazon review, 2 stars: 'Battery door is loose.'" | Draft a reply · Open |
| Mention or assignment | "Lee mentioned you on 'Which enclosure build?'" (sent to the person, not the channel) | Open |
| Member joined, left or changed role | "kim@example.com joined as member, invited by Lee." | Open members |
| Weekly summary (optional) | "This week on Baggage Claims MK1: 1 gate passed, 3 decisions made, 2 waiting, 1 print failed. Next: verify 8 claims." | Open status |

## 4. Interaction from Slack

- **Status:** `/c2r status baggage claims` or a mention, answered with the status page's headline, the seven stages and the next three actions, from the same functions the page uses.
- **Decide:** the buttons on a waiting decision, or `/c2r decide`. The reason is asked in a small dialog and recorded as it is in the app.
- **Add:** `/c2r question <text>` adds an open question; `/c2r note <text>` adds a note to the concept the channel belongs to.
- **Assistant (first version):** mention the app with a question about the concept. It answers in the thread from the concept's own rows and files, under the same rules as the in-app chat, cites the rows it used, and drafts changes only as drafts to accept in the app. It draws AI credits from the workspace, says so when they run out, and is off when no model is configured.
- **Administrator:** the buttons in section 2, plus `/c2r admin users waiting` and `/c2r admin services`.

## 5. Rules

- Every request from Slack is checked against the signing secret and a five-minute window; a repeated delivery is acted on once.
- A Slack user with no linked account can read nothing and do nothing; the reply offers the link.
- A workspace's Slack connection sees only that workspace. A concept's channel sees only that concept.
- An action from Slack passes through the same server function and the same role check as the button in the app, and is audited with the person and "from Slack".
- Tokens are stored as other credentials are. Disconnecting removes them and stops delivery.
- Messages never carry a secret, a password, a link that signs in, or a file's contents; they link to the page.
- Delivery failures are retried with a limit, shown on the workspace's Slack settings, and never hold up the action that caused them.
- Outgoing messages work on any install. Buttons, commands and the assistant need the app to be reachable from Slack; Admin, Slack shows whether it is.

## 6. Build order

1. Event catalogue and message builders, with a test for every row of sections 2 and 3 (Sonnet).
2. Admin, Slack and the platform channel, messages only (Sonnet to this specification; lead review).
3. Request checking, personal link, role checks and the buttons (lead tier; security review).
4. Workspace connection and channels (after accounts slice 2).
5. Commands and the assistant (after 3 and 4).
