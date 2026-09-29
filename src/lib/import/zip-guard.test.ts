import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { inspectArchive } from "./zip-guard";

async function realXlsx(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Data").addRow(["a", "b"]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** Offsets of every central-directory entry, for tampering in tests. */
function centralEntries(b: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i + 4 <= b.length; i++) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x01 && b[i + 3] === 0x02) out.push(i);
  }
  return out;
}

describe("inspectArchive", () => {
  it("accepts a real workbook and reports its unpacked size", async () => {
    const res = inspectArchive(await realXlsx());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.uncompressed).toBeGreaterThan(0);
  });

  it("names an old .xls / password-protected file for what it is", () => {
    expect(inspectArchive(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]))).toEqual({ ok: false, problem: "ole" });
  });

  it("rejects something that is not a zip at all", () => {
    expect(inspectArchive(new TextEncoder().encode("Nama,Divisi\nDewi,Event"))).toEqual({ ok: false, problem: "not-zip" });
  });

  it("refuses a zip that would unpack past the limit, without unpacking it", async () => {
    const b = await realXlsx();
    const at = centralEntries(b)[0];
    // Declare a 2 GB uncompressed size on the first entry.
    b[at + 24] = 0x00; b[at + 25] = 0x00; b[at + 26] = 0x00; b[at + 27] = 0x80;
    expect(inspectArchive(b)).toEqual({ ok: false, problem: "too-large" });
  });

  it("refuses a zip that is not a workbook", async () => {
    const b = await realXlsx();
    const decoder = new TextDecoder();
    for (const at of centralEntries(b)) {
      const len = b[at + 28] | (b[at + 29] << 8);
      if (decoder.decode(b.subarray(at + 46, at + 46 + len)) === "xl/workbook.xml") {
        b[at + 46 + 3] = "W".charCodeAt(0); // xl/Workbook.xml
      }
    }
    expect(inspectArchive(b)).toEqual({ ok: false, problem: "not-xlsx" });
  });

  it("refuses an encrypted entry", async () => {
    const b = await realXlsx();
    b[centralEntries(b)[0] + 8] |= 0x1;
    expect(inspectArchive(b)).toEqual({ ok: false, problem: "encrypted" });
  });
});
