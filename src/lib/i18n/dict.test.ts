import { describe, it, expect } from "vitest";
import { translate } from "./dict";
import { EN } from "./dict.en";

describe("translate", () => {
  it("returns the Indonesian source string as-is for id", () => {
    expect(translate("id", "Tambah", EN)).toBe("Tambah");
    // …even if a dictionary is supplied.
    expect(translate("id", "Hapus", EN)).toBe("Hapus");
  });

  it("looks up the English map when lang is en", () => {
    expect(translate("en", "Tambah", EN)).toBe("Add");
    expect(translate("en", "Hapus", EN)).toBe("Delete");
  });

  it("falls back to the source string for unmapped keys", () => {
    expect(translate("en", "String yang belum diterjemahkan", EN)).toBe(
      "String yang belum diterjemahkan",
    );
  });

  it("falls back gracefully when no dictionary is loaded", () => {
    // This is the Indonesian-visitor path: the client is given dict = null, so
    // nothing should throw and the source string is used.
    expect(translate("en", "Tambah", null)).toBe("Tambah");
    expect(translate("en", "Tambah", undefined)).toBe("Tambah");
    expect(translate("id", "Tambah", null)).toBe("Tambah");
  });
});

describe("EN map integrity", () => {
  it("has no empty translations", () => {
    const empty = Object.entries(EN).filter(([, v]) => !v.trim());
    expect(empty).toEqual([]);
  });

  it("covers the keys the UI relies on most", () => {
    for (const k of ["Tambah", "Hapus", "Batal", "Simpan", "Tugas", "Divisi"]) {
      expect(EN[k], `missing EN for "${k}"`).toBeTruthy();
    }
  });
});
