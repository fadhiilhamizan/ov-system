/**
 * The original Google Spreadsheets this system replaced.
 *
 * Kept as a permanent reference: everything before the app existed lives only
 * in these sheets, and a committee member who needs to check how something was
 * done in a past edition should not have to hunt for the link. Read-only by
 * nature - nothing in the app writes back to them.
 */
export interface ArchiveSheet {
  year: string;
  title: string;
  url: string;
}

export const ARCHIVE_SHEETS: ArchiveSheet[] = [
  {
    year: "2024",
    title: "MAIN SHEET ORMAWA VISIT 2024",
    url: "https://docs.google.com/spreadsheets/d/1o0nwDyj3KpblOTSYE9Z8t6QC7TSxN2pQ7tUIDoNtwew",
  },
  {
    year: "2025",
    title: "MAIN SHEET ORMAWA VISIT 2025",
    url: "https://docs.google.com/spreadsheets/d/1H5Qnm5aTEK-SYXbkhp9T17eyba7n3mFQGijz43m576c",
  },
  {
    year: "2026",
    title: "MAIN SHEET ORMAWA VISIT 2026",
    url: "https://docs.google.com/spreadsheets/d/17AIUswig4oji6UlHZKx12qQ07pqPft9Y",
  },
];
