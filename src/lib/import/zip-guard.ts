// ============================================================
// Look inside an uploaded .xlsx BEFORE handing it to exceljs.
//
// An .xlsx is a zip. The 3 MB upload cap limits the COMPRESSED size only, and
// zip compresses repetitive XML extremely well: a few megabytes can unpack to
// gigabytes (a "zip bomb"), which exceljs would try to hold in memory and
// take the server down with it. The central directory at the end of the file
// declares every entry's uncompressed size, so the total can be checked by
// reading a few kilobytes, without inflating anything.
//
// It also turns the two most common wrong files into a sentence a person can
// act on: an old .xls (and a password-protected .xlsx, which is the same
// container on disk) is an OLE file, not a zip, and exceljs would otherwise
// fail with an error message about "end of central directory".
//
// Pure, dependency-free and synchronous; unit tested with hand-built zips.
// ============================================================

export type ArchiveProblem =
  | "ole" // .xls (Excel 97-2003) or a password-protected .xlsx
  | "not-zip"
  | "not-xlsx" // a zip, but not a workbook (.docx / .pptx / a renamed .zip)
  | "too-large" // would unpack beyond the limit
  | "encrypted"
  | "unsupported"; // zip64 and other shapes an .xlsx under a few MB never uses

export const ARCHIVE_LIMITS = {
  /** Total uncompressed bytes. A 1000-row sheet is well under 5 MB of XML. */
  maxUncompressed: 40 * 1024 * 1024,
  maxEntries: 1000,
};

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function inspectArchive(
  bytes: Uint8Array,
  limits = ARCHIVE_LIMITS,
): { ok: true; entries: number; uncompressed: number } | { ok: false; problem: ArchiveProblem } {
  // D0 CF 11 E0: the OLE compound file signature.
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return { ok: false, problem: "ole" };
  }
  if (bytes.length < 22 || u32(bytes, 0) !== 0x04034b50) return { ok: false, problem: "not-zip" };

  // End of central directory: 22 bytes plus an optional comment of up to 64 KB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, problem: "not-zip" };
  const count = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) return { ok: false, problem: "unsupported" };
  if (count > limits.maxEntries) return { ok: false, problem: "too-large" };

  const decoder = new TextDecoder();
  let at = cdOffset;
  let total = 0;
  let hasWorkbook = false;
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || u32(bytes, at) !== 0x02014b50) return { ok: false, problem: "not-zip" };
    const flags = u16(bytes, at + 8);
    const size = u32(bytes, at + 24);
    const nameLen = u16(bytes, at + 28);
    const extraLen = u16(bytes, at + 30);
    const commentLen = u16(bytes, at + 32);
    if (flags & 0x1) return { ok: false, problem: "encrypted" };
    if (size === 0xffffffff) return { ok: false, problem: "unsupported" };
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    if (name === "xl/workbook.xml") hasWorkbook = true;
    total += size;
    if (total > limits.maxUncompressed) return { ok: false, problem: "too-large" };
    at += 46 + nameLen + extraLen + commentLen;
  }
  if (!hasWorkbook) return { ok: false, problem: "not-xlsx" };
  return { ok: true, entries: count, uncompressed: total };
}

/** What to tell the person, per problem. */
export const ARCHIVE_MESSAGE: Record<ArchiveProblem, string> = {
  ole: "File ini berformat Excel lama (.xls) atau dilindungi kata sandi. Buka di Excel, lalu Simpan Sebagai \"Excel Workbook (.xlsx)\" tanpa kata sandi.",
  "not-zip": "File ini bukan file .xlsx yang utuh. Unduh atau simpan ulang sebagai Excel Workbook (.xlsx).",
  "not-xlsx": "File ini bukan workbook Excel (mungkin dokumen Word/PowerPoint yang diganti namanya). Pakai template .xlsx dari aplikasi.",
  "too-large": "Isi file ini terlalu besar untuk diimpor sekaligus. Pecah datanya menjadi beberapa file.",
  encrypted: "File ini terenkripsi. Simpan ulang tanpa kata sandi lalu unggah lagi.",
  unsupported: "Format file ini tidak didukung. Simpan ulang sebagai Excel Workbook (.xlsx) biasa.",
};
