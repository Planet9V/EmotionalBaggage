# Baggage Claims: voice script of the welcome film

Status: written 22 November 2026 (workstream WS12); performance section rewritten the same day (WS18) after the owner's verdict on the first clips. The data is `src/components/welcome/scenes/voiceScript.ts`; this page is the reasoning, the alternatives and what the owner still has to confirm. The owner's brief: "We have to have voice on the introduction and gag reels; it must be animated and funny."

**Whether it is funny is not verified.** Every clip below was chosen by measurement (length against its subtitle, a clean start and end, loudness, and two speech recognisers hearing the words). Nobody has listened to them for comedy. That is the owner's call, in a browser, with the sound on.

## 1. The introduction (before scene 1)

Spoken by the narrator over the drawn frames of the scenes, once per visit, when the visitor first turns the sound on. It can be skipped, and its words are under the film as a transcript.

**Chosen: A (for the owner to confirm).** 20.8 seconds as generated.

| # | Line | Whose words |
| --- | --- | --- |
| 1 | It started as a joke. | This page's own section title ("It started as a joke: the worked example"), not the owner's. |
| 2 | A quick gag: a device that goes on luggage that is the comedic relief of all the airport luggage moments of absurdity. | The owner's, from his first-idea note ("I have an idea for a quick gag and potential quick buck - I wan to make a device that goes on luggage that is the comedic relief of all the airport luggage moments of absurdity"). Only "A" and the colon are added; "potential quick buck" and "I want to make" are left out. |
| 3 | It knows when it's being weighed. | The owner's, launch video script at 0:18. |
| 4 | When it's being thrown. | The owner's, launch video script at 0:18. |
| 5 | When it's been upside down in the dark for four hours. | The owner's, launch video script at 0:18. |
| 6 | And it is NOT happy about it. | The owner's, launch video script at 0:27 (the host's line, his capitals). |

About 95 per cent of the words are the owner's. The direction: a documentary narrator who takes the subject entirely seriously (warm, unhurried, British), as if describing wildlife; the three "when" lines shorten and quicken, and the last line slows right down and hands over to the bag.

**Alternative B: the bag introduces herself** (about 15 seconds, the bag's voice; not generated).

> Hi. I'm luggage. I get weighed, thrown, and left upside down in the dark for four hours. And I am NOT happy about it. So now I say so.

Owner's words: "weighed", "thrown", "upside down in the dark for four hours", "NOT happy about it" (launch script); the rest is new. Funnier on paper because the complainant speaks for herself, but it spends the bag's first line before scene 1, where her "Whoa whoa whoa" is meant to be the first thing she says.

**Alternative C: the host, as in the launch script** (about 18 seconds, the host's voice; not generated).

> Every bag has been through it. Weighed. Thrown. Upside down in the dark for four hours. Now one of them talks back. It knows when it's being weighed. And it is NOT happy about it.

Owner's words: the last two sentences and "upside down in the dark for four hours"; the opening is new. Closest to the launch video, but the host is the straight man inside the scenes, and giving him the set-up as well leaves no one outside the joke.

The launch script's line "Three double-A batteries" is not used anywhere in the voice-overs. The owner has since ruled the device uses two AA cells; no spoken line or subtitle mentions batteries.

## 2. Every spoken cue, and how it is performed

The words are exactly the subtitles of `scenes.ts`, and they are never respelled. The data is `src/components/welcome/scenes/voiceDirections.ts`; every cue has two forms of the same performance:

- **Direction**: what a voice director would say to an actor: the character's state and intention, the pace, where each pause lands and how long it is, which word carries the stress and how (pitch up, drawn out, clipped, cracking, a gasp, a sigh, a sniff, deadpan), the volume, and what must not happen. Sent beside the text to a model that takes instructions (OpenAI's mini TTS, and any OpenRouter speech model that lists an `instructions` parameter). It is never put into the spoken text.
- **Bracket cues**: the subtitle with short delivery cues in square brackets, for a model that reads them as directions rather than speaking them (Fish Audio S2). With the brackets taken out the line is the subtitle word for word; the tool refuses any edit that changes a word, and `tests/voice/track.test.ts` holds the script's own cues to it.

How each model is reached is decided from what the model lists at run time (section 3a). A model that takes no direction (Kokoro) is sent the plain subtitle.

### Why the text shaping was dropped

The first pass shaped the spoken text for Kokoro, which has no emotion control: "FAT" sent as "fat" because Kokoro spells capitals letter by letter, "Wheeee" sent as "Whee", commas and ellipses added to force pauses. The owner's verdict on those clips: "Voice clips are not realistic, I need better emotion, and you have to be aware that your pronunciation is NOT the way it sounds to be funny." He is right. A respelling changes how a word is read, not how it is meant: lower-casing FAT removed the one thing the capitals were there for, the shriek. Comedy lives in delivery (the pause before the punchline, the stress, pitch, attitude, a breath, a crack in the voice), and only a model that can be directed can give it. So the words stay as the owner wrote them and the performance travels as a direction. The one reading fix left is for Kokoro drafts only: words in capitals are sent as ordinary words, so it does not spell them out; that is labelled in the tool as a draft, not a performance.

### The character of each speaker

Put in front of every direction of that speaker (Admin, Voice-overs can change it per speaker). The bag's comes from the lines document's house rules and the launch script's casting note ("BAG (VO, sassy, high comic energy)").

| Speaker | Character note |
| --- | --- |
| The bag | You are the suitcase: a put-upon, dramatic, vain diva of a bag, sorry for herself, sassy, with high comic energy. A bright American woman's voice with a wide pitch range. You complain to whoever is in earshot and never about them. Play every line as a real person who is genuinely offended or genuinely delighted, never as someone reading a joke; the comedy is in the timing and the attitude, not in funny voices. |
| Agent | You are a check-in agent near the end of a long shift: polite, professional, entirely deadpan. You have not noticed that a suitcase just spoke. |
| Host | You are the traveller, in his thirties, deadpan and dry. You have lived with this suitcase for a while and you have lost every argument with her. |
| Stranger | You are a passer-by at the baggage carousel, warm and spontaneous, who has just heard a suitcase talk and wants one. |
| Narrator | You are a nature-documentary narrator: British, warm, grave and completely sincere, describing a newly discovered creature. You are never in on the joke. |

### The cues

The window is the time the subtitle gives the line before the next line or the end of the scene; every pause in a direction is sized to fit it.

#### `intro` (Narrator, window none s)

Direction: Read it as natural history. "It started as a joke." measured and level, then a full beat of silence. The long second sentence unhurried and weighty, as if describing a rare animal; a faint relish on "absurdity". The three "when" lines build: each one shorter and quicker than the last, a short beat between them. Then a long pause, about three quarters of a second, and "And it is NOT happy about it." slower and lower, with real gravity: "NOT" is a firm, drawn-out, lower note, the weight of the whole film on it, not a shout. Do not spell NOT, do not shout it, do not smile audibly or wink, do not sound like an advert, and do not rush the pauses.

Bracket cues: `[warm, grave, sincere] It started as a joke. [beat] A quick gag: a device that goes on luggage that is the comedic relief of all the airport luggage moments of absurdity. [beat] [building] It knows when it's being weighed. When it's being thrown. When it's been upside down in the dark for four hours. [long pause] [slow, low, grave] And it is NOT happy about it.`

#### `handle-dinner` (The bag, window 4.50 s)

Direction: She was dozing on the curb and is suddenly hoisted by the handle without a word. First alarm, then scandalised manners. Three "whoa"s about a third of a second apart, each higher and faster than the last, the third nearly a squeak. Then half a second in which she collects her dignity, with a small indignant intake of breath. "are you gonna buy me dinner first?" comes down in pitch, slower, arch and pointed: the stress is on "dinner", stretched a little with a scandalised lift; "first" falls away, tossed off. The whoas loud, the question at normal level. Do not read the whoas flat or alike, do not pause between them, do not shout the question, do not stress "first", and do not make it flirtatious: it is affronted propriety.

Bracket cues: `[startled, each one higher] Whoa whoa whoa — [indignant intake of breath] [arch, pointed] are you gonna buy me dinner first?`

#### `scale-fat` (The bag, window 2.80 s)

Direction: Perfectly still on the scale, she has just read the number before anyone else. She gives them one chance to take it back. "Are you..." low, slow and quiet, almost a whisper of disbelief; the dots are a held breath. About half a second of silence. "calling me" quicker and tighter, rising. Then a sharp half-second gasp, and "FAT?" as a wounded shriek: one syllable, high and loud, cracking at the top, held a little, as if she has been slapped. Whisper, then normal, then the loudest moment of her scene. Do not spell the letters F-A-T, do not say it calmly or flatly, do not laugh, and leave no pause after it. The joke is the distance between the quiet start and the shriek.

Bracket cues: `[quiet, slow disbelief] Are you... [beat] [tighter, rising] calling me [sharp gasp] [wounded shriek, voice cracking] FAT?`

#### `scale-limit` (Agent, window 1.60 s)

Direction: The twelfth overweight bag of her shift. She did not notice the suitcase spoke and answers as if the traveller had. Brisk, flat, polite customer-service register, even pitch, falling at the end; at most a faint stress on "limit". Normal volume, close to the microphone. No pause before or inside the line, and done in under a second and a half. Do not react to the bag, do not smile or sound amused or surprised, and do not rise at the end.

Bracket cues: `[flat, brisk, bored] Sir, the bag is over the limit.`

#### `scale-host` (Host, window 1.50 s)

Direction: He does not look up. He has had this argument at home and lost, and he is glad to pass it on. A small tired breath out through the nose, then the line low, dry and falling, a little under his breath. The stress is on "her", as in the boss, with only a slight tilt. A little quieter than the agent. Do not make it a joke, do not laugh, do not sell "her", and finish inside a second and a half.

Bracket cues: `[tired exhale] [dry, under his breath] Take it up with her.`

#### `toss-ow` (The bag, window 6.38 s)

Direction: She has been thrown through the air and slammed onto the belt. First pure reflex, then wounded dignity. "OW!" is a sharp, loud, high yelp on the impact, instant and short, like a stubbed toe: one syllable, a noise rather than a word. Then nearly a second of stunned silence while she takes stock, with a small shaky breath in. "...I felt that in my flip-flops." small, quiet, slightly trembling and offended, slow, as if checking for damage; "flip-flops" dropped flat and deadpan, because the injury is to what she is carrying. Do not stretch the OW into "owww", do not sound like someone really hurt or in danger, do not shout the second half, and do not wink at "flip-flops".

Bracket cues: `[sharp yelp] OW! [stunned pause, shaky breath] [small, wounded, deadpan] ...I felt that in my flip-flops.`

#### `hold-hello` (The bag, window 4.60 s)

Direction: Hours in the dark hold; she has just woken, small in a huge empty room. Hoping someone is there, then pretending she never cared. "Hello?" soft, sleepy and hopeful, a little croaky, rising. About a second of silence: nobody answers. "...Anyone?" quieter and smaller, rising less. Another second of silence. "...Cool, cool." too quick and too casual, a brittle brightness, the second "cool" a touch lower: she is not cool. A short beat, then "I'll just be here." flat and resigned, trailing off to herself. Quiet throughout, each phrase quieter than the last, close to the microphone. Do not rush the silences (they are the joke), do not shout, do not sound frightened or in trouble (she is sulking, not in distress), and do not end on a rise.

Bracket cues: `[soft, sleepy, hopeful] Hello? [long pause] [smaller] ...Anyone? [long pause] [too casual, brittle] ...Cool, cool. [beat] [flat, trailing off] I'll just be here.`

#### `hold-dark` (The bag, window 2.50 s)

Direction: The afterthought that is the whole complaint, aimed at whoever left her there. A small sniff, then three words, slow, low and deadpan, the lowest pitch she uses in the film, set down like a verdict, with only a hair of space between them. Quiet and close, no louder than "I'll just be here". Do not chop it into three spoken full stops, do not get loud or angry, and no spooky horror whisper: it is a sulk.

Bracket cues: `[small sniff] [low, slow, deadpan] In the dark.`

#### `carousel-whee` (The bag, window 4.60 s)

Direction: On the carousel, coming round the bend; every bit of dignity from the earlier scenes is gone. Pure childish delight, and she wants another go. "Wheeee!" a long gleeful squeal rising through the bend, about a second, like a child on a fairground ride, a laugh breaking into the end of it. A quick delighted breath. "Again! Again!" fast and bouncing, the second higher and louder than the first, nearly begging. Loud and bright: the happiest she sounds. Do not say "whee" as a short read word, do not split it into two syllables, do not sound sarcastic, and do not slow the agains down.

Bracket cues: `[gleeful squeal, rising] Wheeee! [delighted laugh, quick breath] Again! [higher, begging] Again!`

#### `carousel-stranger` (Stranger, window 2.50 s)

Direction: A passer-by who has just realised the suitcase is the one talking, and wants one now. Quick, warm, genuinely delighted and a little envious, half laughing; the pitch rises through the line and the stress lands hard on "GET", pitched up and slightly stretched: I need to know. A raised voice that carries across the hall. Do not sound like an advert or a cue line, do not be sarcastic, do not stress "that", and finish inside two seconds.

Bracket cues: `[delighted, half laughing] Where did you GET that?`

#### `button-souvenirs` (The bag, window 5.00 s)

Direction: Back on the scale; she reads the display herself. Disbelief, then a defence she has clearly rehearsed. "Sixty-two pounds?" slow, each word weighed, rising in scandalised disbelief, "pounds" drawn up high. Then about a second and a half of silence while she scrambles for an excuse (a small thinking "hm" is fine, no words). "That's mostly" quick, prim and matter-of-fact, a tiny lift, then "SOUVENIRS." hit hard and proud on its first syllable, slightly over-enunciated, a full stop: case closed. Medium volume, the last word loudest. Do not rush the gap, do not make "souvenirs" a question, do not spell it, and do not sound embarrassed: she is indignant, and the excuse is worse than the charge.

Bracket cues: `[slow, scandalised disbelief] Sixty-two pounds? [long pause, thinking] [prim, quick] That's mostly [proud, emphatic] SOUVENIRS.`

#### `button-host` (Host, window 1.90 s)

Direction: The last word of the film. He nods before he speaks. A beat of silence, a short resigned breath out, then the line low, level and slow, almost fond, falling at the end, a light stress on "not". Quiet, under his breath. Do not make it a punchline, do not laugh, do not raise the pitch, and keep the silence in front under half a second so the clip fits its 1.9 seconds.

Bracket cues: `[beat, resigned exhale] [low, dry, almost fond] ...She's not wrong.`

### The bag's lines for the voice packs

The three lines marked ★ for each sensed moment in `docs/design/baggage-claims-lines.md`, directed the same way so packs can be made from them later (`PACK_DIRECTIONS` in the same file; shown read-only in Admin, Voice-overs). The bag's character note applies to all of them; the dark-hold lines are recorded quiet (house rule 7).

| id | Moment | Line | Direction | Bracket cues |
| --- | --- | --- | --- | --- |
| IMP-01 | Hard impact | That's one. I'm keeping count. | Winded from the hit, then icy. "That's one." low and clipped, through her teeth, straight after a small grunt of impact. A half-second pause. "I'm keeping count." slow and pointed, quietly menacing, like a schoolteacher writing a name on the board. Do not shout and do not laugh; the threat is in how calm it is. | `[winded grunt] [clipped, through her teeth] That's one. [beat] [slow, quietly menacing] I'm keeping count.` |
| IMP-02 | Hard impact | Ow. No, no. Don't get up. | "Ow." small and flat, a sore wince rather than a yelp. Then mock politeness dripping with sarcasm: "No, no." quick and airy, "Don't get up." slow and sweet, a passive-aggressive host at a dinner party. Stress on "up". Do not sound really hurt, and do not get loud. | `[flat wince] Ow. [airy, sarcastic] No, no. [sweet, passive-aggressive] Don't get up.` |
| IMP-03 | Hard impact | Fragile was a suggestion, apparently. | Dusting herself off with weary disdain. "Fragile" drawn out with a sniff of contempt; "was a suggestion" dry; a tiny pause; "apparently." dropped flat and deadpan, as an aside. Understatement: no anger, no volume. | `[weary disdain] Fragile was a suggestion, [beat] [deadpan aside] apparently.` |
| WGH-01 | Weigh-in | It's water weight. | Quick, defensive, a little too fast, before anyone can say anything: she has said this before. A tiny nervous laugh at the start is fine. Stress on "water". Do not sound ashamed; she is getting her excuse in first. | `[quick, defensive, a little too fast] It's water weight.` |
| WGH-02 | Weigh-in | Don't read it out loud. | A sharp urgent whisper, as the agent leans towards the display. Stress on "Don't". Mortified and bossy at once. Do not shout; it is a stage whisper. | `[sharp urgent whisper] Don't read it out loud.` |
| WGH-03 | Weigh-in | It's the shoes. It's always the shoes. | Blame-shifting with conviction. "It's the shoes." brisk and certain. A short beat. "It's always the shoes." slower, wise and world-weary, as a universal truth, stress on "always". Do not rush the beat between them. | `[brisk, certain] It's the shoes. [beat] [slow, world-weary] It's always the shoes.` |
| GRB-01 | Handle grab | Oh. We're doing this now. | Caught off guard, then resigned. "Oh." a small surprised dip, like being woken. A half-second pause. "We're doing this now." flat, unimpressed, not a question, stress on "now". Do not make it a question and do not raise the volume. | `[small surprised dip] Oh. [beat] [flat, unimpressed] We're doing this now.` |
| GRB-02 | Handle grab | Mind the handle. It's my best feature. | Vain and fussy. "Mind the handle." a quick sharp instruction. "It's my best feature." softer, preening, a little breathy and pleased with herself, stress on "best". Do not overdo it into a sultry voice. | `[quick, sharp] Mind the handle. [preening, pleased with herself] It's my best feature.` |
| GRB-03 | Handle grab | Lift with your knees. I've let myself go. | "Lift with your knees." brisk safety advice, matter-of-fact. A tiny pause, then "I've let myself go." a rueful, self-pitying confession, a small sigh in it, stress on "go". Do not play it sad; it is a cheerful admission. | `[brisk, matter-of-fact] Lift with your knees. [rueful sigh] I've let myself go.` |
| FAL-01 | Free-fall | I can fly! ...I cannot fly. | "I can fly!" a burst of wild joy, high and rising, airborne. A sudden stop, about half a second of realisation. "...I cannot fly." flat, small and doomed, the pitch dropped right down. The turn is the joke: make the contrast as big as possible. No real scream, no cry for help. | `[wild joy, rising] I can fly! [sudden stop, realising] [flat, doomed] ...I cannot fly.` |
| FAL-02 | Free-fall | Wheee— no. No. Regret. | Starts as the carousel's delighted "Wheee", cut off sharply as she realises. "no. No." quick, the second firmer. A beat. "Regret." one word, deadpan and grave. Do not let the wheee finish; it is interrupted. | `[delighted, cut off sharply] Wheee— [quick] no. [firmer] No. [beat] [deadpan, grave] Regret.` |
| FAL-03 | Free-fall | Tell my wheels I loved them. | Melodramatic last words, a soap-opera death scene: breathy, trembling, slow, the voice catching on "loved". Played completely straight. Do not laugh, and keep it a cartoon farewell, not real distress. | `[melodramatic, breathy, trembling] Tell my wheels I [voice catching] loved them.` |
| CAR-01 | Carousel | I'm the black one. No, the other black one. | Waving at her owner across the hall. "I'm the black one." bright, helpful, raised. Quick beat. "No, the other black one." quicker, exasperated, stress on "other". Do not slow down; it is a hurried correction. | `[bright, calling across the hall] I'm the black one. [quick, exasperated] No, the other black one.` |
| CAR-02 | Carousel | Third lap. I live here now. | Dizzy resignation. "Third lap." flat, a sigh in front of it. A beat. "I live here now." deadpan acceptance, almost content, stress on "live". Quiet. Do not sound upset. | `[sigh] [flat] Third lap. [beat] [deadpan acceptance] I live here now.` |
| CAR-03 | Carousel | Pick me! Pick me! Play it cool. Pick me. | "Pick me! Pick me!" eager, bouncing, fast and high, the second higher. A sudden stop, and "Play it cool." a hushed note to herself. Then "Pick me." low, slow, trying to be smooth and failing, a little desperate. The switch is the joke. | `[eager, bouncing] Pick me! Pick me! [sudden hush, to herself] Play it cool. [low, trying to be smooth] Pick me.` |
| CNV-01 | Conveyor | I've seen parts of this airport you never will. | Smug and mysterious, bragging like a seasoned traveller, slow and knowing, a little conspiratorial. Stress on "never". Not threatening: smug. | `[smug, knowing, conspiratorial] I've seen parts of this airport you never will.` |
| CNV-02 | Conveyor | No, no. You walk. I'll take the belt. | Mock generosity. "No, no." sweetly insistent. "You walk." magnanimous. "I'll take the belt." a martyr's sigh in it, stress on "I'll". Light, sarcastic, not angry. | `[sweetly insistent] No, no. You walk. [martyr's sigh] I'll take the belt.` |
| CNV-03 | Conveyor | Are we there yet? | A bored child in the back seat: whiny, drawn out, sing-song, the "yet" stretched and rising. Not loud. | `[bored, whiny, sing-song] Are we there yet?` |
| INV-01 | Upside down | Wheels up. Not like that. | "Wheels up." bright, like a pilot. A beat as she realises she is upside down. "Not like that." flat, disgruntled, stress on "that". The deflation is the joke. | `[bright, like a pilot] Wheels up. [beat] [flat, disgruntled] Not like that.` |
| INV-02 | Upside down | This side up. It says so. Right there. | Mounting indignation, each sentence more pointed than the last, as if jabbing a finger at the label. "This side up." clipped. "It says so." sharper. "Right there." slow and emphatic, a word at a time. Not shouting. | `[clipped] This side up. [sharper] It says so. [slow, emphatic] Right there.` |
| INV-03 | Upside down | The shampoo was not ready for this. | Quiet dread, a horror-film whisper about a domestic disaster, slow, stress on "not". Played as tragedy; do not wink. | `[quiet dread, slow] The shampoo was not ready for this.` |
| DRK-01 | Dark hold | I love the dark. Very slimming. | Quiet and close (recorded soft). "I love the dark." a contented murmur. A beat. "Very slimming." a smug, self-satisfied whisper, stress on "slimming". The callback to the scale: vanity in the hold. | `[contented murmur] I love the dark. [beat] [smug whisper] Very slimming.` |
| DRK-02 | Dark hold | The golf bag snores. | A whispered complaint to a neighbour, long-suffering and gossipy, quiet, a weary sigh before it. Stress on "snores". Recorded soft. | `[weary sigh] [gossipy whisper] The golf bag snores.` |
| DRK-03 | Dark hold | I spy, with my little zipper... nothing. | A bored game in the dark, recorded soft. "I spy, with my little zipper..." sing-song, playful, slowing. A long pause, looking round. "nothing." flat and defeated. The pause is the joke. | `[sing-song, playful, slowing] I spy, with my little zipper... [long pause] [flat, defeated] nothing.` |

## 3. Casting

The seeded clips are Kokoro drafts (model Kokoro-82M v1.0, run locally with kokoro-onnx 0.6.1). Kokoro has no emotion control, so these are timing drafts, not performances; they stay published until the owner publishes better takes.

| Speaker | Seeded voice (Kokoro) | Speed | Why |
| --- | --- | --- | --- |
| The bag | `af_heart` | 1.0 | Widest pitch movement of the five voices tried (af_bella, af_heart, bf_emma, af_aoede, af_nicole): 8.6 semitones on average |
| Agent | `af_sarah` | 1.1 | Level and businesslike, a touch fast |
| Host | `am_michael` | 0.95 | Low, tired |
| Stranger | `am_puck` | 1.0 | Bright and quick |
| Narrator | `bm_george` | 1.0 | Grave British documentary voice |

For the performances, Admin, Voice-overs picks a model and voice per speaker (or per take) from the configured service's live list: on OpenRouter, an expressive model such as Fish Audio S2.1 Pro, OpenAI's gpt-4o-mini-tts-2025-12-15, Microsoft MAI-Voice-2 or Google Gemini Flash TTS, whichever the list offers. OpenAI has announced the mini TTS model's shutdown on 6 January 2027, so it must not be the only voice of the film.

### 3a. How a direction reaches each kind of model

Decided per model from its supported parameters (OpenRouter's `GET /audio/speech/models`, read at run time) by `src/lib/voice/direction.ts`; the administrator may override it per take, except that a model known to read brackets aloud always gets none.

| Kind of model | Text sent | Direction sent |
| --- | --- | --- |
| Reads bracket cues (Fish Audio S2) | the bracket-cue line | in the line, as the cues |
| Lists `instructions` | the subtitle as written | top-level `instructions` (the speaker's note, then the cue's direction) |
| OpenAI model, parameters not listed | the subtitle as written | `provider.options.openai.instructions` |
| Kokoro | the subtitle, capitals as plain words | none: it takes none and would read brackets aloud |
| Anything else | the bracket-cue line | in the line; listen for a cue being read aloud and switch to none if it is |

None of this has been tried against the real OpenRouter models: the build machine cannot reach openrouter.ai. It is built to OpenRouter's documentation as read on 22 November 2026 and tested against a stand-in.

### 3b. A local expressive model (22 Nov attempt)

Chatterbox (Resemble AI, MIT, with an exaggeration control) was tried as an open model that could run on the build machine. Its code is reachable (PyPI), but its weights are published only on Hugging Face, which this machine cannot reach (the proxy refuses the connection; mirrors too), and no GitHub release carries them. The machine also has about 3 GB of free disk, less than the model and PyTorch need. No clip was made.

## 4. The clips

421 takes were generated (every speaker's candidate voices, then the chosen voice at several speeds and spellings) and every take was measured and transcribed. For each phrase the take chosen is the one closest to the time the subtitle gives it that both recognisers heard right, with a small preference for livelier pitch; the phrases were then placed at the subtitle's own timing. Each clip is trimmed to 10 ms before the first word, has 5 ms fades and about 30 ms of silence after the last word, is normalised to -18 LUFS integrated with a true-peak ceiling of -1 dBTP (a look-ahead peak limiter where the peaks would pass it), and encoded as MP3, mono, 24 kHz, 64 kbps. The measurements are of the decoded MP3. "Heard" is the two recognisers (Whisper base.en and a Zipformer transducer, both through sherpa-onnx) hearing the subtitle's words; an interjection counts when written any usual way ("Woah" for "Whoa").

| Cue | Voice | Length (s) | Window (s) | Loudness (LUFS) | True peak (dBTP) | Size (KB) | Heard by | What was heard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `intro` | bm_george | 20.79 | none | -18.0 | -2.1 | 163.1 | 1 of 2 | Whisper: "It started as a joke, a quick gag, a device that goes on luggage that is the comedic relief of all the airport luggage moments of absurdity. It knows when it's being weighed, when it's being thrown, when it's been upside down in the dark for four hours. And it is not happy about it."; Zipformer: "it started as a joke a quick gag a device that goes on luggage that is the comedi relief of all the airport luggage moments of absurdity it knows when it's being weighed when it's being thrown when it's been upside down in the dark for four hours and it is not happy about it" |
| `handle-dinner` | af_heart | 2.85 | 4.50 | -18.0 | -2.1 | 22.9 | 1 of 2 | Whisper: "Whoa, whoa, whoa. Are you gonna buy me dinner first?"; Zipformer: "well well are you going to buy me dinner first" |
| `scale-fat` | af_heart | 2.02 | 2.80 | -18.0 | -2.4 | 16.5 | 2 of 2 | Whisper: "Are you calling me fat?"; Zipformer: "are you calling me fat" |
| `scale-limit` | af_sarah | 1.42 | 1.60 | -18.0 | -3.7 | 11.8 | 2 of 2 | Whisper: "Sir, the bag is over the limit."; Zipformer: "sir the bag is over the limit" |
| `scale-host` | am_michael | 1.22 | 1.50 | -18.0 | -2.1 | 10.1 | 2 of 2 | Whisper: "Take it up with her."; Zipformer: "take it up with her" |
| `toss-ow` | af_heart | 2.84 | 6.38 | -18.0 | -2.1 | 22.9 | 1 of 2 | Whisper: "Ow. I felt that in my flip-flops."; Zipformer: "oh i felt that in my flip flops" |
| `hold-hello` | af_heart | 4.40 | 4.60 | -18.0 | -2.3 | 35.1 | 2 of 2 | Whisper: "Hello. Anyone. Cool, cool. I'll just be here."; Zipformer: "hello any one cool cool i'll just be here" |
| `hold-dark` | af_heart | 1.13 | 2.50 | -18.0 | -2.8 | 9.6 | 2 of 2 | Whisper: "in the dark"; Zipformer: "in the dark" |
| `carousel-whee` | af_heart | 2.16 | 4.60 | -18.0 | -2.2 | 17.6 | 1 of 2 | Whisper: "We. Again. Again."; Zipformer: "away again again" |
| `carousel-stranger` | am_puck | 1.00 | 2.50 | -18.0 | -2.2 | 8.4 | 2 of 2 | Whisper: "Where did you get that?"; Zipformer: "where did you get that" |
| `button-souvenirs` | af_heart | 3.73 | 5.00 | -18.0 | -2.2 | 29.8 | 2 of 2 | Whisper: "62 pounds. That's mostly souvenirs."; Zipformer: "sixty two pounds that's mostly souvenirs" |
| `button-host` | am_michael | 1.15 | 1.90 | -18.0 | -2.4 | 9.8 | 2 of 2 | Whisper: "She's not wrong."; Zipformer: "she's not wrong" |

Every clip fits its subtitle's window; none clips (no sample at full scale). Together the twelve clips are 358 KB. Every line was heard right by at least one recogniser; the four heard by only one are those with an interjection ("Whoa" heard as "well", "Ow" as "oh", "Whee" as "away" by the Zipformer, which has no such words) and the introduction (the Zipformer wrote "comedi relief"). Hearing the words is not hearing the performance: whether "Whoa" sounds startled or "Wheeee" sounds delighted is for a listener.

The clips and their manifest are in `seed/concepts/baggage-claims/voiceovers/` and are stored in the files store (folder Voice-overs) once per batch by `src/lib/voice/seedVoiceovers.ts`. The WAV masters, the takes, the models and the tools stay outside the repository.

## 5. The sound control

The film starts silent (browsers block sound before the visitor acts, and the page never switches it on by itself). Until the visitor uses it, the control is a large orange invitation over the first frame, in the bag's voice. Three wordings for the owner to choose from; the first is in place:

1. "Turn me up. I have things to say." (in place)
2. "I'm not just a pretty suitcase. Sound on."
3. "Psst. Unmute me. I've been through a lot."

After one use it becomes the small Sound on / Sound off switch in the top bar, with a three-bar meter that moves with the voice. The choice holds for the visit; the introduction plays only the first time sound is turned on in the tab. Beside the film: "The voices are synthetic: made with Kokoro, an open speech model (Apache-2.0). No person was recorded." and the introduction's transcript.

## 6. Licences

- Kokoro-82M v1.0 (weights and voices): Apache-2.0 (hexgrad/Kokoro-82M). Apache-2.0 puts no condition on audio the model produces. The model is not in this repository and is not run by the app: the app calls a Kokoro server only if an administrator sets one up.
- kokoro-onnx 0.6.1 (used outside the repository to generate the seeded clips): MIT (its licence file read). It turns text into phonemes with phonemizer and espeak-ng (both GPL-3.0; espeak-ng loaded as a library through espeakng-loader) on the generating machine only; no code of them is in the repository or the app, and the clips are their output.
- sherpa-onnx 2.0.3 (used outside the repository to check the words): Apache-2.0 (its package metadata read). The two recognition models were published by its authors; Whisper base.en is MIT and the Zipformer (icefall) Apache-2.0 according to their upstream projects, not read from licence files here. Neither is in the repository.
- The app measures clips an administrator accepts with the npm package mpg123-decoder (declares MIT) which carries mpg123 compiled to WebAssembly; mpg123 is LGPL-2.1. Listed in `docs/third-party.manual.json` for the owner to confirm.

## 7. For the owner to confirm

1. The introduction: A (narrator, chosen), B (the bag) or C (the host).
2. The invitation on the sound control: one of the three wordings.
3. The cast, and whether it is funny: generate takes of each line in Admin, Voice-overs with an expressive model, listen side by side, star and publish. The seeded clips are Kokoro drafts.
4. The directions in section 2 (the wording of each, and the character notes), and the pack directions.
5. When clips other than Kokoro's are published, the line beside the film ("made with Kokoro") must name the model used; it is fixed text today (`SOUND.synthetic` in `voiceScript.ts`).
6. That the speech-level hook (`speechLevelAt`, `currentSpeech`, `useSpeechLevel` in `voiceTrack.ts` and `useSpeechLevel.ts`) is what WS13 wants for the tag's speaker grille.
