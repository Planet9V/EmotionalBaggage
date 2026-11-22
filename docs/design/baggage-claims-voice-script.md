# Baggage Claims: voice script of the welcome film

Status: written 22 November 2026 (workstream WS12). The data is `src/components/welcome/scenes/voiceScript.ts`; this page is the reasoning, the alternatives and what the owner still has to confirm. The owner's brief: "We have to have voice on the introduction and gag reels; it must be animated and funny."

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

## 2. Every spoken cue

The words are exactly the subtitles of `scenes.ts` (the test `tests/voice/voiceovers.test.ts` holds every clip's text to its subtitle). "Sent to the voice" is the text the admin tool sends when it generates a cue in one piece; punctuation and spelling are shaped for timing, never a different word. The window is the time the subtitle gives the line before the next line or the end of the scene.

| Cue | Speaker | Subtitle | Sent to the voice | Window (s) |
| --- | --- | --- | --- | --- |
| `handle-dinner` | The bag | Whoa whoa whoa — are you gonna buy me dinner first? | Whoa whoa whoa! Are you gonna buy me dinner, first? | 4.50 |
| `scale-fat` | The bag | Are you... calling me FAT? | Are you... calling me, fat?! | 2.80 |
| `scale-limit` | Agent | Sir, the bag is over the limit. | Sir, the bag is over the limit. | 1.60 |
| `scale-host` | Host | Take it up with her. | Take it up with her. | 1.50 |
| `toss-ow` | The bag | OW! ...I felt that in my flip-flops. | Ow! ...I felt that, in my flip-flops. | 6.38 |
| `hold-hello` | The bag | Hello? ...Anyone? ...Cool, cool. I'll just be here. | Hello? ...Anyone? ...Cool, cool. I'll just be here. | 4.60 |
| `hold-dark` | The bag | In the dark. | In. The. Dark. | 2.50 |
| `carousel-whee` | The bag | Wheeee! Again! Again! | Whee! Again!! Again! | 4.60 |
| `carousel-stranger` | Stranger | Where did you GET that? | Where did you get that?! | 2.50 |
| `button-souvenirs` | The bag | Sixty-two pounds? That's mostly SOUVENIRS. | Sixty-two pounds?! That's mostly... souvenirs! | 5.00 |
| `button-host` | Host | ...She's not wrong. | ...She's not wrong. | 1.90 |

Performance direction per cue (delivery; pace; where the pause lands; what makes it funny):

- **`handle-dinner`** (The bag). Startled, then affronted: someone has just been picked up without being asked. The three whoas climb. Pace: The whoas quick and even, about a third of a second each; the question slower and pointed. Pause: Half a second after the third whoa, as she collects herself, before "are you gonna". Funny: The bag has the manners of a first date and the host has none. Lean on "dinner", not on "first".
- **`scale-fat`** (The bag). Quiet disbelief turning to outrage. She has seen the number on the scale before anyone else has. Pace: "Are you" slow and level; "calling me" clipped; "FAT" full volume, one syllable held. Pause: A full second of silence after "Are you...": the stillness of the weigh-in. Then a short beat, a breath, before "FAT?". Funny: The long pause lets the visitor get there first. The word lands as the scale's display does.
- **`scale-limit`** (Agent). Professional and entirely straight: the agent has said this four hundred times today and did not hear a suitcase speak. Pace: Brisk and flat, no rise at the end. Pause: None. She answers the bag's outburst as if it were paperwork. Funny: The straight face. Any hint of amusement kills it.
- **`scale-host`** (Host). Weary and dry. He has had this argument with the bag at home and lost. Pace: Slow, falling; a small sigh on the way in. Pause: A beat before the line, as he does not look up. Funny: "Her": he treats the bag as a person, and as the one in charge.
- **`toss-ow`** (The bag). A sharp yelp on impact, then small, wounded dignity from the belt. Pace: "OW" instant, on the thud. The second half slow and flat. Pause: Nearly a second after "OW!", while the dust settles. Funny: The injury is to what she is carrying. Deadpan on "flip-flops"; do not sell it.
- **`hold-hello`** (The bag). Sleepy and small in a large dark room; then brittle, pretending not to mind. Pace: Each piece slower and quieter than the last. "Cool, cool" too casual, too quick. Pause: A second after "Hello?" for the answer that does not come; another after "Anyone?"; a short one before "I'll just be here". Funny: The pauses are the joke: nobody answers. "Cool, cool" is someone who is not cool about it.
- **`hold-dark`** (The bag). Flat, aimed at whoever left her there. The lowest pitch she has in the film. Pace: Slow, three even words. Pause: It comes after its own silence: nearly half a second after "I'll just be here", as an afterthought. Funny: The afterthought that is the whole complaint. Underplay it.
- **`carousel-whee`** (The bag). Pure delight, a child on a fairground ride; all the dignity of the earlier scenes gone. Pace: "Wheeee" long and rising through the bend; the two "Again"s fast, the second higher. Pause: A breath after "Wheeee!" as she comes round; almost none between the "Again"s. Funny: The one thing in the whole trip she likes is the one part everybody else hates.
- **`carousel-stranger`** (Stranger). Delighted and a little envious: a stranger who wants one. The only line in the film that sells the product, so it must sound unprompted. Pace: Quick, rising, stress on "GET". Pause: None inside the line; it comes two seconds after the bag stops, once the stranger has worked out what spoke. Funny: It is not a joke: it is the audience's own question, said out loud.
- **`button-souvenirs`** (The bag). Reading the display in disbelief, then a prepared defence, indignant. Pace: The number slow, each word weighed; the defence quick, with "SOUVENIRS" hit hard. Pause: A second after "pounds?" while she thinks of an excuse; a short lift before "SOUVENIRS". Funny: She disputes the number she objected to in scene 2, and the excuse is worse than the charge.
- **`button-host`** (Host). Resigned agreement, to nobody in particular. He has stopped fighting. Pace: Slow and level. Pause: A long beat before it: the nod comes first, then the line. Funny: He sides with the bag. The last word of the film is the host giving in.

## 3. Casting

Provider for every speaker: Kokoro (model Kokoro-82M v1.0, run locally with kokoro-onnx 0.6.1 for the seeded clips). The same voice ids work on a Kokoro server set up in Admin, Voice; Admin, Voice-overs can change any of them, or use OpenRouter, per speaker or per line.

| Speaker | Provider | Model | Voice id | Speed | Text shaping (subtitle unchanged) | Why |
| --- | --- | --- | --- | --- | --- | --- |
| The bag | Kokoro | Kokoro-82M v1.0 | `af_heart` | 1.0 (per phrase 0.85 to 1.3) | Each line built phrase by phrase at the subtitle's timing; ellipses and dashes for pauses; "FAT" sent lower-case (capitals are spelled out); "Ow" and "Whee" sent as checked phonemes or plain spellings, because stretched spellings are read as two syllables | Widest pitch movement of the five voices tried (af_bella, af_heart, bf_emma, af_aoede, af_nicole): 8.6 semitones on average; every phrase has a take both recognisers heard right |
| Agent | Kokoro | Kokoro-82M v1.0 | `af_sarah` | 1.1 | none | Level and businesslike, a touch fast |
| Host | Kokoro | Kokoro-82M v1.0 | `am_michael` | 0.95 | a trailing ellipsis on "Take it up with her" | Low, tired; slowed for the resigned lines |
| Stranger | Kokoro | Kokoro-82M v1.0 | `am_puck` | 1.0 | "GET" in capitals for stress (read as a word) | Bright and quick, sounds unprompted |
| Narrator | Kokoro | Kokoro-82M v1.0 | `bm_george` | 1.0 | commas for breath; "And it is... NOT happy" | Grave British documentary voice |

Alternatives tried and kept in the take folder: agent af_kore, bf_alice; host am_adam, am_eric; stranger af_jessica, af_nova; narrator bm_fable, am_onyx.

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
3. The cast, and whether it is funny, by listening on the welcome page.
4. That the speech-level hook (`speechLevelAt`, `currentSpeech`, `useSpeechLevel` in `voiceTrack.ts` and `useSpeechLevel.ts`) is what WS13 wants for the tag's speaker grille.
