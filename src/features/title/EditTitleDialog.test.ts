import { describe, expect, it } from 'vitest';
import { makeBaseTvTitle } from '../../domain/testFixtures';
import { buildTitleEditPatch, createTitleEditDraft } from './EditTitleDialog';

describe('title edit dialog', () => {
  it('saving an untouched form writes nothing, even when the Chinese name and overview are missing', () => {
    const title = makeBaseTvTitle({
      names: { original: 'Severance', en: 'Severance' },
      overview: { en: 'Only English' },
    });
    const initial = createTitleEditDraft(title, 'zh-CN');
    expect(initial.overviewLang).toBe('en');
    expect(buildTitleEditPatch(initial, initial)).toEqual({});
  });

  it('writes an edited overview back to the language it was loaded from', () => {
    const title = makeBaseTvTitle({ overview: { zh: '中文简介', en: 'English overview' } });
    const initial = createTitleEditDraft(title, 'en');
    expect(initial).toMatchObject({ overview: 'English overview', overviewLang: 'en' });
    expect(buildTitleEditPatch(initial, { ...initial, overview: 'Edited' })).toEqual({
      overview: 'Edited',
      overviewLang: 'en',
    });
  });

  it('only includes the fields that changed', () => {
    const initial = createTitleEditDraft(makeBaseTvTitle(), 'zh-CN');
    expect(buildTitleEditPatch(initial, { ...initial, posterPath: '  ', originalName: 'Renamed' })).toEqual({
      originalName: 'Renamed',
      posterPath: null,
    });
  });
});
