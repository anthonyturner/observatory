import { TestBed } from '@angular/core/testing';
import {
  ADAM,
  ELEVENLABS_ON,
  RACHEL,
  fakeCatalog,
} from '../../../../core/voice/testing/voice-catalog-fixture';
import { CatalogState } from '../../../../core/voice/voice-catalog.types';
import { VoiceChoice } from '../../../../core/voice/voice-choice';
import { VoicePick } from '../../../../core/voice/voice-pick';
import { VoicePicker } from './voice-picker';

async function render(state: CatalogState = ELEVENLABS_ON) {
  localStorage.clear();
  const pick = { chooseEngine: vi.fn(async () => undefined), chooseVoice: vi.fn() };
  TestBed.configureTestingModule({
    providers: [fakeCatalog(state).provider, { provide: VoicePick, useValue: pick }],
  });
  const fixture = TestBed.createComponent(VoicePicker);
  const choice = TestBed.inject(VoiceChoice);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const radios = Array.from(element.querySelectorAll<HTMLInputElement>('input[type=radio]'));
  const update = () => fixture.whenStable();
  return { element, radios, pick, choice, update };
}

const selectOf = (element: HTMLElement) => element.querySelector('select');

describe('VoicePicker', () => {
  it('offers Kokoro, chosen, and ElevenLabs, in one labelled group', async () => {
    const { element, radios } = await render();

    expect(element.querySelector('legend')?.textContent).toContain('Reply voice');
    expect(radios.map((radio) => radio.parentElement?.textContent?.trim())).toEqual([
      'Kokoro · in this browser',
      'ElevenLabs',
    ]);
    expect(radios.map((radio) => radio.checked)).toEqual([true, false]);
    expect(radios[1].disabled).toBe(false);
    expect(selectOf(element)).toBeNull();
  });

  it('picks ElevenLabs when its option is chosen', async () => {
    const { radios, pick } = await render();

    radios[1].click();

    expect(pick.chooseEngine).toHaveBeenCalledWith('elevenlabs');
  });

  it('lists the account’s voices once ElevenLabs is chosen, the chosen one selected', async () => {
    const { element, choice, pick, update } = await render();
    choice.chooseEngine('elevenlabs');
    choice.chooseVoice(ADAM.id);
    await update();

    const select = selectOf(element);
    expect(Array.from(select?.options ?? [], (option) => option.text)).toEqual([
      RACHEL.name,
      ADAM.name,
    ]);
    expect(select?.value).toBe(ADAM.id);
    expect(element.querySelector('label.voice')?.textContent).toContain('ElevenLabs voice');

    if (!select) throw new Error('no voice list');
    select.value = RACHEL.id;
    select.dispatchEvent(new Event('change'));
    expect(pick.chooseVoice).toHaveBeenCalledWith(RACHEL.id);
  });

  it('shows ElevenLabs off as not offered, with the reason', async () => {
    const { element, radios, choice, update } = await render({ status: 'off' });
    choice.chooseEngine('elevenlabs');
    await update();

    const elevenLabs = radios[1];
    expect(elevenLabs.disabled).toBe(true);
    expect(elevenLabs.checked).toBe(false);
    expect(radios[0].checked).toBe(true);
    expect(elevenLabs.parentElement?.title).toBe('ElevenLabs is off: no key');
    const describedBy = elevenLabs.getAttribute('aria-describedby') ?? '';
    expect(element.querySelector(`#${describedBy}`)?.textContent).toBe('ElevenLabs is off: no key');
    expect(selectOf(element)).toBeNull();
  });
});
