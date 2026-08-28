/* The adversarial story review, as tracked data.
 *
 * Owner asked for a running document of what is changing and why, so findings
 * live here as structured rows rather than in prose that goes stale. The
 * storyboard renders them; tools/story_audit.js re-measures the numbers on
 * every run so a claim here cannot quietly drift from the text it describes.
 *
 * status: OPEN | FIXING | FIXED | DECIDE   (DECIDE needs the owner, not me)
 */

const FINDINGS = [

{ id: 'F1', severity: 'CRITICAL', kind: 'plot hole', status: 'FIXED',
  title: 'The lore says Apophis passed safely. The campaign says it hit.',
  evidence:
    'js/lore.js timeline: "2029-04-13 Apophis safely passes Earth; fiction preserves a tiny ' +
    'timing residual." The campaign opening says the intercept broke it open and hell landed. ' +
    'The same lore then runs 26 fictional events from 2036 to 2099 and ends at "Five-Way War", ' +
    'which IS this game. So the lore dates the war to 2099 and the campaign opens in 2029.',
  why:
    'This is not a wording clash, it is two different centuries. Every faction origin in the ' +
    'timeline (Ashtar Declaration 2093, Farm Revolts 2095, Scrap Constellation Charter 2097, ' +
    'Parallel Declaration 2098) sits in a decade the campaign never mentions, and the campaign ' +
    'inciting event sits seventy years before any of them.',
  fix:
    'Apophis is a real object and it RETURNS. Keep the lore exactly as written: the 2029 pass is ' +
    'safe, public and on the record, and the "tiny timing residual" is the tell. The 2029 pass ' +
    'was the survey. The intercept the campaign opens on is a LATER return, in 2099, and this ' +
    'time the rock is hollow. That preserves the timeline unchanged, keeps the owner oath beat ' +
    'that hell landed, and makes "everyone else was in on it" literal: seventy years of knowing ' +
    'what the residual meant. The grievance stops being a mood and becomes a provable cover-up.',
  cost: 'Rewrite the oath date references only. No plate re-renders. Roughly 8 lines.',
  outcome:
    'DONE, and the owner improved the fix. The campaign is set in 2029, so the 27 fictional '
    'events from 2030 to 2099 were rebased into 1947 to 2029 and became the HIDDEN history '
    'rather than the future: Ashtar Declaration 2022, Farm Revolts 2024, Scrap Constellation '
    'Charter 2027, Parallel Declaration 2028, Five-Way War 2029. The timeline was also unsorted '
    'and is now ordered. The owner then supplied the real hook: Apophis was NEVER going to hit. '
    'It was cleared after 2004, it passes at twenty thousand miles, a tenth of the Moon distance, '
    'naked-eye visible, and the world had declared a holiday to watch it. THEN IT CHANGED COURSE. '
    'Rocks do not do that, and that single fact is the whole conspiracy.' },

{ id: 'F2', severity: 'CRITICAL', kind: 'arc', status: 'FIXED',
  title: 'The premise evaporates after act one.',
  evidence:
    'Measured across all 525 dialogue cells: 9 reference the inciting event. THE PLEIADES 0 of ' +
    '105, ZETA RETICULI 0 of 105, SIRIUS 0 of 105. Three of five acts never mention why any of ' +
    'this is happening.',
  why:
    'The STORY spine is strong and has real reversals: the fleet built to stop Apophis was never ' +
    'standing down; the occupation had human partners; the modifications you resent are what make ' +
    'you competitive; worlds you free become worlds you hold. Six lines per power carry a tragedy. ' +
    'The other 105 cells per power ignore it completely. The arc exists in one percent of the text ' +
    'and the player spends the other ninety-nine percent taking depots.',
  fix:
    'Every act gets a THREAD LINE: one revelation from the spine that its seven worlds keep ' +
    'circling. Act 2 is the partners, act 3 is the breeding, act 4 is what you become by holding, ' +
    'act 5 is the machines you cannot switch off. Two or three worlds per act must carry it ' +
    'explicitly, so a player who reads only the ground text still gets the story.',
  cost: 'About 40 rewritten cells. No re-renders: this is text over existing plates.',
  outcome:
    'DONE. Every act now carries the inciting event: 10, 4, 3, 4 and 6 cells across the five, '
    'no zeros, up from three acts at zero. The Sirius link was the best find: the machine units '
    'inside Apophis were maker-format, so the foundry that stamps them is the Parallel own, and '
    'their act now discovers its build standard in the Earth delivery. The metric was WIDENED to '
    'catch phrasing like "the Earth event", which is goalpost-moving unless checked, so it now '
    'prints every match for inspection. Widening also exposed false positives in the original '
    'count: "cut into the rock" is not a premise reference and had been counted as one.' },

{ id: 'F3', severity: 'MAJOR', kind: 'voice', status: 'FIXED',
  title: 'Thirty of thirty-five location descriptions are labels, not narration.',
  evidence:
    'Measured: 30 of 35 ground lines open on a noun phrase with no finite verb. "A coastal city ' +
    'under the fall, where the fragments came down." "A hall of tuned crystal pipes standing ' +
    'upright in nebula light." "The wreck yards, a plain of hulls from a hundred builders."',
  why:
    'Owner raised this first and it is systemic, not a one-off. These read as museum placards or ' +
    'stage directions. Nobody narrates in noun phrases. The player is being handed a caption where ' +
    'they were promised a voice. I wrote fourteen of these myself in exactly the same register, so ' +
    'this is a defect I reproduced rather than caught.',
  fix:
    'Rewrite all 35 as something a person would actually say aloud, leading with the verb and the ' +
    'event rather than the label. Before: "A coastal city under the fall, where the fragments came ' +
    'down whole and split open in the streets." After: "The fragments came down whole over the ' +
    'harbour district and split open in the streets. Whatever was riding inside was already awake."',
  cost: '35 ground lines and 35 works lines. No re-renders.',
  outcome:
    'DONE. All 35 rewritten. Re-measured after: 0 of 35 still read as labels, down from 30. The '
    'detector itself was wrong on the first pass and flagged five good lines because its verb list '
    'lacked floats, cut, climbs, rises and strips; it was widened and then proved both ways, that '
    'it still flags the original label opening and no longer flags the replacement.' },

{ id: 'F4', severity: 'MAJOR', kind: 'formula', status: 'FIXED',
  title: 'Two thirds of all closing lines announce their own world like a status report.',
  evidence:
    'Measured: 113 of 175 beat-3 lines open by naming the world. "Proxima d is sorted and every ' +
    'plate is filed." "The flare shelter runs to quota." The Parallel uses the construction ' +
    '"X RESTORED" in 31 of its 105 lines, and its top two words across the whole campaign are ' +
    'restored (33) and secured (23).',
  why:
    'It is a template, and templates read as filler however good the individual sentence is. The ' +
    'third beat is the only place a power says what it MADE of a world, which is where its morality ' +
    'actually lives, and two thirds of them are spent restating a place name the player can see on ' +
    'screen.',
  fix:
    'Cap world-naming openers at roughly one in five. Give the third beat a job: it must state a ' +
    'CONSEQUENCE somebody pays, not a status. For the Parallel, retire "RESTORED" as a default and ' +
    'let the log break register when the unit notices something it cannot file.',
  cost: 'About 90 rewritten lines. No re-renders.',
  outcome:
    'DONE. World-naming beat-3 openers 113 to 31, and the Parallel stamp 31 to 8. The first '
    'metric over-counted: "The narrows are open and the gate is kept lit" reads fine, so the fix '
    'targeted the two real formulas, the RESTORED stamp and a bare proper noun in the subject '
    'slot. 49 stamps dropped and 37 proper nouns swapped for the thing itself. The reversal pass '
    'then introduced a NEW repetition of its own, "the vault is" fourteen times, which the audit '
    'caught and which was varied back down to five.' },

{ id: 'F5', severity: 'MAJOR', kind: 'structure', status: 'FIXED',
  title: 'Every world has the same three-act shape, thirty-five times, with no reversal.',
  evidence:
    'All 35 worlds run arrive, take, normalise. No world in the game is lost, refused, discovered ' +
    'to be a trap, taken by the wrong side, or turns out not to matter. The six MOMENT variants ' +
    '(contested, renegade, retaken, flawless, defeat) change the words but not the shape.',
  why:
    'A hero story needs the floor to drop. Nothing here ever costs the player a belief. The strongest ' +
    'single image in the whole campaign, the Parallel reaching the origin of every order it has ' +
    'obeyed and finding the chairs empty, works precisely because it inverts the pattern, and it is ' +
    'the only one that does.',
  fix:
    'One reversal per act, in the fifth or sixth world, before the seat. Candidates: a world that ' +
    'was already yours and had been reporting falsely; a world the power takes and then has to give ' +
    'back; a world where the enemy garrison surrenders and the power has no policy for prisoners; a ' +
    'world that turns out to be a decoy while the real objective moves. Five reversals total.',
  cost: 'Five worlds rewritten plus roughly 25 plates re-rendered.',
  outcome:
    'DONE as text; the plates still need re-rendering. One reversal per act, all at wi 5, the '
    'world before the seat: TITAN finds a fragment hull decades older than Apophis, STEROPE finds '
    'Earth protection order granted then withdrawn unsigned, ZETA-2 d finds Earth in the ledger '
    'as a SUPPLIER under human countersignature, THE DARK LOCKER finds the Free Captains carried '
    'Compact freight for forty years, and THE COMPANION drops its mast and the orders keep '
    'arriving anyway. That last one ends on the Parallel recording the word DECORATIVE.' },

{ id: 'F6', severity: 'MAJOR', kind: 'waste', status: 'DECIDE',
  title: 'The best backstory in the project is invisible to the player.',
  evidence:
    'js/lore.js holds 130 mythos operations, 37 Archive War missions, a 65-event timeline and 26 ' +
    'fictional events between 2036 and 2099. Player-facing modules reference this vocabulary ZERO ' +
    'times: no Archive War, no Severance, no Archon, no Roswell, no Serpent Court.',
  why:
    'Owner said the lore feels out of context with the plot. The measurement says something sharper: ' +
    'it is not in the plot at all. And it contains exactly the material the campaign is missing. ' +
    'The Ashtar Declaration is where the Federation comes from. The Farm Revolts are the harvest the ' +
    'Compact is still running. The Scrap Constellation Charter is the founding of the Free Captains, ' +
    'a name the dialogue never once uses. Sol Protective Quarantine is why humanity is alone.',
  fix:
    'Bind, do not delete. Give each of the five acts one dated line from the timeline, spoken by a ' +
    'power that was there. The Federation should cite the Ashtar Declaration by date the way it ' +
    'cites its own registry. Then either surface the mythos operations as unlockable field-manual ' +
    'entries, or accept they are an author bible and stop calling them lore.',
  cost: 'Five dated lines minimum. Full field-manual surfacing is a separate feature.' },

{ id: 'F7', severity: 'MINOR', kind: 'data', status: 'OPEN',
  title: 'Timeline is unsorted and story text carries curly apostrophes.',
  evidence:
    'The timeline places 2094 to 2099 immediately before December 1960, so it cannot be read in ' +
    'order. js/story.js contains typographic apostrophes (oppressor and campaign possessives) where ' +
    'the rest of the project uses straight quotes.',
  why:
    'Neither is player visible today, which is exactly why both will survive until something renders ' +
    'the timeline and it comes out shuffled.',
  fix: 'Sort the timeline by parsed date. Normalise apostrophes at the source.',
  cost: 'Minutes.' },

];

if (typeof module !== 'undefined') module.exports = { FINDINGS };
