import type { AppScreen } from './types';

export const ROOT_TAB_SCREENS: AppScreen[] = ['home', 'game', 'character', 'more'];

export function isRootTab(screen: AppScreen): boolean {
  return ROOT_TAB_SCREENS.includes(screen);
}

export interface NavigationTransition {
  screen: AppScreen;
  stack: AppScreen[];
}

function pushPrevious(stack: AppScreen[], screen: AppScreen): AppScreen[] {
  if (stack[stack.length - 1] === screen) return stack;
  return [...stack, screen];
}

export function navigateScreen(
  stack: AppScreen[],
  current: AppScreen,
  next: AppScreen,
  options?: { hasCharacter?: boolean },
): NavigationTransition {
  const hasCharacter = options?.hasCharacter ?? true;
  if (next === 'game' && !hasCharacter) {
    return { screen: 'home', stack: [] };
  }
  if (isRootTab(next)) {
    return { screen: next, stack: [] };
  }
  if (current === next) {
    return { screen: current, stack };
  }
  return { screen: next, stack: pushPrevious(stack, current) };
}

export function goBackScreen(stack: AppScreen[], current: AppScreen): NavigationTransition {
  if (current === 'create') {
    return { screen: 'home', stack: [] };
  }
  if (stack.length > 0) {
    const nextStack = [...stack];
    const previous = nextStack.pop() as AppScreen;
    return { screen: previous, stack: nextStack };
  }
  if (!isRootTab(current)) {
    return { screen: 'home', stack: [] };
  }
  return { screen: current, stack };
}

export function canGoBackFrom(_stack: AppScreen[], current: AppScreen): boolean {
  if (current === 'create') return true;
  return !isRootTab(current);
}
