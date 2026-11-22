// How every voice-over of "It started as a joke" is to be performed: a voice director's note per cue, and the same
// performance written as short bracket cues inside the line. The subtitle words are never changed (they are the
// owner's); what changes between models is only how the direction reaches them (src/lib/voice/direction.ts):
//  - `direction`: natural language, for a model that takes instructions beside the text (OpenAI's mini TTS, and any
//    OpenRouter speech model whose supported parameters list `instructions`). It is never put into the spoken text.
//  - `inlineTags`: the subtitle with delivery cues in square brackets, for a model that reads bracket cues as
//    directions (Fish Audio S2). Taking the brackets out leaves the subtitle exactly; tests/voice/direction.test.ts
//    holds every cue to that.
// The per-speaker note is the character, prefixed to each of that speaker's directions (the administrator can change
// it per speaker in Admin, Voice-overs). The reasoning is docs/design/baggage-claims-voice-script.md, section 2.
// Kept out of voiceScript.ts on purpose: the public film imports that file, and it does not need these words.
import type { Speaker } from "./voiceScript";

export type CueDirection = { direction: string; inlineTags: string };

/** The character every line of a speaker is played in: the default prefix of that speaker's directions. */
export const SPEAKER_NOTE: Record<Speaker, string> = {
  bag: "You are the suitcase: a put-upon, dramatic, vain diva of a bag, sorry for herself, sassy, with high comic energy. A bright American woman's voice with a wide pitch range. You complain to whoever is in earshot and never about them. Play every line as a real person who is genuinely offended or genuinely delighted, never as someone reading a joke; the comedy is in the timing and the attitude, not in funny voices.",
  agent: "You are a check-in agent near the end of a long shift: polite, professional, entirely deadpan. You have not noticed that a suitcase just spoke.",
  host: "You are the traveller, in his thirties, deadpan and dry. You have lived with this suitcase for a while and you have lost every argument with her.",
  stranger: "You are a passer-by at the baggage carousel, warm and spontaneous, who has just heard a suitcase talk and wants one.",
  narrator: "You are a nature-documentary narrator: British, warm, grave and completely sincere, describing a newly discovered creature. You are never in on the joke.",
};

/** One direction per cue, keyed as VOICE_CUES keys them ("intro", "<scene>-<line>"). */
export const CUE_DIRECTIONS: Record<string, CueDirection> = {
  intro: {
    direction:
      "Read it as natural history. \"It started as a joke.\" measured and level, then a full beat of silence. The long second sentence unhurried and weighty, as if describing a rare animal; a faint relish on \"absurdity\". The three \"when\" lines build: each one shorter and quicker than the last, a short beat between them. Then a long pause, about three quarters of a second, and \"And it is NOT happy about it.\" slower and lower, with real gravity: \"NOT\" is a firm, drawn-out, lower note, the weight of the whole film on it, not a shout. Do not spell NOT, do not shout it, do not smile audibly or wink, do not sound like an advert, and do not rush the pauses.",
    inlineTags:
      "[warm, grave, sincere] It started as a joke. [beat] A quick gag: a device that goes on luggage that is the comedic relief of all the airport luggage moments of absurdity. [beat] [building] It knows when it's being weighed. When it's being thrown. When it's been upside down in the dark for four hours. [long pause] [slow, low, grave] And it is NOT happy about it.",
  },
  "handle-dinner": {
    direction:
      "She was dozing on the curb and is suddenly hoisted by the handle without a word. First alarm, then scandalised manners. Three \"whoa\"s about a third of a second apart, each higher and faster than the last, the third nearly a squeak. Then half a second in which she collects her dignity, with a small indignant intake of breath. \"are you gonna buy me dinner first?\" comes down in pitch, slower, arch and pointed: the stress is on \"dinner\", stretched a little with a scandalised lift; \"first\" falls away, tossed off. The whoas loud, the question at normal level. Do not read the whoas flat or alike, do not pause between them, do not shout the question, do not stress \"first\", and do not make it flirtatious: it is affronted propriety.",
    inlineTags: "[startled, each one higher] Whoa whoa whoa — [indignant intake of breath] [arch, pointed] are you gonna buy me dinner first?",
  },
  "scale-fat": {
    direction:
      "Perfectly still on the scale, she has just read the number before anyone else. She gives them one chance to take it back. \"Are you...\" low, slow and quiet, almost a whisper of disbelief; the dots are a held breath. About half a second of silence. \"calling me\" quicker and tighter, rising. Then a sharp half-second gasp, and \"FAT?\" as a wounded shriek: one syllable, high and loud, cracking at the top, held a little, as if she has been slapped. Whisper, then normal, then the loudest moment of her scene. Do not spell the letters F-A-T, do not say it calmly or flatly, do not laugh, and leave no pause after it. The joke is the distance between the quiet start and the shriek.",
    inlineTags: "[quiet, slow disbelief] Are you... [beat] [tighter, rising] calling me [sharp gasp] [wounded shriek, voice cracking] FAT?",
  },
  "scale-limit": {
    direction:
      "The twelfth overweight bag of her shift. She did not notice the suitcase spoke and answers as if the traveller had. Brisk, flat, polite customer-service register, even pitch, falling at the end; at most a faint stress on \"limit\". Normal volume, close to the microphone. No pause before or inside the line, and done in under a second and a half. Do not react to the bag, do not smile or sound amused or surprised, and do not rise at the end.",
    inlineTags: "[flat, brisk, bored] Sir, the bag is over the limit.",
  },
  "scale-host": {
    direction:
      "He does not look up. He has had this argument at home and lost, and he is glad to pass it on. A small tired breath out through the nose, then the line low, dry and falling, a little under his breath. The stress is on \"her\", as in the boss, with only a slight tilt. A little quieter than the agent. Do not make it a joke, do not laugh, do not sell \"her\", and finish inside a second and a half.",
    inlineTags: "[tired exhale] [dry, under his breath] Take it up with her.",
  },
  "toss-ow": {
    direction:
      "She has been thrown through the air and slammed onto the belt. First pure reflex, then wounded dignity. \"OW!\" is a sharp, loud, high yelp on the impact, instant and short, like a stubbed toe: one syllable, a noise rather than a word. Then nearly a second of stunned silence while she takes stock, with a small shaky breath in. \"...I felt that in my flip-flops.\" small, quiet, slightly trembling and offended, slow, as if checking for damage; \"flip-flops\" dropped flat and deadpan, because the injury is to what she is carrying. Do not stretch the OW into \"owww\", do not sound like someone really hurt or in danger, do not shout the second half, and do not wink at \"flip-flops\".",
    inlineTags: "[sharp yelp] OW! [stunned pause, shaky breath] [small, wounded, deadpan] ...I felt that in my flip-flops.",
  },
  "hold-hello": {
    direction:
      "Hours in the dark hold; she has just woken, small in a huge empty room. Hoping someone is there, then pretending she never cared. \"Hello?\" soft, sleepy and hopeful, a little croaky, rising. About a second of silence: nobody answers. \"...Anyone?\" quieter and smaller, rising less. Another second of silence. \"...Cool, cool.\" too quick and too casual, a brittle brightness, the second \"cool\" a touch lower: she is not cool. A short beat, then \"I'll just be here.\" flat and resigned, trailing off to herself. Quiet throughout, each phrase quieter than the last, close to the microphone. Do not rush the silences (they are the joke), do not shout, do not sound frightened or in trouble (she is sulking, not in distress), and do not end on a rise.",
    inlineTags: "[soft, sleepy, hopeful] Hello? [long pause] [smaller] ...Anyone? [long pause] [too casual, brittle] ...Cool, cool. [beat] [flat, trailing off] I'll just be here.",
  },
  "hold-dark": {
    direction:
      "The afterthought that is the whole complaint, aimed at whoever left her there. A small sniff, then three words, slow, low and deadpan, the lowest pitch she uses in the film, set down like a verdict, with only a hair of space between them. Quiet and close, no louder than \"I'll just be here\". Do not chop it into three spoken full stops, do not get loud or angry, and no spooky horror whisper: it is a sulk.",
    inlineTags: "[small sniff] [low, slow, deadpan] In the dark.",
  },
  "carousel-whee": {
    direction:
      "On the carousel, coming round the bend; every bit of dignity from the earlier scenes is gone. Pure childish delight, and she wants another go. \"Wheeee!\" a long gleeful squeal rising through the bend, about a second, like a child on a fairground ride, a laugh breaking into the end of it. A quick delighted breath. \"Again! Again!\" fast and bouncing, the second higher and louder than the first, nearly begging. Loud and bright: the happiest she sounds. Do not say \"whee\" as a short read word, do not split it into two syllables, do not sound sarcastic, and do not slow the agains down.",
    inlineTags: "[gleeful squeal, rising] Wheeee! [delighted laugh, quick breath] Again! [higher, begging] Again!",
  },
  "carousel-stranger": {
    direction:
      "A passer-by who has just realised the suitcase is the one talking, and wants one now. Quick, warm, genuinely delighted and a little envious, half laughing; the pitch rises through the line and the stress lands hard on \"GET\", pitched up and slightly stretched: I need to know. A raised voice that carries across the hall. Do not sound like an advert or a cue line, do not be sarcastic, do not stress \"that\", and finish inside two seconds.",
    inlineTags: "[delighted, half laughing] Where did you GET that?",
  },
  "button-souvenirs": {
    direction:
      "Back on the scale; she reads the display herself. Disbelief, then a defence she has clearly rehearsed. \"Sixty-two pounds?\" slow, each word weighed, rising in scandalised disbelief, \"pounds\" drawn up high. Then about a second and a half of silence while she scrambles for an excuse (a small thinking \"hm\" is fine, no words). \"That's mostly\" quick, prim and matter-of-fact, a tiny lift, then \"SOUVENIRS.\" hit hard and proud on its first syllable, slightly over-enunciated, a full stop: case closed. Medium volume, the last word loudest. Do not rush the gap, do not make \"souvenirs\" a question, do not spell it, and do not sound embarrassed: she is indignant, and the excuse is worse than the charge.",
    inlineTags: "[slow, scandalised disbelief] Sixty-two pounds? [long pause, thinking] [prim, quick] That's mostly [proud, emphatic] SOUVENIRS.",
  },
  "button-host": {
    direction:
      "The last word of the film. He nods before he speaks. A beat of silence, a short resigned breath out, then the line low, level and slow, almost fond, falling at the end, a light stress on \"not\". Quiet, under his breath. Do not make it a punchline, do not laugh, do not raise the pitch, and keep the silence in front under half a second so the clip fits its 1.9 seconds.",
    inlineTags: "[beat, resigned exhale] [low, dry, almost fond] ...She's not wrong.",
  },
};

/**
 * The bag's recommended lines for each sensed moment (the three marked ★ in docs/design/baggage-claims-lines.md),
 * directed the same way, so voice packs can be made from them later. The words are the lines document's.
 */
export type PackLine = { id: string; moment: string; text: string } & CueDirection;
export const PACK_DIRECTIONS: PackLine[] = [
  { id: "IMP-01", moment: "Hard impact", text: "That's one. I'm keeping count.", direction: "Winded from the hit, then icy. \"That's one.\" low and clipped, through her teeth, straight after a small grunt of impact. A half-second pause. \"I'm keeping count.\" slow and pointed, quietly menacing, like a schoolteacher writing a name on the board. Do not shout and do not laugh; the threat is in how calm it is.", inlineTags: "[winded grunt] [clipped, through her teeth] That's one. [beat] [slow, quietly menacing] I'm keeping count." },
  { id: "IMP-02", moment: "Hard impact", text: "Ow. No, no. Don't get up.", direction: "\"Ow.\" small and flat, a sore wince rather than a yelp. Then mock politeness dripping with sarcasm: \"No, no.\" quick and airy, \"Don't get up.\" slow and sweet, a passive-aggressive host at a dinner party. Stress on \"up\". Do not sound really hurt, and do not get loud.", inlineTags: "[flat wince] Ow. [airy, sarcastic] No, no. [sweet, passive-aggressive] Don't get up." },
  { id: "IMP-03", moment: "Hard impact", text: "Fragile was a suggestion, apparently.", direction: "Dusting herself off with weary disdain. \"Fragile\" drawn out with a sniff of contempt; \"was a suggestion\" dry; a tiny pause; \"apparently.\" dropped flat and deadpan, as an aside. Understatement: no anger, no volume.", inlineTags: "[weary disdain] Fragile was a suggestion, [beat] [deadpan aside] apparently." },
  { id: "WGH-01", moment: "Weigh-in", text: "It's water weight.", direction: "Quick, defensive, a little too fast, before anyone can say anything: she has said this before. A tiny nervous laugh at the start is fine. Stress on \"water\". Do not sound ashamed; she is getting her excuse in first.", inlineTags: "[quick, defensive, a little too fast] It's water weight." },
  { id: "WGH-02", moment: "Weigh-in", text: "Don't read it out loud.", direction: "A sharp urgent whisper, as the agent leans towards the display. Stress on \"Don't\". Mortified and bossy at once. Do not shout; it is a stage whisper.", inlineTags: "[sharp urgent whisper] Don't read it out loud." },
  { id: "WGH-03", moment: "Weigh-in", text: "It's the shoes. It's always the shoes.", direction: "Blame-shifting with conviction. \"It's the shoes.\" brisk and certain. A short beat. \"It's always the shoes.\" slower, wise and world-weary, as a universal truth, stress on \"always\". Do not rush the beat between them.", inlineTags: "[brisk, certain] It's the shoes. [beat] [slow, world-weary] It's always the shoes." },
  { id: "GRB-01", moment: "Handle grab", text: "Oh. We're doing this now.", direction: "Caught off guard, then resigned. \"Oh.\" a small surprised dip, like being woken. A half-second pause. \"We're doing this now.\" flat, unimpressed, not a question, stress on \"now\". Do not make it a question and do not raise the volume.", inlineTags: "[small surprised dip] Oh. [beat] [flat, unimpressed] We're doing this now." },
  { id: "GRB-02", moment: "Handle grab", text: "Mind the handle. It's my best feature.", direction: "Vain and fussy. \"Mind the handle.\" a quick sharp instruction. \"It's my best feature.\" softer, preening, a little breathy and pleased with herself, stress on \"best\". Do not overdo it into a sultry voice.", inlineTags: "[quick, sharp] Mind the handle. [preening, pleased with herself] It's my best feature." },
  { id: "GRB-03", moment: "Handle grab", text: "Lift with your knees. I've let myself go.", direction: "\"Lift with your knees.\" brisk safety advice, matter-of-fact. A tiny pause, then \"I've let myself go.\" a rueful, self-pitying confession, a small sigh in it, stress on \"go\". Do not play it sad; it is a cheerful admission.", inlineTags: "[brisk, matter-of-fact] Lift with your knees. [rueful sigh] I've let myself go." },
  { id: "FAL-01", moment: "Free-fall", text: "I can fly! ...I cannot fly.", direction: "\"I can fly!\" a burst of wild joy, high and rising, airborne. A sudden stop, about half a second of realisation. \"...I cannot fly.\" flat, small and doomed, the pitch dropped right down. The turn is the joke: make the contrast as big as possible. No real scream, no cry for help.", inlineTags: "[wild joy, rising] I can fly! [sudden stop, realising] [flat, doomed] ...I cannot fly." },
  { id: "FAL-02", moment: "Free-fall", text: "Wheee— no. No. Regret.", direction: "Starts as the carousel's delighted \"Wheee\", cut off sharply as she realises. \"no. No.\" quick, the second firmer. A beat. \"Regret.\" one word, deadpan and grave. Do not let the wheee finish; it is interrupted.", inlineTags: "[delighted, cut off sharply] Wheee— [quick] no. [firmer] No. [beat] [deadpan, grave] Regret." },
  { id: "FAL-03", moment: "Free-fall", text: "Tell my wheels I loved them.", direction: "Melodramatic last words, a soap-opera death scene: breathy, trembling, slow, the voice catching on \"loved\". Played completely straight. Do not laugh, and keep it a cartoon farewell, not real distress.", inlineTags: "[melodramatic, breathy, trembling] Tell my wheels I [voice catching] loved them." },
  { id: "CAR-01", moment: "Carousel", text: "I'm the black one. No, the other black one.", direction: "Waving at her owner across the hall. \"I'm the black one.\" bright, helpful, raised. Quick beat. \"No, the other black one.\" quicker, exasperated, stress on \"other\". Do not slow down; it is a hurried correction.", inlineTags: "[bright, calling across the hall] I'm the black one. [quick, exasperated] No, the other black one." },
  { id: "CAR-02", moment: "Carousel", text: "Third lap. I live here now.", direction: "Dizzy resignation. \"Third lap.\" flat, a sigh in front of it. A beat. \"I live here now.\" deadpan acceptance, almost content, stress on \"live\". Quiet. Do not sound upset.", inlineTags: "[sigh] [flat] Third lap. [beat] [deadpan acceptance] I live here now." },
  { id: "CAR-03", moment: "Carousel", text: "Pick me! Pick me! Play it cool. Pick me.", direction: "\"Pick me! Pick me!\" eager, bouncing, fast and high, the second higher. A sudden stop, and \"Play it cool.\" a hushed note to herself. Then \"Pick me.\" low, slow, trying to be smooth and failing, a little desperate. The switch is the joke.", inlineTags: "[eager, bouncing] Pick me! Pick me! [sudden hush, to herself] Play it cool. [low, trying to be smooth] Pick me." },
  { id: "CNV-01", moment: "Conveyor", text: "I've seen parts of this airport you never will.", direction: "Smug and mysterious, bragging like a seasoned traveller, slow and knowing, a little conspiratorial. Stress on \"never\". Not threatening: smug.", inlineTags: "[smug, knowing, conspiratorial] I've seen parts of this airport you never will." },
  { id: "CNV-02", moment: "Conveyor", text: "No, no. You walk. I'll take the belt.", direction: "Mock generosity. \"No, no.\" sweetly insistent. \"You walk.\" magnanimous. \"I'll take the belt.\" a martyr's sigh in it, stress on \"I'll\". Light, sarcastic, not angry.", inlineTags: "[sweetly insistent] No, no. You walk. [martyr's sigh] I'll take the belt." },
  { id: "CNV-03", moment: "Conveyor", text: "Are we there yet?", direction: "A bored child in the back seat: whiny, drawn out, sing-song, the \"yet\" stretched and rising. Not loud.", inlineTags: "[bored, whiny, sing-song] Are we there yet?" },
  { id: "INV-01", moment: "Upside down", text: "Wheels up. Not like that.", direction: "\"Wheels up.\" bright, like a pilot. A beat as she realises she is upside down. \"Not like that.\" flat, disgruntled, stress on \"that\". The deflation is the joke.", inlineTags: "[bright, like a pilot] Wheels up. [beat] [flat, disgruntled] Not like that." },
  { id: "INV-02", moment: "Upside down", text: "This side up. It says so. Right there.", direction: "Mounting indignation, each sentence more pointed than the last, as if jabbing a finger at the label. \"This side up.\" clipped. \"It says so.\" sharper. \"Right there.\" slow and emphatic, a word at a time. Not shouting.", inlineTags: "[clipped] This side up. [sharper] It says so. [slow, emphatic] Right there." },
  { id: "INV-03", moment: "Upside down", text: "The shampoo was not ready for this.", direction: "Quiet dread, a horror-film whisper about a domestic disaster, slow, stress on \"not\". Played as tragedy; do not wink.", inlineTags: "[quiet dread, slow] The shampoo was not ready for this." },
  { id: "DRK-01", moment: "Dark hold", text: "I love the dark. Very slimming.", direction: "Quiet and close (recorded soft). \"I love the dark.\" a contented murmur. A beat. \"Very slimming.\" a smug, self-satisfied whisper, stress on \"slimming\". The callback to the scale: vanity in the hold.", inlineTags: "[contented murmur] I love the dark. [beat] [smug whisper] Very slimming." },
  { id: "DRK-02", moment: "Dark hold", text: "The golf bag snores.", direction: "A whispered complaint to a neighbour, long-suffering and gossipy, quiet, a weary sigh before it. Stress on \"snores\". Recorded soft.", inlineTags: "[weary sigh] [gossipy whisper] The golf bag snores." },
  { id: "DRK-03", moment: "Dark hold", text: "I spy, with my little zipper... nothing.", direction: "A bored game in the dark, recorded soft. \"I spy, with my little zipper...\" sing-song, playful, slowing. A long pause, looking round. \"nothing.\" flat and defeated. The pause is the joke.", inlineTags: "[sing-song, playful, slowing] I spy, with my little zipper... [long pause] [flat, defeated] nothing." },
];
