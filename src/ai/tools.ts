export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'navigate',
    description: 'นำทางไปยัง URL ที่กำหนด (รองรับทั้ง HTTP และ HTTPS)',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL ปลายทาง เช่น http://127.0.0.1:8080 หรือ https://example.com' },
      },
      required: ['url'],
    },
  },
  {
    name: 'click',
    description: 'คลิกที่ element ตาม CSS selector หรือ data-testid เช่น [data-testid=submit] หรือ button.search',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector ของ element ที่ต้องการคลิก' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'fill',
    description: 'กรอกข้อความลงในช่อง input หรือ textarea ตาม CSS selector',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector ของช่องกรอกข้อความ' },
        value: { type: 'string', description: 'ข้อความที่ต้องการกรอก' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'assertText',
    description: 'ตรวจสอบว่ามีข้อความที่กำหนดอยู่ใน element หรือไม่ เพื่อยืนยันความถูกต้องของผลลัพธ์',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector ของ element ที่จะตรวจ' },
        contains: { type: 'string', description: 'ข้อความที่ต้องมีอยู่ใน element นั้น' },
      },
      required: ['selector', 'contains'],
    },
  },
  {
    name: 'screenshot',
    description: 'ถ่ายภาพหน้าจอหน้าเว็บปัจจุบันและบันทึกเป็นหลักฐาน artifact',
    parameters: {
      type: 'object',
      properties: {
        artifactName: { type: 'string', description: 'ชื่อไฟล์ภาพที่จะบันทึก เช่น result.png' },
      },
      required: ['artifactName'],
    },
  },
  {
    name: 'inspectConsole',
    description: 'ตรวจสอบรายการ log และ error ล่าสุดจาก Console ของหน้านี้',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'inspectNetwork',
    description: 'ตรวจสอบรายการ network request ล่าสุด เช่น หา request ที่ failed หรือ HTTP status code',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'scroll',
    description: 'เลื่อนหน้าเว็บลงหรือขึ้น',
    parameters: {
      type: 'object',
      properties: {
        y: { type: 'number', description: 'ระยะทางพิกเซลที่ต้องการเลื่อนลง (เป็นบวก) หรือขึ้น (เป็นลบ)' },
      },
      required: ['y'],
    },
  },
  {
    name: 'finish',
    description: 'จบภารกิจและสรุปผลการทำงานให้ผู้ใช้ทราบพร้อมอ้างอิงหลักฐานที่พบ',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'สรุปผลลัพธ์การทำงานอย่างละเอียด พร้อมอ้างอิงหลักฐานจริง' },
      },
      required: ['summary'],
    },
  },
];
