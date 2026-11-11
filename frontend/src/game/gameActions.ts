import type { Locale } from '../i18n';
import { latestStoryBeatForOverview } from '../journal/journalPresentation';
import type { Character, JournalEvent, LocationReference } from '../types';
import { routeOpen } from '../chapterOneMap';
import { visibleQuestTimeline } from '../questProgress';

export interface SuggestedAction {
  label: string;
  action: string;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  glyph: string;
  action?: string;
  mode: 'submit' | 'map' | 'custom' | 'spells' | 'prefill' | 'focus';
}

/** Engine-backed NPC dialogue for the current location and quest flags only. */
export function resolveNpcTalkAction(
  character: Character,
  t: (value: string) => string,
): SuggestedAction | null {
  const quests = character.quest_flags ?? {};
  if (
    character.location === 'The Shrine of the Forgotten'
    && (quests.bell_found || quests.bell_acquired)
    && !quests.bell_quest_complete
  ) {
    return { label: t('Return the shrine bell'), action: 'return the shrine bell to Caldus' };
  }
  if (
    character.location === 'The Shrine of the Forgotten'
    && !quests.bell_quest_accepted
    && !quests.bell_quest_complete
  ) {
    return { label: t('Talk to Caldus'), action: 'talk to Caldus about the shrine bell' };
  }
  if (
    character.location === 'The Goblin Market'
    && quests.bell_quest_accepted
    && !quests.bell_found
    && !quests.bell_acquired
    && !quests.bell_quest_complete
  ) {
    return { label: t('Ask Nib about the shrine bell'), action: 'ask Nib about the shrine bell' };
  }
  if (
    character.location === 'The Shrine of the Forgotten'
    && quests.bell_quest_complete
    && !quests.vault_hint_given
    && !quests.vault_unlocked
  ) {
    return {
      label: t('Ask Caldus about the Vault'),
      action: 'talk to Caldus about the vault of echoes',
    };
  }
  return null;
}

/** Tier-3 bosses (Bell Warden) require hero level 3+ — matches `encounters.minimum_level_for_tier`. */
const BELL_WARDEN_MIN_LEVEL = 3;

/** Boss confrontation chip when chapter rules allow a named attack at the pit. */
export function resolveQuestBossAction(
  character: Character,
  t: (value: string) => string,
): SuggestedAction | null {
  const quests = character.quest_flags ?? {};
  if (quests.chapter_one_complete || !quests.vault_unlocked) return null;
  if (character.level < BELL_WARDEN_MIN_LEVEL) return null;
  if (character.location !== "The Bell Warden's Pit" || character.in_combat) return null;
  return {
    label: t('Face the Bell Warden'),
    action: 'attack the Bell Warden',
  };
}

/** One-tap travel toward the active quest step when reachable from here. */
export function resolveQuestTravelAction(
  character: Character,
  locations: LocationReference[],
  t: (value: string) => string,
): SuggestedAction | null {
  const quests = character.quest_flags ?? {};
  const { active } = visibleQuestTimeline(quests);
  let destination = active?.location;
  if (!destination) {
    if (!quests.bell_quest_accepted && character.location === 'The Whispering Cellar') {
      destination = 'The Sunken Corridor';
    } else {
      return null;
    }
  }
  if (destination === character.location) return null;
  const node = locations.find(item => item.name === character.location);
  if (!node) return null;
  if (node.connections.includes(destination) && routeOpen(destination, quests)) {
    return {
      label: t(`Travel to ${destination}`),
      action: `travel to ${destination}`,
    };
  }
  for (const route of node.connections) {
    if (!routeOpen(route, quests)) continue;
    const hop = locations.find(item => item.name === route);
    if (hop?.connections.includes(destination) && routeOpen(destination, quests)) {
      return {
        label: t(`Travel to ${route}`),
        action: `travel to ${route}`,
      };
    }
  }
  return null;
}

export function buildQuickActions(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
  hasSpells: boolean,
  hasPotion: boolean,
): QuickAction[] {
  const enemy = character.combatant?.name ?? 'the enemy';
  if (character.in_combat) {
    const actions: QuickAction[] = [
      { id: 'attack', label: t('Attack'), description: t('Strike the enemy'), glyph: '⚔', action: `attack ${enemy}`, mode: 'submit' },
      { id: 'defend', label: t('Defend'), description: t('Brace against the next hit'), glyph: '🛡', action: 'defend', mode: 'submit' },
      { id: 'flee', label: t('Flee'), description: t('Try to break away'), glyph: '↩', action: 'flee', mode: 'submit' },
    ];
    if (hasSpells) {
      actions.push({ id: 'spell', label: t('Cast spell'), description: t('Choose a spell to cast'), glyph: '✦', mode: 'spells' });
    }
    if (hasPotion) {
      actions.push({ id: 'potion', label: t('Use potion'), description: t('Drink a healing potion'), glyph: '⚗', action: 'use potion', mode: 'submit' });
    }
    return actions;
  }
  const npcTalk = resolveNpcTalkAction(character, t);
  return [
    {
      id: 'explore',
      label: t('Explore'),
      description: t('Search the area for tracks or loot'),
      glyph: '⌕',
      action: `search ${character.location}`,
      mode: 'submit',
    },
    {
      id: 'talk',
      label: t('Talk'),
      description: npcTalk ? npcTalk.label : t('Speak or persuade'),
      glyph: '♙',
      action: npcTalk?.action,
      mode: npcTalk ? 'submit' : 'focus',
    },
    {
      id: 'travel',
      label: t('Travel'),
      description: t('Pick the next location on the map'),
      glyph: '⌖',
      mode: 'map',
    },
    {
      id: 'custom',
      label: t('Custom action'),
      description: t('Describe your own intent in words'),
      glyph: '✎',
      mode: 'custom',
    },
  ];
}

export function suggestedActions(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
): SuggestedAction[] {
  if (character.hp <= 0) return [];
  const injured = character.hp < character.max_hp;

  if (character.in_combat) {
    const enemy = character.combatant?.name ?? 'the enemy';
    const escape = { label: t('Try to escape'), action: 'flee' };
    const attack = { label: t('Attack'), action: `attack ${enemy}` };
    return injured && character.hp / character.max_hp <= 0.3
      ? [escape, attack]
      : [attack, escape];
  }

  const latest = events[events.length - 1]?.result.toLowerCase() ?? '';
  const actions: SuggestedAction[] = [];
  const npcTalk = resolveNpcTalkAction(character, t);
  if (npcTalk) actions.push(npcTalk);
  if (injured) actions.push({ label: t('Recover your strength'), action: 'rest' });

  if (latest.includes('tracks')) {
    actions.push({ label: t('Study the fresh tracks'), action: 'inspect the fresh tracks' });
  } else if (latest.includes('panel') || latest.includes('scratches')) {
    actions.push({ label: t('Inspect the stone panel'), action: 'inspect the stone panel' });
  } else if (latest.includes('gold pieces')) {
    actions.push({ label: t('Search for more clues'), action: `search ${character.location}` });
  }

  actions.push({ label: t('Search the area'), action: `search ${character.location}` });
  actions.push({ label: t('Listen for movement'), action: 'listen for movement' });
  actions.push({ label: t('Inspect the stonework'), action: 'inspect the stonework' });
  const node = locations.find(location => location.name === character.location);
  const questsFlags = character.quest_flags ?? {};
  const nextLocation = node?.connections.find(route => routeOpen(route, questsFlags));
  if (nextLocation) {
    actions.push({ label: t(`Travel to ${nextLocation}`), action: `travel to ${nextLocation}` });
    return [...actions.slice(0, 2), actions[actions.length - 1]];
  }
  return actions.slice(0, 3);
}

export function contextualChips(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
) {
  const chips = suggestedActions(character, events, locations, t);
  const talk = chips.find(item => /talk|ask|return|caldus|nib|bell/i.test(item.action));
  return chips.filter(item => {
    if (item.action === `search ${character.location}`) return false;
    if (talk && item.action === talk.action) return false;
    if (character.in_combat) {
      if (item.action === 'flee' || item.action.startsWith('attack ')) return false;
    }
    return true;
  }).slice(0, 4);
}

export interface PlayActionChip {
  key: string;
  label: string;
  action?: string;
  run?: 'map' | 'focus';
}

/** Horizontal quick chips for the text-first composer (replaces the old 2×2 grid). */
export function playActionChips(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
  hasSpells: boolean,
  hasPotion: boolean,
): PlayActionChip[] {
  const seen = new Set<string>();
  const out: PlayActionChip[] = [];
  const push = (key: string, label: string, action?: string, run?: PlayActionChip['run']) => {
    const dedupe = (action ?? run ?? key).toLowerCase();
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ key, label, action, run });
  };

  if (character.in_combat) {
    for (const item of suggestedActions(character, events, locations, t)) {
      push(item.action, item.label, item.action);
    }
    for (const quick of buildQuickActions(character, events, locations, t, hasSpells, hasPotion)) {
      if (quick.action) push(quick.id, quick.label, quick.action);
    }
    return out.slice(0, 4);
  }

  const npcTalk = resolveNpcTalkAction(character, t);
  if (npcTalk) push(npcTalk.action, npcTalk.label, npcTalk.action);

  const questBoss = resolveQuestBossAction(character, t);
  if (questBoss) push(questBoss.action, questBoss.label, questBoss.action);

  const questTravel = resolveQuestTravelAction(character, locations, t);
  if (questTravel && questTravel.action !== npcTalk?.action) {
    push(`quest-travel-${questTravel.action}`, questTravel.label, questTravel.action);
  }

  const latest = events[events.length - 1]?.result.toLowerCase() ?? '';
  if (latest.includes('tracks')) {
    push('tracks', t('Study the fresh tracks'), 'inspect the fresh tracks');
  } else if (latest.includes('panel') || latest.includes('scratches')) {
    push('panel', t('Inspect the stone panel'), 'inspect the stone panel');
  }

  const quick = buildQuickActions(character, events, locations, t, hasSpells, hasPotion);
  const explore = quick.find(item => item.id === 'explore');
  if (explore?.action) push('explore', explore.label, explore.action);
  const talk = quick.find(item => item.id === 'talk');
  if (talk?.action && talk.action !== npcTalk?.action) {
    push('talk', talk.label, talk.action);
  } else if (talk && !npcTalk) {
    push('talk', talk.label, undefined, 'focus');
  }
  push('travel', t('Travel'), undefined, 'map');
  if (
    character.character_class === 'wizard'
    && character.arcane_recovery_available
    && character.arcane_recovery_ready
    && !character.in_combat
  ) {
    push('arcane_recovery', t('Arcane Recovery'), 'arcane recovery');
  }
  if (character.hp < character.max_hp && !character.in_combat) {
    push('rest', t('Rest'), 'rest');
  }
  return out.slice(0, 4);
}

/** First chip that best matches the current scene (for visual emphasis, not a different rules path). */
export function primaryPlayChipKey(
  character: Character,
  events: JournalEvent[],
  locations: LocationReference[],
  t: (value: string) => string,
  hasSpells: boolean,
  hasPotion: boolean,
): string | null {
  const chips = playActionChips(character, events, locations, t, hasSpells, hasPotion);
  if (!chips.length) return null;
  if (character.in_combat) return chips.find(c => c.action?.startsWith('attack '))?.key ?? chips[0].key;
  const npcTalk = resolveNpcTalkAction(character, t);
  if (npcTalk) return chips.find(c => c.action === npcTalk.action)?.key ?? chips[0].key;
  const questBoss = resolveQuestBossAction(character, t);
  if (questBoss) return chips.find(c => c.action === questBoss.action)?.key ?? chips[0].key;
  if (character.hp < character.max_hp) {
    const rest = chips.find(c => c.action === 'rest');
    if (rest) return rest.key;
  }
  const latest = events[events.length - 1]?.result.toLowerCase() ?? '';
  if (latest.includes('tracks')) return chips.find(c => c.key === 'tracks')?.key ?? chips[0].key;
  if (latest.includes('panel') || latest.includes('scratches')) {
    return chips.find(c => c.key === 'panel')?.key ?? chips[0].key;
  }
  return chips.find(c => c.key === 'explore')?.key ?? chips[0].key;
}

export function scenePrompt(character: Character, events: JournalEvent[], t: (value: string) => string) {
  if (character.hp <= 0) return t('You have fallen. The cellar falls quiet around you.');
  if (character.in_combat) return t('A hostile creature is in front of you. Fight or make a run for it.');
  const { active } = visibleQuestTimeline(character.quest_flags ?? {});
  if (active && !character.quest_flags?.bell_quest_accepted && character.location === 'The Whispering Cellar') {
    return t('A stolen shrine bell is missing somewhere below. Use Travel or the current objective to head toward the shrine.');
  }
  if (character.hp < character.max_hp) return t('The immediate danger has passed. Catch your breath or press on.');

  const latest = events[events.length - 1]?.result.toLowerCase() ?? '';
  if (latest.includes('tracks')) {
    return character.location === 'The Whispering Cellar'
      ? t('Fresh tracks cross the dust and lead farther into the cellar.')
      : t('Fresh tracks lead onward from this place.');
  }
  if (latest.includes('panel') || latest.includes('scratches')) {
    return character.location === 'The Whispering Cellar'
      ? t('Scratches mark a stone panel nearby. It may be worth a closer look.')
      : t('Something nearby bears marks worth a closer look.');
  }
  if (latest.includes('return the shrine bell')) return t('Caldus welcomes the shrine bell back into the quiet shrine.');
  if (latest.includes('gold pieces tucked beneath loose stones')) {
    return character.location === 'The Whispering Cellar'
      ? t('The loose stones conceal a few coins. There may be more to find.')
      : t('You find a few coins here. There may be more to uncover.');
  }
  if (latest.includes('defeated') || latest.includes('escape')) return t('For now, the passage is quiet. You have a moment to choose your next move.');
  return character.location === 'The Whispering Cellar'
    ? t('The cellar is quiet for now. Search, listen, or inspect what catches your eye.')
    : t('This place is quiet for now. Search, listen, or travel onward.');
}

/** @deprecated Use latestStoryBeatForOverview with locale — kept for legacy callers. */
export function latestSceneNarration(events: JournalEvent[], locale: Locale = 'en') {
  return latestStoryBeatForOverview(events, locale);
}

export function isFallenError(message: string | null) {
  return Boolean(message && /fallen|can no longer act/i.test(message));
}
