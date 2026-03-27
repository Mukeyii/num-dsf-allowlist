/**
 * excel.service.ts – IP Address List export as Excel
 * Contains ALL outgoing IPs of all organizations.
 */
import ExcelJS from 'exceljs';
import { db } from '../db/connection';

export async function generateIpAddressListExcel(): Promise<Buffer> {
  const ips = await db('endpoint_ips as eip')
    .join('endpoints as ep', 'eip.endpoint_id', 'ep.identifier')
    .join('organizations as org', 'ep.organization_id', 'org.identifier')
    .select('org.identifier as orgIdentifier', 'org.name as orgName', 'ep.identifier as endpointIdentifier', 'ep.address as endpointAddress', 'eip.ip', 'eip.is_fhir as isFhir', 'eip.is_bpe as isBpe')
    .orderBy(['org.identifier', 'ep.identifier', 'eip.ip']);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DSF Allow List Management';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('IP Address List');
  sheet.columns = [
    { header: 'Organization', key: 'orgIdentifier', width: 30 },
    { header: 'Organization Name', key: 'orgName', width: 40 },
    { header: 'Endpoint', key: 'endpointIdentifier', width: 40 },
    { header: 'Endpoint URL', key: 'endpointAddress', width: 50 },
    { header: 'IP Address', key: 'ip', width: 20 },
    { header: 'FHIR', key: 'isFhir', width: 10 },
    { header: 'BPE', key: 'isBpe', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ips.forEach((row: any) => { sheet.addRow({ ...row, isFhir: row.isFhir ? 'Yes' : 'No', isBpe: row.isBpe ? 'Yes' : 'No' }); });
  sheet.autoFilter = { from: 'A1', to: 'G1' };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
