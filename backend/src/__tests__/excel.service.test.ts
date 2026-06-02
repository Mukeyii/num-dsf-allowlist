/**
 * excel.service.test.ts – Shape test for generateIpAddressListExcel.
 * It reads whatever the test DB holds; we don't seed. We only assert the
 * output is a non-empty Buffer whose first two bytes are the XLSX/zip magic
 * number "PK" (0x50 0x4B), proving a real workbook was serialized.
 * Dependencies: excel.service
 */
import { generateIpAddressListExcel } from '../services/excel.service';

describe('excel.service – generateIpAddressListExcel', () => {
  it('returns a non-empty Buffer that begins with the XLSX/zip magic bytes (PK)', async () => {
    const buf = await generateIpAddressListExcel();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
