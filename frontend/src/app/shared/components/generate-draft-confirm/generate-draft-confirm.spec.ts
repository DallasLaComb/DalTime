import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerateDraftConfirmComponent } from './generate-draft-confirm';

describe('GenerateDraftConfirmComponent', () => {
  let fixture: ComponentFixture<GenerateDraftConfirmComponent>;

  async function mount(inputs: Record<string, unknown>): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [GenerateDraftConfirmComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GenerateDraftConfirmComponent);
    for (const [k, v] of Object.entries({
      open: true,
      monthLabel: 'July 2026',
      runsUsed: 3,
      maxRuns: 10,
      ...inputs,
    })) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
  }
  const text = (id: string): string =>
    fixture.nativeElement
      .querySelector(`[data-testid="${id}"]`)
      .textContent.replace(/\s+/g, ' ')
      .trim();

  it('explains what a run does before it is spent', async () => {
    await mount({});
    const t = text('generate-draft-explainer');
    expect(t).toContain('July 2026');
    expect(t).toContain('weekly availability');
    expect(t).toContain('saved as drafts');
    expect(t).toContain("can't see them until you publish");
    expect(t).toContain('stay unfilled');
    // what a run fills is the SHIFTS NEEDED (slots) — never described as "the open shifts"
    expect(t).toContain('fills the shifts needed (the slots on the Shifts needed page)');
    expect(t).toContain('running again only fills slots that are still unfilled');
    expect(t).not.toContain('fills the open shifts');
    expect(t).not.toContain('only fills what is still open');
  });

  it('states the cost: 1 of the monthly runs, how many are used and how many remain', async () => {
    await mount({ runsUsed: 3, maxRuns: 10 });
    expect(text('generate-draft-runs')).toContain('1 of 10 monthly runs');
    expect(text('generate-draft-runs')).toContain('3 are already used');
    expect(text('generate-draft-runs')).toContain('6 will be left');
  });

  it('never shows a negative number of runs left', async () => {
    await mount({ runsUsed: 10, maxRuns: 10 });
    expect(text('generate-draft-runs')).toContain('0 will be left');
  });

  it('names the manager when generating for someone else', async () => {
    await mount({ managerName: 'Mona Lisa' });
    expect(text('generate-draft-explainer')).toContain("Mona Lisa's");
  });

  it('emits confirmed / cancelled from its buttons', async () => {
    await mount({});
    const confirmed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    const click = (id: string) =>
      (
        fixture.nativeElement.querySelector(`[data-testid="${id}"] button`) ??
        fixture.nativeElement.querySelector(`[data-testid="${id}"]`)
      ).click();

    click('confirmation-modal-confirm');
    click('confirmation-modal-cancel');

    expect(confirmed).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('shows the open-shift note whenever open shifts exist — even when slots are also open', async () => {
    await mount({ openSlots: 4, openShifts: 2 });
    expect(text('generate-draft-open-shifts')).toContain('2 open shifts (no employee assigned)');
    expect(text('generate-draft-open-shifts')).toContain("Generate Draft doesn't fill those");
    expect(text('generate-draft-open-shifts')).toContain('Fill Shift');
    // slots are open, so the run-cost line is shown too, and the two don't contradict
    expect(text('generate-draft-runs')).toContain('1 of 10 monthly runs');
  });

  it('shows the same note, once, when there is nothing to generate', async () => {
    await mount({ openSlots: 0, openShifts: 1 });
    const notes = fixture.nativeElement.querySelectorAll(
      '[data-testid="generate-draft-open-shifts"]',
    );
    expect(notes).toHaveLength(1);
    expect(text('generate-draft-open-shifts')).toContain('1 open shift (no employee assigned)');
    expect(text('generate-draft-open-shifts')).toContain("doesn't fill that one");
    expect(text('generate-draft-nothing-open')).toContain(
      'no run will be used'.replace('no', 'No'),
    );
  });

  it('leaves the note out when there are no open shifts', async () => {
    await mount({ openSlots: 3, openShifts: 0 });
    expect(
      fixture.nativeElement.querySelector('[data-testid="generate-draft-open-shifts"]'),
    ).toBeNull();
  });
});
