/**
 * excel.service.test.ts – Tests for generateIpAddressListExcel.
 * The shape test reads whatever the test DB holds (no seed) and asserts the
 * output is a non-empty Buffer whose first two bytes are the XLSX/zip magic
 * number "PK" (0x50 0x4B), proving a real workbook was serialized.
 * The approval-gate test seeds an APPROVED+active org and a PENDING org and
 * asserts only the approved org's IP is exported.
 * Dependencies: excel.service, db/connection, exceljs
 */
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
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

describe('excel.service – generateIpAddressListExcel approval/active gate', () => {
  const userId = uuidv4();
  const approvedInstance = uuidv4();
  const pendingInstance = uuidv4();
  const approvedOrg = `excel-approved-${uuidv4().slice(0, 8)}.example.de`;
  const pendingOrg = `excel-pending-${uuidv4().slice(0, 8)}.example.de`;
  const approvedEp = `ep-approved-${uuidv4().slice(0, 8)}.example.de`;
  const pendingEp = `ep-pending-${uuidv4().slice(0, 8)}.example.de`;
  const approvedIp = '10.77.0.1';
  const pendingIp = '10.88.0.1';

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: `${userId}@x.de`, created_at: new Date() });
    for (const [instanceId, orgId, status] of [
      [approvedInstance, approvedOrg, 'APPROVED'],
      [pendingInstance, pendingOrg, 'PENDING'],
    ] as const) {
      await db('instances').insert({
        id: instanceId,
        user_id: userId,
        label: 'excel',
        created_at: new Date(),
      });
      await db('organizations').insert({
        identifier: orgId,
        instance_id: instanceId,
        name: orgId,
        active: true,
        email: 'org@example.de',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await db('approval_requests').insert({
        id: uuidv4(),
        instance_id: instanceId,
        status,
        submitted_at: new Date(),
        created_at: new Date(),
        snapshot_json: JSON.stringify({}),
      });
    }
    for (const [orgId, epId, ip] of [
      [approvedOrg, approvedEp, approvedIp],
      [pendingOrg, pendingEp, pendingIp],
    ] as const) {
      await db('endpoints').insert({
        identifier: epId,
        organization_id: orgId,
        name: epId,
        address: `https://${epId}/fhir`,
        created_at: new Date(),
        updated_at: new Date(),
      });
      await db('endpoint_ips').insert({
        id: uuidv4(),
        endpoint_id: epId,
        ip,
        is_fhir: 1,
        is_bpe: 0,
      });
    }
  });

  afterAll(async () => {
    await db('endpoint_ips').whereIn('endpoint_id', [approvedEp, pendingEp]).del();
    await db('endpoints').whereIn('identifier', [approvedEp, pendingEp]).del();
    await db('approval_requests').whereIn('instance_id', [approvedInstance, pendingInstance]).del();
    await db('organizations').whereIn('identifier', [approvedOrg, pendingOrg]).del();
    await db('instances').whereIn('id', [approvedInstance, pendingInstance]).del();
    await db('users').where({ id: userId }).del();
  });

  it('includes the approved+active org IP and excludes the pending org IP', async () => {
    const buf = await generateIpAddressListExcel();
    const wb = new ExcelJS.Workbook();
    // ExcelJS .d.ts types load() as the legacy global Buffer; modern
    // @types/node typed Buffer.from output trips strict generics. Cast to
    // the declared parameter type — the runtime accepts the Node Buffer.
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const sheet = wb.getWorksheet('IP Address List')!;
    // Column keys are not preserved across load(); the IP Address column is
    // the 5th defined column (E) in the service's column order.
    const ips: string[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      ips.push(String(row.getCell(5).value));
    });
    expect(ips).toContain(approvedIp);
    expect(ips).not.toContain(pendingIp);
  });
});
