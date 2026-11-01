// FHS-670: which screen a feedback answer is about, and the per-visit ID.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getVisitId,
  screenFeedbackByKey,
  screenFeedbackFor,
} from '../../../../../src/app/lib/screen-feedback';

describe('screenFeedbackFor', () => {
  it('reads the dashboard tab from the address', () => {
    expect(screenFeedbackFor('/t/smiths/dashboard', '?tab=meals').key).toBe('meals');
  });

  it('treats the dashboard with no tab as the Family Dashboard', () => {
    expect(screenFeedbackFor('/t/smiths/dashboard', '').key).toBe('home');
  });

  it('falls back to the Family Dashboard for an unknown tab', () => {
    expect(screenFeedbackFor('/t/smiths/dashboard', '?tab=nope').key).toBe('home');
  });

  it('names a page by its path', () => {
    expect(screenFeedbackFor('/t/smiths/reward-settings', '').area).toBe('Reward settings');
  });

  it('asks about "this screen" when the page is not listed', () => {
    const s = screenFeedbackFor('/t/smiths/somewhere-new', '');
    expect(s.key).toBe('other');
    expect(s.area).toBe('this screen');
  });

  it('looks up a Child World tab by key', () => {
    expect(screenFeedbackByKey('child-journal').area).toBe('the Journal');
  });
});

describe('getVisitId', () => {
  beforeEach(() => sessionStorage.clear());

  it('gives the same ID for every answer in one visit', () => {
    expect(getVisitId()).toBe(getVisitId());
  });

  it('starts a new visit once the tab storage is gone', () => {
    const first = getVisitId();
    sessionStorage.clear();
    expect(getVisitId()).not.toBe(first);
  });

  it('keeps one ID when the browser blocks tab storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(getVisitId()).toBe(getVisitId());
    } finally {
      spy.mockRestore();
    }
  });
});
