/**
 * Word (.docx) export builders — corporate-standard formatting.
 *
 * Visual rules:
 *   - Microsoft typography defaults: Calibri 11pt body, Georgia serif for
 *     headings (sized 22/16/13pt), forest-green (#2C4A35) heading color.
 *   - Document properties wired through to Word's Info panel (Title, Author,
 *     Subject, Keywords) so the file is searchable in OneDrive/SharePoint.
 *   - Page header with project + snapshot date; footer with Stride wordmark
 *     and "Page X of Y".
 *   - Tables: header row in forest-green with white text; data rows in alt
 *     cream shading; subtle gray cell borders.
 *   - Action items: unicode checkboxes that Word users can manually mark or
 *     replace with native "Developer → Check Box Content Control".
 *   - Filename helper strips Unicode punctuation so HTTP Content-Disposition
 *     stays valid ASCII.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type {
  ActionItem,
  BriefArtifact,
  MeetingArtifact,
  MeetingNote,
  Milestone,
  Risk,
  TrackerState,
  Workstream,
} from '../shared/types';

// ───── Brand palette ─────

const FOREST = '2C4A35';
const FOREST_DARK = '1F3526';
const CHARCOAL = '2A2A2A';
const CHARCOAL_SOFT = '4A4A4A';
const CHARCOAL_MUTE = '7A7A7A';
const CREAM = 'F7F5F1';
const CREAM_WARM = 'EFEBE2';
const RULE = 'D9D2C5';
const WHITE = 'FFFFFF';
const RAG_GREEN = '2C4A35';
const RAG_AMBER = 'A6792A';
const RAG_RED = '8C2A2A';
const RAG_NEUTRAL = '7A7A7A';

const BODY_FONT = 'Calibri';
const HEAD_FONT = 'Georgia';

// Sizes are in half-points (Word convention). 22 = 11pt body.
const SIZE_BODY = 22;
const SIZE_SMALL = 18;
const SIZE_TINY = 16;
const SIZE_H1 = 44; // 22pt
const SIZE_H2 = 32; // 16pt
const SIZE_H3 = 26; // 13pt

// ───── Primitives ─────

function p(text: string, opts?: { bold?: boolean; color?: string; italic?: boolean; size?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italic,
        color: opts?.color ?? CHARCOAL,
        font: BODY_FONT,
        size: opts?.size ?? SIZE_BODY,
      }),
    ],
  });
}

function muted(text: string): Paragraph {
  return p(text, { color: CHARCOAL_MUTE, italic: true, size: SIZE_SMALL });
}

function eyebrow(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        color: CHARCOAL_MUTE,
        font: BODY_FONT,
        size: SIZE_TINY,
        bold: true,
        characterSpacing: 80,
      }),
    ],
  });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [
      new TextRun({ text, color: FOREST, bold: true, font: HEAD_FONT, size: SIZE_H1 }),
    ],
  });
}
function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({ text, color: FOREST, bold: true, font: HEAD_FONT, size: SIZE_H2 }),
    ],
  });
}
function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({ text, color: FOREST_DARK, bold: true, font: HEAD_FONT, size: SIZE_H3 }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    numbering: { reference: 'stride-bullets', level: 0 },
    children: [new TextRun({ text, color: CHARCOAL, font: BODY_FONT, size: SIZE_BODY })],
  });
}

function checkboxItem(text: string, done: boolean): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: done ? '☑  ' : '☐  ', color: FOREST, font: BODY_FONT, size: SIZE_BODY }),
      new TextRun({ text, color: CHARCOAL, font: BODY_FONT, size: SIZE_BODY, strike: done }),
    ],
  });
}

function ruleParagraph(): Paragraph {
  return new Paragraph({
    border: { bottom: { color: RULE, size: 6, style: BorderStyle.SINGLE, space: 1 } },
    spacing: { after: 160 },
    children: [],
  });
}

const NUMBERING = {
  config: [
    {
      reference: 'stride-bullets',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 200 } } },
        },
      ],
    },
  ],
};

// ───── Cover-style title block ─────

function titleBlock(title: string, subtitle: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: 'STRIDE',
          color: FOREST,
          font: BODY_FONT,
          size: SIZE_TINY,
          bold: true,
          characterSpacing: 200,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: title, color: FOREST, font: HEAD_FONT, size: SIZE_H1, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: subtitle, color: CHARCOAL_MUTE, font: BODY_FONT, size: SIZE_SMALL, italics: true }),
      ],
    }),
    ruleParagraph(),
  ];
}

// ───── Tables ─────

const COL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
  left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
  right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
};

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: FOREST, fill: FOREST },
    borders: COL_BORDERS,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: text.toUpperCase(),
            color: WHITE,
            bold: true,
            font: BODY_FONT,
            size: SIZE_TINY,
            characterSpacing: 80,
          }),
        ],
      }),
    ],
  });
}

function bodyCell(text: string | Paragraph[], width: number, opts?: { stripe?: boolean; pillColor?: string }): TableCell {
  const fill = opts?.stripe ? CREAM_WARM : WHITE;
  const children: Paragraph[] = Array.isArray(text)
    ? text
    : [
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text, color: CHARCOAL, font: BODY_FONT, size: SIZE_BODY }),
          ],
        }),
      ];
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: fill, fill },
    borders: COL_BORDERS,
    children,
  });
}

function pillCell(label: string, width: number, color: string, stripe: boolean): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: stripe ? CREAM_WARM : WHITE, fill: stripe ? CREAM_WARM : WHITE },
    borders: COL_BORDERS,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: label.toUpperCase(),
            color,
            bold: true,
            font: BODY_FONT,
            size: SIZE_TINY,
            characterSpacing: 80,
          }),
        ],
      }),
    ],
  });
}

function sevColor(s: Risk['severity']): string {
  return s === 'high' ? RAG_RED : s === 'medium' ? RAG_AMBER : RAG_GREEN;
}

function ragColor(r: Workstream['rag']): string {
  return r === 'red' ? RAG_RED : r === 'amber' ? RAG_AMBER : RAG_GREEN;
}

function milestoneColor(s: Milestone['status']): string {
  return s === 'shipped' ? RAG_GREEN : s === 'in-flight' ? RAG_AMBER : s === 'slipping' ? RAG_RED : RAG_NEUTRAL;
}

function risksTable(risks: Risk[]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('Severity', 14), headerCell('Risk', 56), headerCell('Owner', 16), headerCell('Status', 14)],
    }),
    ...risks.map(
      (r, i) =>
        new TableRow({
          children: [
            pillCell(r.severity, 14, sevColor(r.severity), i % 2 === 1),
            bodyCell(r.notes ? `${r.title} — ${r.notes}` : r.title, 56, { stripe: i % 2 === 1 }),
            bodyCell(r.owner ?? '—', 16, { stripe: i % 2 === 1 }),
            bodyCell(r.status, 14, { stripe: i % 2 === 1 }),
          ],
        }),
    ),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function workstreamsTable(workstreams: Workstream[]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('RAG', 12), headerCell('Workstream', 26), headerCell('Owner', 18), headerCell('Rationale', 44)],
    }),
    ...workstreams.map(
      (w, i) =>
        new TableRow({
          children: [
            pillCell(w.rag, 12, ragColor(w.rag), i % 2 === 1),
            bodyCell(w.name, 26, { stripe: i % 2 === 1 }),
            bodyCell(w.owner ?? '—', 18, { stripe: i % 2 === 1 }),
            bodyCell(w.rationale, 44, { stripe: i % 2 === 1 }),
          ],
        }),
    ),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function milestonesTable(milestones: Milestone[]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [headerCell('Status', 18), headerCell('Milestone', 60), headerCell('Date', 22)],
    }),
    ...milestones.map(
      (m, i) =>
        new TableRow({
          children: [
            pillCell(m.status, 18, milestoneColor(m.status), i % 2 === 1),
            bodyCell(m.title, 60, { stripe: i % 2 === 1 }),
            bodyCell(m.date, 22, { stripe: i % 2 === 1 }),
          ],
        }),
    ),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function actionItemsTable(items: ActionItem[]): Table {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Done', 8),
        headerCell('Action', 50),
        headerCell('Owner', 18),
        headerCell('Due', 14),
        headerCell('Status', 10),
      ],
    }),
    ...items.map((a, i) => {
      const stripe = i % 2 === 1;
      const fill = stripe ? CREAM_WARM : WHITE;
      const checkPara = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: a.status === 'done' ? '☑' : '☐',
            color: a.status === 'done' ? FOREST : CHARCOAL_MUTE,
            font: BODY_FONT,
            size: SIZE_BODY,
          }),
        ],
      });
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: fill, fill },
            borders: COL_BORDERS,
            children: [checkPara],
          }),
          bodyCell(a.title, 50, { stripe }),
          bodyCell(a.owner ?? '—', 18, { stripe }),
          bodyCell(a.dueDate ?? '—', 14, { stripe }),
          bodyCell(a.status, 10, { stripe }),
        ],
      });
    }),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

// ───── Page chrome ─────

function pageHeader(label: string): Header {
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 0 },
        border: { bottom: { color: RULE, size: 6, style: BorderStyle.SINGLE, space: 4 } },
        children: [
          new TextRun({
            text: 'STRIDE',
            color: FOREST,
            font: BODY_FONT,
            size: SIZE_TINY,
            bold: true,
            characterSpacing: 160,
          }),
          new TextRun({
            text: `   ·   ${label}`,
            color: CHARCOAL_MUTE,
            font: BODY_FONT,
            size: SIZE_TINY,
          }),
        ],
      }),
    ],
  });
}

function pageFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 0 },
        border: { top: { color: RULE, size: 6, style: BorderStyle.SINGLE, space: 4 } },
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: 'stride.chantelhill.com',
            color: CHARCOAL_MUTE,
            font: BODY_FONT,
            size: SIZE_TINY,
          }),
          new TextRun({ text: '\t\t', font: BODY_FONT }),
          new TextRun({ text: 'Page ', color: CHARCOAL_MUTE, font: BODY_FONT, size: SIZE_TINY }),
          new TextRun({ children: [PageNumber.CURRENT], color: CHARCOAL_MUTE, font: BODY_FONT, size: SIZE_TINY }),
          new TextRun({ text: ' of ', color: CHARCOAL_MUTE, font: BODY_FONT, size: SIZE_TINY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: CHARCOAL_MUTE, font: BODY_FONT, size: SIZE_TINY }),
        ],
      }),
    ],
  });
}

interface DocOptions {
  title: string;
  subject: string;
  description: string;
  headerLabel: string;
}

function buildDocument(children: Array<Paragraph | Table>, opts: DocOptions): Document {
  return new Document({
    creator: 'Stride',
    title: opts.title,
    subject: opts.subject,
    description: opts.description,
    keywords: 'Stride, project management, status, brief, meeting',
    numbering: NUMBERING,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1280, right: 1280 },
          },
        },
        headers: { default: pageHeader(opts.headerLabel) },
        footers: { default: pageFooter() },
        children,
      },
    ],
  });
}

// ───── BRIEF ─────

export async function briefToDocx(brief: BriefArtifact): Promise<Buffer> {
  const date = new Date(brief.generatedAt);
  const dateLabel = date.toLocaleString();
  const sections: Array<Paragraph | Table> = [];

  sections.push(...titleBlock('Morning Brief', dateLabel));

  sections.push(h2('Yesterday'));
  sections.push(p(brief.yesterdayProgress));

  if (brief.todayMeetings.length > 0) {
    sections.push(h2('Today'));
    for (const m of brief.todayMeetings) {
      sections.push(h3(`${m.title}  ·  ${m.time}`));
      for (const line of m.prepNotes.split('\n').filter(Boolean)) {
        if (line.startsWith('-')) sections.push(bullet(line.replace(/^[-•]\s*/, '')));
        else sections.push(p(line));
      }
    }
  }

  if (brief.risks.length > 0) {
    sections.push(h2('Risks'));
    sections.push(risksTable(brief.risks));
  }

  sections.push(h2('Standup draft'));
  sections.push(p(brief.standupDraft));

  sections.push(h2('Exec update draft'));
  sections.push(p(brief.execUpdateDraft));

  if (brief.openActionItems.length > 0) {
    sections.push(h2('Open action items'));
    sections.push(actionItemsTable(brief.openActionItems));
  }

  return Packer.toBuffer(
    buildDocument(sections, {
      title: 'Morning Brief',
      subject: 'Project status',
      description: 'Stride morning brief',
      headerLabel: `Morning brief · ${date.toISOString().slice(0, 10)}`,
    }),
  );
}

// ───── MEETING ARTIFACT ─────

export async function meetingArtifactToDocx(artifact: MeetingArtifact): Promise<Buffer> {
  const dateLabel = new Date(artifact.generatedAt).toLocaleString();
  const sections: Array<Paragraph | Table> = [];

  sections.push(...titleBlock(artifact.meetingTitle, `Meeting artifact · ${dateLabel}`));

  if (artifact.actionItems.length > 0) {
    sections.push(h2('Action items'));
    sections.push(actionItemsTable(artifact.actionItems));
  }

  if (artifact.summaries) {
    sections.push(h2('Summaries'));
    if (artifact.summaries.team) {
      sections.push(h3('Team'));
      for (const line of artifact.summaries.team.split('\n').filter(Boolean)) sections.push(p(line));
    }
    if (artifact.summaries.exec) {
      sections.push(h3('Exec'));
      for (const line of artifact.summaries.exec.split('\n').filter(Boolean)) sections.push(p(line));
    }
    if (artifact.summaries.client) {
      sections.push(h3('Client'));
      for (const line of artifact.summaries.client.split('\n').filter(Boolean)) sections.push(p(line));
    }
  }

  if (artifact.riskEntries.length > 0) {
    sections.push(h2('New risk register entries'));
    sections.push(risksTable(artifact.riskEntries));
  }

  if (artifact.followUpInvites.length > 0) {
    sections.push(h2('Suggested follow-up invites'));
    for (const f of artifact.followUpInvites) {
      sections.push(h3(f.title));
      if (f.attendees.length > 0) sections.push(muted(`Attendees: ${f.attendees.join(', ')}`));
      sections.push(p(f.rationale));
    }
  }

  if (artifact.ticketDrafts.length > 0) {
    sections.push(h2('Ticket drafts'));
    for (const t of artifact.ticketDrafts) {
      sections.push(h3(t.title));
      for (const line of t.body.split('\n').filter(Boolean)) sections.push(p(line));
    }
  }

  return Packer.toBuffer(
    buildDocument(sections, {
      title: artifact.meetingTitle,
      subject: 'Meeting artifact',
      description: 'Stride meeting artifact',
      headerLabel: artifact.meetingTitle,
    }),
  );
}

// ───── NOTE ─────

export async function noteToDocx(note: MeetingNote): Promise<Buffer> {
  const sections: Paragraph[] = [];
  const subtitle = `${note.date}  ·  ${note.source === 'meeting-mode' ? 'Meeting Mode artifact' : 'Manual note'}`;
  sections.push(...titleBlock(note.title, subtitle));

  // Light markdown rendering: # / ## / ### headings, - and - [ ]/[x] bullets, blanks → spacer.
  for (const raw of note.body.split('\n')) {
    const line = raw;
    if (/^# /.test(line)) sections.push(h1(line.slice(2)));
    else if (/^## /.test(line)) sections.push(h2(line.slice(3)));
    else if (/^### /.test(line)) sections.push(h3(line.slice(4)));
    else if (/^- \[ \] /.test(line)) sections.push(checkboxItem(line.slice(6), false));
    else if (/^- \[x\] /i.test(line)) sections.push(checkboxItem(line.slice(6), true));
    else if (/^[-•] /.test(line)) sections.push(bullet(line.slice(2)));
    else if (line.trim().length === 0) sections.push(p(''));
    else sections.push(p(line));
  }

  return Packer.toBuffer(
    buildDocument(sections, {
      title: note.title,
      subject: note.source === 'meeting-mode' ? 'Meeting note' : 'Project note',
      description: 'Stride note',
      headerLabel: `${note.title} · ${note.date}`,
    }),
  );
}

// ───── TRACKER ─────

export async function trackerToDocx(tracker: TrackerState): Promise<Buffer> {
  const dateLabel = new Date(tracker.updatedAt).toLocaleString();
  const sections: Array<Paragraph | Table> = [];

  sections.push(...titleBlock(tracker.projectName, `Status snapshot · ${dateLabel}`));

  sections.push(h2('Workstreams'));
  if (tracker.workstreams.length > 0) sections.push(workstreamsTable(tracker.workstreams));
  else sections.push(muted('No workstreams tracked.'));

  sections.push(h2('Milestones'));
  if (tracker.milestones.length > 0) sections.push(milestonesTable(tracker.milestones));
  else sections.push(muted('No milestones tracked.'));

  const openRisks = tracker.risks.filter((r) => r.status === 'open' || r.status === 'mitigating');
  if (openRisks.length > 0) {
    sections.push(h2('Open risks'));
    sections.push(risksTable(openRisks));
  }

  const openActions = tracker.actionItems.filter((a) => a.status !== 'done');
  if (openActions.length > 0) {
    sections.push(h2('Open action items'));
    sections.push(actionItemsTable(openActions));
  }

  if (tracker.history.length > 0) {
    sections.push(h2('Recent history'));
    for (const h of tracker.history.slice(0, 10)) {
      sections.push(
        h3(`${h.kind === 'morning-brief' ? 'Morning brief' : 'Meeting'}  ·  ${new Date(h.ts).toLocaleString()}`),
      );
      sections.push(p(h.summary));
    }
  }

  return Packer.toBuffer(
    buildDocument(sections, {
      title: `${tracker.projectName} — Status snapshot`,
      subject: 'Project status snapshot',
      description: 'Stride status tracker snapshot',
      headerLabel: `${tracker.projectName} · ${new Date().toISOString().slice(0, 10)}`,
    }),
  );
}

// ───── filename helper ─────

export function safeFilename(base: string, suffix = '.docx'): string {
  const cleaned = base
    // Replace common Unicode punctuation with ASCII equivalents so the filename
    // survives an HTTP Content-Disposition header (which must be ASCII).
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    // Drop anything still outside printable ASCII.
    .replace(/[^\x20-\x7E]+/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${cleaned || 'stride'}${suffix}`;
}
