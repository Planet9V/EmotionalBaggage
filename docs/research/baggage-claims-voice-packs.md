# Baggage Claims MK1: voice packs and holiday packs

An evaluation of packs as a product line, kept general, as asked on 22 Nov 2026. Prices and costs are estimates and say so. The short version: packs are worth doing. They cost little to make, they give buyers a reason to come back and shops something new without new hardware, and the hardware in the documents already switches between them. Start with a holiday pack and the New York pack.

## The New Yorker pack

**Persona.** A suitcase that has been through every terminal in the city and has somewhere to be. It talks fast, it is blunt, it has an opinion about the pace of everything, and under the impatience it is fond of its owner. The joke is the city's hurry and its pride, played with affection: a character, not a caricature of any group of people, with no put-on ethnic accent.

| moment | sample line |
|---|---|
| Hard impact | Hey! I'm rollin' here! |
| Weigh-in | Fifty-one pounds? In this economy? |
| Handle grab | Alright, alright, let's go. I got places. |
| Free-fall | This is why I take the train. |
| Carousel | Third lap. I've had shorter commutes. |
| Conveyor | This belt's slower than the crosstown bus. |
| Upside down | I've had worse on the subway. |
| Dark hold | Too quiet. I can't sleep without traffic. |
| Overhead bin | You call this a studio? I've lived in smaller. |
| Lost-luggage wait | I'm not lost. Everybody else is lost. |

**The name.** "New Yorker" as a word for someone from New York is fine for the character. It is also the name of a magazine and a registered mark, so a pack or a listing titled "New Yorker" could be read as the magazine's, and should keep well away from the magazine's look. This has not been checked with anyone; it is an unverified claim in Research. Two other names: **New York Minute** (recommended: it says fast and impatient, which is the joke) and **Big Apple Attitude**. "I'm rollin' here" plays on a famous film line; it is a new line, not a quotation, and worth a second look before it ships.

## More packs

In the box: **Family Friendly** and **Salty** (the naming note's Coach and Premium Sass). Your documents put a third pack, New Yorker, on the same card; your ruling of 22 Nov names it among the packs to purchase, so it is treated here as the first pack sold. Further ideas:

### Holiday Heckler

For: year-end gifting. The bag has been re-gifted twice and is over the holidays.

- It's fruitcake. All of it.
- Careful! There are presents in here. For me.
- Silent night. Very silent. Too silent.
- Round and round. Like the family stories.

### Summer Breakdown

For: summer travel. Sunburnt, sandy, and carrying a wet swimsuit it did not ask for.

- I'm forty percent sand now.
- I didn't get a tan. I got a scuff.
- Wet swimsuit. In me. For six hours.
- Flip-flops again? Read the room.

### Group Trip

For: stag and hen trips, reunions; the documents' Bachelor Party Layover. The bag that remembers everything and has agreed to say nothing.

- What happens in the bag stays in the bag.
- Matching shirts. I'm carrying eleven.
- I have receipts. Literally. In the side pocket.
- Nobody here is fit to carry me.

### Just Married

For: wedding gifts and honeymoons. Sentimental, and convinced the trip is about it.

- Two of you now. Still one of me.
- Honeymoon weight doesn't count.
- I caught the bouquet. It's in my lid.
- Carry me over the threshold. I'll wait.

### Road Warrior

For: corporate gifting and frequent flyers. Speaks fluent office, with the passive aggression left in.

- Per my last bump.
- Let's take this offline. Off the belt.
- I'll circle back. It's a carousel.
- This could have been a carry-on.

### Are We There Yet?

For: family trips; a pack for all ages. A small, excitable bag on its first big trip.

- Are we there yet?
- Again! Again! One more lap!
- I packed my own snacks. They're crushed.
- I can see the plane! Is that our plane?

### International

For: travellers abroad; the documents' stretch-goal pack. The same deadpan complaints in several languages, each recorded by a speaker of that language, with no put-on accents.

- Doucement, s'il vous plaît.
- ¡Ay! Con cuidado.
- Vorsicht. Ich bin empfindlich.
- Even rustig aan, zeg.

### Worst Flight Story

For: once a year; the documents' contest pack. A real traveller's true story, retold by the bag as if it happened to the bag.

- Nine hours. On the tarmac. I counted.
- They sent me to the wrong city. Twice.
- My person slept. I did not sleep.
- I'd like that in writing.

Every pack keeps the house rules in `docs/design/baggage-claims-lines.md`: the bag is the butt of the joke, nothing about security, nothing built on a stereotype. A character voice is a character; the International pack is recorded by speakers of each language and uses no put-on accents.

## How a pack reaches the unit

The documents' hardware plays MP3 clips from a microSD card through an audio module. Packs are folders on the card (`/01`, `/02`, `/03`), each with numbered clips (`0001.mp3` upward), and a long press of the button moves to the next folder. So a pack is a folder of clips.

- **Least effort for the buyer: a card.** The pack arrives on a card with the packs already owned copied alongside; the buyer swaps the card. Nothing to install.
- **A download.** The buyer copies one folder onto the card with a computer and a card reader. Cheaper and instant, and more work; for buyers who are comfortable with it.
- **Both need** the card to be reachable without tools, which is a requirement on the tag's design.

What the firmware needs, written here as requirements for WS14 to implement:

1. **Find packs it has never seen.** On start, ask the audio module how many folders the card holds and cycle through all of them on a long press, not a fixed three.
2. **Say which pack is on.** Each folder holds one reserved clip that speaks the pack's name; play it after a long press.
3. **One clip-number plan for every pack.** A fixed range of numbers per moment (for example ten per moment), so every pack answers the same moments and firmware never needs to know a pack's contents.
4. **Fall back.** If a pack has no clip for a moment, play the first pack's.
5. **Remember the choice** across power-off.
6. **Leave room.** Number ranges reserved for moments added later, so an older pack still works on newer firmware.

Whether the unit could take a pack over its USB socket, with no card reader, is a question for WS14; it would make the download as easy as the card.

## How packs are sold

- **The product's own site, with Stripe.** A pack store: a download or a card by post; packs offered at checkout beside the unit; a gift option with a message; a free first pack when a unit is registered; a free pack as a referral reward.
- **The Amazon marketplace.** A card as its own listing beside the unit, and a bundle of the unit with a pack for the gifting season. Downloads stay on the product's own site.
- **Bundles.** The unit with a holiday pack at year end; three packs for the price of two.
- **Shops.** A new pack gives a gift shop something new to put beside the unit.

## What a pack costs to make

- **Writing.** About eighty lines covers the eight moments with alternates; the documents plan 128 clips a pack.
- **A generated voice** through this app's voice settings, where Kokoro (run on your own machine) and OpenRouter are the two options: a few dollars of generation at most, plus about a day to pick takes and level them. Estimate: about $5 a pack beyond the time. Whether a generated voice may be sold inside a product depends on the model's and the voice's terms, which nobody has read for this use (an unverified claim in Research).
- **A voice actor**, the alternative your documents prefer: an estimate of $300 to $800 a pack for about a hundred short lines with a buy-out and a signed release. Not quoted. Funnier timing, clean rights, and a voice nobody else has.
- **A card:** about $0.50 in your documents; unverified.

## Rough prices (estimates, not tested)

| what | price | rests on |
|---|---|---|
| A pack on a card | $7.99 | your documents |
| A pack as a download | $4.99 | nothing to post; small paid add-ons in general |
| The unit with a holiday pack | $32.95 | the Amazon price plus most of a pack |
| Three packs | the price of two | a common bundle shape |

## Risks

- **Names.** "New Yorker" and the magazine, above. Holiday packs should use plain season names, not the names of trademarked events.
- **A real person's voice.** No celebrity impressions, in any pack (your documents' rule). A generated voice must not copy a real person's.
- **Borrowed lines and sounds.** Film quotations and stock sound effects need clearing; write new lines instead.
- **Stereotypes.** A city or a language is a setting, not a target. The International pack is the one to watch.
- **A pack for children.** Selling it as a children's product brings children's product rules; "Are We There Yet?" is a family pack for all ages.
- **Old packs on new firmware.** Solved by the clip-number plan above, if it is fixed before the first pack is sold.

## In the app

Entered by the batch of 22 Nov: the decision that packs are sold (Concept, Open questions, quoting your words); the line-up as a name candidate; the card and download prices and the holiday bundle as draft prices; the cost to make as an estimate in Unit economics; a campaign for packs through the year; the pack channel in Sales; and the two claims above, unverified.
