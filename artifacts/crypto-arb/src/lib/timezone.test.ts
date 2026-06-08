import { describe, it, expect, vi } from "vitest";

/**
 * timezone.test.ts
 *
 * Unit tests for israelTickMarkFormatter and israelTimeFormatter.
 * Both functions convert UTC timestamps to Israel-local (Asia/Jerusalem) label
 * strings. The critical correctness requirement is around Israel's twice-yearly
 * DST transitions:
 *   - Spring forward: last Friday before 2 April  (02:00 → 03:00, UTC+2 → UTC+3)
 *   - Fall back:      last Sunday before 3 November (02:00 → 01:00, UTC+3 → UTC+2)
 *
 * 2024 transitions used here:
 *   - Spring forward: 2024-03-29 00:00 UTC (local clock jumps 02:00 → 03:00)
 *   - Fall back:      2024-10-26 23:00 UTC (local clock falls 02:00 → 01:00)
 */

vi.mock("lightweight-charts", () => ({
  TickMarkType: {
    Year: 0,
    Month: 1,
    DayOfMonth: 2,
    Time: 3,
    TimeWithSeconds: 4,
  },
}));

import {
  israelTickMarkFormatter,
  israelTimeFormatter,
} from "./timezone";

const sec = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

const YEAR = 0;
const MONTH = 1;
const DAY = 2;
const TIME = 3;
const TIME_SEC = 4;

describe("israelTickMarkFormatter", () => {
  describe("regular winter time — UTC+2 (2024-01-15T10:30:00Z → Israel 12:30)", () => {
    const t = sec("2024-01-15T10:30:00Z");

    it("Year tick → '2024'", () => {
      expect(israelTickMarkFormatter(t, YEAR)).toBe("2024");
    });

    it("Month tick → 'Jan'", () => {
      expect(israelTickMarkFormatter(t, MONTH)).toBe("Jan");
    });

    it("DayOfMonth tick → '15 Jan'", () => {
      expect(israelTickMarkFormatter(t, DAY)).toBe("15 Jan");
    });

    it("Time tick → '12:30' (UTC+2 offset applied)", () => {
      expect(israelTickMarkFormatter(t, TIME)).toBe("12:30");
    });

    it("TimeWithSeconds tick → '12:30:00'", () => {
      expect(israelTickMarkFormatter(t, TIME_SEC)).toBe("12:30:00");
    });
  });

  describe("regular summer / DST time — UTC+3 (2024-07-15T10:30:00Z → Israel 13:30)", () => {
    const t = sec("2024-07-15T10:30:00Z");

    it("Time tick → '13:30' (UTC+3 offset applied)", () => {
      expect(israelTickMarkFormatter(t, TIME)).toBe("13:30");
    });

    it("Month tick → 'Jul'", () => {
      expect(israelTickMarkFormatter(t, MONTH)).toBe("Jul");
    });

    it("DayOfMonth tick → '15 Jul'", () => {
      expect(israelTickMarkFormatter(t, DAY)).toBe("15 Jul");
    });
  });

  describe("spring-forward boundary — 2024-03-29 (clocks jump 02:xx → 03:xx)", () => {
    it("just before: 2024-03-28T23:59:00Z → Israel 01:59 (still UTC+2)", () => {
      expect(israelTickMarkFormatter(sec("2024-03-28T23:59:00Z"), TIME)).toBe("01:59");
    });

    it("at transition: 2024-03-29T00:00:00Z → Israel 03:00 (UTC+3, 02:xx hour skipped)", () => {
      expect(israelTickMarkFormatter(sec("2024-03-29T00:00:00Z"), TIME)).toBe("03:00");
    });

    it("after transition: 2024-03-29T00:01:00Z → Israel 03:01 (UTC+3)", () => {
      expect(israelTickMarkFormatter(sec("2024-03-29T00:01:00Z"), TIME)).toBe("03:01");
    });
  });

  describe("fall-back boundary — 2024-10-27 (clocks roll back 02:00 → 01:00)", () => {
    it("just before fall-back: 2024-10-26T22:59:00Z → Israel 01:59 (UTC+3, still DST)", () => {
      expect(israelTickMarkFormatter(sec("2024-10-26T22:59:00Z"), TIME)).toBe("01:59");
    });

    it("at fall-back: 2024-10-26T23:00:00Z → Israel 01:00 (UTC+2, clock set back)", () => {
      expect(israelTickMarkFormatter(sec("2024-10-26T23:00:00Z"), TIME)).toBe("01:00");
    });

    it("after fall-back: 2024-10-26T23:01:00Z → Israel 01:01 (UTC+2)", () => {
      expect(israelTickMarkFormatter(sec("2024-10-26T23:01:00Z"), TIME)).toBe("01:01");
    });
  });
});

describe("israelTimeFormatter (crosshair label)", () => {
  it("winter: 2024-01-15T10:30:00Z → '15 Jan, 12:30' (UTC+2)", () => {
    expect(israelTimeFormatter(sec("2024-01-15T10:30:00Z"))).toBe("15 Jan, 12:30");
  });

  it("summer: 2024-07-15T10:30:00Z → '15 Jul, 13:30' (UTC+3)", () => {
    expect(israelTimeFormatter(sec("2024-07-15T10:30:00Z"))).toBe("15 Jul, 13:30");
  });

  it("spring-forward: 2024-03-29T00:00:00Z → '29 Mar, 03:00' (no 02:xx label possible)", () => {
    expect(israelTimeFormatter(sec("2024-03-29T00:00:00Z"))).toBe("29 Mar, 03:00");
  });

  it("fall-back (at transition): 2024-10-26T23:00:00Z → '27 Oct, 01:00' (UTC+2 after rollback)", () => {
    expect(israelTimeFormatter(sec("2024-10-26T23:00:00Z"))).toBe("27 Oct, 01:00");
  });

  it("fall-back (one hour after): 2024-10-27T00:00:00Z → '27 Oct, 02:00' (UTC+2)", () => {
    expect(israelTimeFormatter(sec("2024-10-27T00:00:00Z"))).toBe("27 Oct, 02:00");
  });
});
