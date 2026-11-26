import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CharacterWizard } from './CharacterWizard';
import { LocaleProvider } from './i18n';
import type { ReferenceCatalog } from './types';
import catalogJson from './test/referenceCatalogMvp.json';

const catalog = catalogJson as ReferenceCatalog;

describe('CharacterWizard stepper labels', () => {
  it('shows 01 for step 1 and 10 for step 10 (not 010)', () => {
    localStorage.setItem('app_locale', 'cs');
    render(
      <LocaleProvider>
        <CharacterWizard
          catalog={catalog}
          presets={[]}
          spells={[]}
          busy={false}
          error={null}
          onCreate={() => {}}
          onPreset={() => {}}
          onCancel={() => {}}
        />
      </LocaleProvider>,
    );
    const progress = document.querySelector('.wizard-progress');
    expect(progress).toBeTruthy();
    const labels = Array.from(progress!.querySelectorAll('.wizard-progress-step > span')).map(
      node => node.textContent?.trim() ?? '',
    );
    const numberLabels = labels.filter(l => /^\d{2}$/.test(l));
    expect(numberLabels).toContain('01');
    expect(numberLabels).toContain('10');
    expect(labels).not.toContain('010');
  });
});